import Foundation
import UIKit
import AVFoundation
import AVKit
import Capacitor
import TwilioVoice
import PushKit
import CallKit
import os

/// Public logger so the speaker-routing diagnostics are readable in Console
/// (filter subsystem "co.nz.inflowapp"). Plain NSLog with an interpolated Swift
/// string is marked <private> on-device and gets redacted, which hid build-17's
/// route logs entirely — os_log with `privacy: .public` shows the real values.
private let tvLog = Logger(subsystem: "co.nz.inflowapp", category: "TwilioVoice")

// MARK: - Capacitor Plugin Declaration

@objc(TwilioVoicePlugin)
public class TwilioVoicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TwilioVoicePlugin"
    public let jsName = "TwilioVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unregister", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "answer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reject", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hangup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeaker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendDigits", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showAudioRoutePicker", returnType: CAPPluginReturnPromise),
    ]

    /// Shared instance so the AppDelegate can stand up VoIP push handling at app
    /// launch — required to catch a call that cold-launches a killed/locked app,
    /// since iOS delivers the VoIP push before the Capacitor webview loads —
    /// while Capacitor registers this SAME instance for JS bridge calls.
    static let shared = TwilioVoicePlugin()

    // MARK: - Stored Properties (strongly retained)

    /// Retained reference to PKPushRegistry — must be a stored property or callbacks stop.
    private var voipRegistry: PKPushRegistry?
    private var callKitProvider: CXProvider?
    private var callKitCallController = CXCallController()
    private var activeCall: Call?
    private var callInvite: CallInvite?
    private var callUUID: UUID?
    private var accessToken: String?
    private var deviceToken: Data?
    /// Last speaker selection the user made for the live call. Reapplied when
    /// CallKit (re)activates the audio session, since the output route resets to
    /// the receiver on activation. Cleared when the call ends.
    private var speakerOn = false
    /// Bounds the route-change re-assert loop so a never-holding override can't
    /// spin forever. Resets to 0 whenever the route actually reaches the speaker
    /// (so a later revert gets a fresh budget) and on each user toggle / call end.
    private var speakerReassertAttempts = 0
    private let maxSpeakerReasserts = 4
    /// Error text from the most recent route attempt, forwarded to the webview
    /// in the "audioRoute" event. os_log is unreadable on the owner's device,
    /// so a route failure that only logs is a route failure that never
    /// happened as far as debugging goes — this puts it on the call screen.
    private var lastRouteError = ""
    /// Hidden system route-picker control, kept in the view hierarchy so its
    /// popover survives presentation. Created lazily on first use.
    private var routePickerView: AVRoutePickerView?

    // MARK: - Plugin Lifecycle

    public override func load() {
        super.load()
        startVoIP()
    }

    /// Sets up CallKit + the VoIP push registry. Called from the AppDelegate at
    /// `didFinishLaunchingWithOptions` (so the registry is live before iOS
    /// delivers a cold-launch VoIP push to a killed/locked app — the webview
    /// hasn't loaded yet at that point) and again from `load()` for normal
    /// launches. Both setup steps are idempotent, so repeat calls are no-ops.
    /// Handling an incoming push needs no access token, so this is safe to run
    /// before JS hands one over.
    func startVoIP() {
        // Pin the Twilio edge to Sydney — nearest to NZ. The default ("roaming")
        // picks an edge by DNS-based latency routing, which carrier DNS or a
        // VPN can misroute to a US edge; that adds multi-second call-setup and
        // answer-to-audio delays. Explicit selection keeps signaling + media
        // on the au1 edge every time.
        TwilioVoiceSDK.edge = "sydney"
        if Thread.isMainThread {
            setupCallKit()
            registerForVoIPPush()
        } else {
            DispatchQueue.main.async {
                self.setupCallKit()
                self.registerForVoIPPush()
            }
        }
    }

    // MARK: - Plugin Methods (called from JavaScript)

    @objc func register(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("token is required")
            return
        }
        self.accessToken = token
        DispatchQueue.main.async {
            // Registry is normally already up from load(); this is a no-op then.
            self.registerForVoIPPush()
            // If the device token already arrived (registry came up at launch),
            // bind/refresh it with Twilio now. Otherwise didUpdate handles it
            // once the token is delivered.
            self.registerWithTwilioIfReady()
        }
        call.resolve()
    }

    @objc func unregister(_ call: CAPPluginCall) {
        guard let token = self.accessToken, let deviceToken = self.deviceToken else {
            call.resolve()
            return
        }
        TwilioVoiceSDK.unregister(accessToken: token, deviceToken: deviceToken) { error in
            if let error = error {
                call.reject("Unregister failed: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }
    }

    @objc func answer(_ call: CAPPluginCall) {
        // Operate on the SHARED instance throughout. VoIP push + CallKit are
        // stood up on `shared` at launch (AppDelegate), so the live call/invite
        // live there — but Capacitor can route JS bridge calls to a SECOND
        // plugin instance (the `.m` CAP_PLUGIN macro auto-creates one) whose
        // call state is nil. answer/reject happened to still work because they
        // go through CallKit actions handled by shared's provider delegate;
        // mute/hangup/setSpeaker touched `self` directly and silently no-op'd.
        let shared = TwilioVoicePlugin.shared
        guard shared.callInvite != nil, let uuid = shared.callUUID else {
            call.reject("No active call invite")
            return
        }
        // Answer THROUGH CallKit (request a CXAnswerCallAction) instead of
        // accepting the invite directly here. This is what makes the in-app
        // speaker toggle audible: CallKit only activates the VoIP audio session
        // — and fires provider(didActivate:) — when it drives the answer itself.
        // A bare callInvite.accept() leaves CallKit's managed session inactive,
        // so a later overrideOutputAudioPort(.speaker) has no effect and audio
        // stays on the earpiece even though the button shows "on". Routing both
        // the lock-screen and in-app answers through the same CXAnswerCallAction
        // path (handled in provider(perform:) below, which does the actual
        // accept) keeps speaker routing consistent. callUUID is set in
        // reportIncomingCall before JS is ever notified, so it's available here.
        let answerAction = CXAnswerCallAction(call: uuid)
        shared.callKitCallController.request(CXTransaction(action: answerAction)) { error in
            if let error = error {
                call.reject("Answer failed: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }
    }

    @objc func reject(_ call: CAPPluginCall) {
        // See answer() — operate on shared, where the live invite/call lives.
        let shared = TwilioVoicePlugin.shared
        shared.callInvite?.reject()
        shared.callInvite = nil
        if let uuid = shared.callUUID {
            let action = CXEndCallAction(call: uuid)
            shared.callKitCallController.request(CXTransaction(action: action)) { _ in }
            shared.callUUID = nil
        }
        call.resolve()
    }

    @objc func hangup(_ call: CAPPluginCall) {
        // self.activeCall is nil on a JS-routed second instance, so the in-app
        // End/Mute/Speaker buttons silently did nothing. Use shared's live call.
        TwilioVoicePlugin.shared.activeCall?.disconnect()
        call.resolve()
    }

    @objc func mute(_ call: CAPPluginCall) {
        let isMuted = call.getBool("muted") ?? true
        TwilioVoicePlugin.shared.activeCall?.isMuted = isMuted
        call.resolve()
    }

    @objc func sendDigits(_ call: CAPPluginCall) {
        guard let digits = call.getString("digits"), !digits.isEmpty else {
            call.reject("digits is required")
            return
        }
        // Valid DTMF characters per the SDK: 0-9, *, # and 'w' (500ms pause).
        // Reject anything else up front — sendDigits on the TVOCall silently
        // no-ops rather than erroring, so a bad string would look like a
        // dead keypad with no signal as to why.
        let valid = CharacterSet(charactersIn: "0123456789*#w")
        guard digits.unicodeScalars.allSatisfy({ valid.contains($0) }) else {
            call.reject("digits may only contain 0-9, *, # and w")
            return
        }
        // Like mute/hangup: the live call lives on shared, not on a JS-routed
        // second plugin instance.
        guard let activeCall = TwilioVoicePlugin.shared.activeCall else {
            call.reject("No active call")
            return
        }
        activeCall.sendDigits(digits)
        call.resolve()
    }

    /// Presents the SYSTEM audio-output picker (the same control the native
    /// call UI and Control Center use). A route the user picks there is a
    /// user-selected route with top arbitration priority — the escape hatch
    /// for when the app-level speaker override is accepted-but-ignored during
    /// a CallKit call (observed on build 1.0(34): no error, route pinned to
    /// receiver). AVRoutePickerView has no public "present" API; triggering
    /// its internal button is the widely-used pattern.
    @objc func showAudioRoutePicker(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let shared = TwilioVoicePlugin.shared
            guard let hostView = self.bridge?.viewController?.view ?? shared.bridge?.viewController?.view else {
                call.reject("No view to present from")
                return
            }
            let picker: AVRoutePickerView
            if let existing = shared.routePickerView, existing.superview != nil {
                picker = existing
            } else {
                picker = AVRoutePickerView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
                picker.isHidden = false
                picker.alpha = 0.02 // effectively invisible; isHidden blocks the popover on some iOS versions
                hostView.addSubview(picker)
                shared.routePickerView = picker
            }
            guard let button = picker.subviews.compactMap({ $0 as? UIButton }).first else {
                // Into the on-screen event log — the owner reported being
                // unsure whether the sheet ever appeared, and console.warn
                // in the webview is invisible on this device.
                shared.emitAudioRoute("routePicker:noButton")
                call.reject("Route picker button not found")
                return
            }
            button.sendActions(for: .touchUpInside)
            shared.emitAudioRoute("routePicker:opened")
            call.resolve()
        }
    }

    @objc func setSpeaker(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        // Drive speaker state on shared so the route-change watchdog and the
        // didActivate reapply (both registered on shared's CallKit provider)
        // see the user's selection. On a JS-routed second instance, self.speakerOn
        // would be stranded and the override would never hold.
        let shared = TwilioVoicePlugin.shared
        shared.speakerOn = on
        shared.speakerReassertAttempts = 0
        // Bridge-delivery proof for the on-screen event log: build 35's
        // screenshot left open whether Speaker taps reach native at all (last
        // event was callDidConnect). This fires before any audio work, so a
        // missing "setSpeaker:received" after a tap = JS/bridge problem, not
        // an audio-session one.
        shared.emitAudioRoute("setSpeaker:received(\(on))")
        // AVAudioSession route changes must run on the main thread. Capacitor
        // dispatches plugin calls on a background queue, and an off-main
        // setCategory/overrideOutputAudioPort silently fails to move audio —
        // which is why the IN-APP speaker toggle (foreground calls) could still
        // do nothing even with .defaultToSpeaker set, while the native CallKit
        // speaker button (lock screen, handled by iOS itself) worked. The other
        // CallKit/audio methods here already hop to main; setSpeaker was the
        // outlier.
        DispatchQueue.main.async {
            shared.applySpeakerRoute(on)
            call.resolve()
            // The routeChange watchdog only fires on AVAudioSession route-change
            // notifications. Some reverts — Twilio restarting its own audio unit,
            // or the session being reconfigured without a system route change —
            // flip the output back to the receiver WITHOUT posting that
            // notification, so the watchdog never sees them and the speaker
            // silently drops. Re-assert a few times in the first ~1.5s after the
            // toggle to catch those. Guarded by speakerOn so toggling back off
            // (or the call ending, which clears speakerOn) stops the re-asserts.
            if on {
                for delay in [0.3, 0.8, 1.6] {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                        guard shared.speakerOn else { return }
                        shared.applySpeakerRoute(true)
                    }
                }
            }
        }
    }

    /// Forces the live call's audio route to the speaker (or back to the
    /// receiver). Must be called on the main thread.
    private func applySpeakerRoute(_ on: Bool) {
        let applyRoute = {
            let session = AVAudioSession.sharedInstance()
            var errs: [String] = []
            // Best-effort: .defaultToSpeaker as the session's standing
            // preference so the route survives audio-unit restarts; Bluetooth
            // options mirror Twilio's default config so paired headsets keep
            // working. IMPORTANT: this must be a SEPARATE do/catch from the
            // override below. setCategory is exactly the call that can throw
            // under CallKit while Twilio's audio unit is live, and when the
            // two shared one do-block a category failure silently skipped the
            // override on every attempt — observed on-device as the speaker
            // button lit with "Audio: Receiver" pinned for the whole call.
            // Twilio's quickstart toggle calls ONLY the override for this
            // reason.
            var options: AVAudioSession.CategoryOptions = [
                .allowBluetoothHFP, .allowBluetoothA2DP,
            ]
            if on { options.insert(.defaultToSpeaker) }
            do {
                // Mode .videoChat when the speaker is on: build 1.0(34) showed
                // both setCategory and the port override succeeding with the
                // route pinned to the receiver anyway — iOS's route arbiter
                // ignoring an app-level override during a CallKit call.
                // .videoChat's SYSTEM default output is the loudspeaker
                // (FaceTime-style), so the desired route no longer depends on
                // the override being honoured; it also selects
                // speaker-appropriate echo cancellation. Back to .voiceChat
                // when toggled off.
                try session.setCategory(
                    .playAndRecord,
                    mode: on ? .videoChat : .voiceChat,
                    options: options
                )
            } catch {
                errs.append("setCategory: \(error.localizedDescription)")
            }
            do {
                try session.overrideOutputAudioPort(on ? .speaker : .none)
            } catch {
                errs.append("override: \(error.localizedDescription)")
            }
            self.lastRouteError = errs.joined(separator: " | ")
            if !errs.isEmpty {
                tvLog.error("setSpeaker(\(on, privacy: .public)) failed: \(self.lastRouteError, privacy: .public)")
            }
            // What iOS ACTUALLY routed to (expect builtInSpeaker when on=true,
            // receiver when off) plus the session state — the ground truth when
            // the toggle doesn't match the audible output.
            let outputs = session.currentRoute.outputs
                .map { $0.portType.rawValue }
                .joined(separator: ",")
            tvLog.log("setSpeaker(\(on, privacy: .public)) cat=\(session.category.rawValue, privacy: .public) mode=\(session.mode.rawValue, privacy: .public) outputs=[\(outputs, privacy: .public)]")
            // Push the same ground-truth to the webview. On this device the os_log
            // lines above are unreadable (Console/`log collect` can't reach this
            // app's logs), so the in-app call screen is the only diagnostic
            // channel — it shows what iOS ACTUALLY routed to.
            self.emitAudioRoute("setSpeaker(\(on))")
        }
        // Twilio's DefaultAudioDevice owns the AVAudioSession, so routing
        // changes must also live inside the device's configuration block —
        // that's what re-runs on each internal audio-unit cycle.
        if let audioDevice = TwilioVoiceSDK.audioDevice as? DefaultAudioDevice {
            audioDevice.block = {
                DefaultAudioDevice.DefaultAVAudioSessionConfigurationBlock()
                applyRoute()
            }
            if self.activeCall != nil, audioDevice.isEnabled {
                // RESTART the audio unit instead of just running the block on
                // the live one. Builds 33-35 proved that poking the session
                // mid-call (setCategory + override, no errors) changes
                // nothing — a live CallKit-managed I/O unit keeps its route.
                // Twilio's documented pattern for mid-call audio-session
                // changes is to disable/re-enable the device so a FRESH audio
                // unit initialises against the new config (the block runs
                // during re-init); the native CallKit speaker button works
                // precisely because the system restarts the unit itself.
                // Costs a brief (~100ms) audio blip on toggle.
                audioDevice.isEnabled = false
                audioDevice.isEnabled = true
            } else {
                audioDevice.block()
            }
        } else {
            applyRoute()
        }
    }

    /// Emits the live audio route to the webview ("audioRoute" event) so the
    /// in-app call screen can display it. This is the diagnostic channel that
    /// replaces unreadable device logs: `outputs` is what iOS is actually playing
    /// through (expect "Speaker" when the speaker is on, "Receiver" otherwise),
    /// while `speakerSelected` is what the user asked for — a mismatch is the bug.
    private func emitAudioRoute(_ context: String) {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs
            .map { $0.portType.rawValue }
            .joined(separator: ",")
        let onSpeaker = session.currentRoute.outputs.contains { $0.portType == .builtInSpeaker }
        // Session config as the system actually holds it, human-readable. If
        // the call screen shows e.g. "Playback/Default" instead of
        // "PlayAndRecord/VideoChat", something (the WKWebView is the usual
        // culprit) rewrote the session behind our back — that's a different
        // bug than the route arbiter ignoring an override.
        let opts = session.categoryOptions
        var optNames: [String] = []
        if opts.contains(.defaultToSpeaker) { optNames.append("spkDefault") }
        if opts.contains(.allowBluetoothHFP) { optNames.append("btHFP") }
        if opts.contains(.allowBluetoothA2DP) { optNames.append("btA2DP") }
        if opts.contains(.mixWithOthers) { optNames.append("mix") }
        notifyListeners("audioRoute", data: [
            "context": context,
            "outputs": outputs,
            "onSpeaker": onSpeaker ? "true" : "false",
            "speakerSelected": self.speakerOn ? "true" : "false",
            "attempts": String(self.speakerReassertAttempts),
            "category": session.category.rawValue
                .replacingOccurrences(of: "AVAudioSessionCategory", with: ""),
            "mode": session.mode.rawValue
                .replacingOccurrences(of: "AVAudioSessionMode", with: ""),
            "options": optNames.joined(separator: "+"),
            "error": self.lastRouteError,
        ])
    }

    // MARK: - CallKit Setup

    private func setupCallKit() {
        guard callKitProvider == nil else { return }
        let config = CXProviderConfiguration(localizedName: "Inflow")
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.includesCallsInRecents = true
        config.supportsVideo = false
        // Use app icon if available
        if let iconImage = UIImage(named: "AppIcon") {
            config.iconTemplateImageData = iconImage.pngData()
        }
        callKitProvider = CXProvider(configuration: config)
        callKitProvider?.setDelegate(self, queue: nil)
    }

    // MARK: - VoIP Push Registration

    private func registerForVoIPPush() {
        // Idempotent: the registry is created once (at launch in load()) and
        // reused when JS later calls register(). Creating a second registry
        // would orphan the delegate callbacks.
        guard self.voipRegistry == nil else { return }
        // Assign to stored property so the registry — and therefore the delegate
        // callbacks — remain alive for the lifetime of the plugin instance.
        let registry = PKPushRegistry(queue: DispatchQueue.main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        self.voipRegistry = registry
    }

    /// Binds the VoIP device token to the Twilio identity so inbound calls get
    /// pushed here. No-op until BOTH the access token (from JS `register()`) and
    /// the device token (from the PKPushRegistry) are available — the two can
    /// arrive in either order depending on app launch path.
    private func registerWithTwilioIfReady() {
        guard let token = self.accessToken, let deviceToken = self.deviceToken else { return }
        TwilioVoiceSDK.register(accessToken: token, deviceToken: deviceToken) { error in
            if let error = error {
                NSLog("[TwilioVoice] Registration error: \(error)")
                self.notifyListeners("registrationError", data: ["message": error.localizedDescription])
            } else {
                let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
                NSLog("[TwilioVoice] Registered — device token: \(hex.prefix(8))...")
                self.notifyListeners("registered", data: ["deviceToken": hex])
            }
        }
    }

    // MARK: - Incoming Call Presentation

    private func reportIncomingCall(from callInvite: CallInvite) {
        self.callInvite = callInvite
        let uuid = UUID()
        self.callUUID = uuid

        // Capture whether the app is in the foreground BEFORE presenting the
        // CallKit UI (presenting it can flip the app to inactive). iOS only
        // shows its own full-screen call UI for lock-screen/background answers;
        // when the app is already open it tucks the call into the Dynamic Island
        // and expects the app to draw its own controls. The web layer keys off
        // this flag to show the in-app call screen ONLY for foreground calls.
        let isForeground: Bool
        if Thread.isMainThread {
            isForeground = UIApplication.shared.applicationState == .active
        } else {
            isForeground = DispatchQueue.main.sync {
                UIApplication.shared.applicationState == .active
            }
        }
        NSLog("[TwilioVoice] incoming call — foreground=\(isForeground)")

        let update = CXCallUpdate()
        let callerNumber = callInvite.from ?? "Unknown"
        update.remoteHandle = CXHandle(type: .phoneNumber, value: callerNumber)
        update.hasVideo = false
        // The server looks up the caller against the customer database and, if
        // it finds a match, passes their name as the "callerName" custom
        // parameter on the <Client> dial. Show that on the CallKit screen so
        // the user sees who's calling before answering. Falls back to a generic
        // label for unknown numbers.
        let knownName = callInvite.customParameters?["callerName"]
        update.localizedCallerName = (knownName?.isEmpty == false) ? knownName! : "Inflow Customer"

        callKitProvider?.reportNewIncomingCall(with: uuid, update: update) { error in
            if let error = error {
                NSLog("[TwilioVoice] CallKit incoming call error: \(error)")
            }
        }

        // Retain these call-lifecycle events until a JS listener consumes them.
        // When the app is cold-launched (or foregrounded) by the VoIP push, the
        // native side reports the call and the user can answer from CallKit
        // BEFORE the webview's React listeners have attached. Without retention,
        // Capacitor drops those early events, so the web `callState` never
        // leaves "idle" and the in-call overlay (mute/speaker/end-call) never
        // appears — the user lands on the current route with no controls.
        notifyListeners("incomingCall", data: [
            "from": callerNumber,
            "to": callInvite.to ?? "",
            "callSid": callInvite.callSid,
            "callerName": knownName ?? "",
            "foreground": isForeground ? "true" : "false",
        ], retainUntilConsumed: true)
    }
}

// MARK: - PKPushRegistryDelegate
// Self-contained VoIP push handling — no AppDelegate changes needed.

extension TwilioVoicePlugin: PKPushRegistryDelegate {
    public func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        guard type == .voIP else { return }
        // Always keep the device token — the registry can come up at launch
        // (load) before JS has supplied an access token. The Twilio binding then
        // happens as soon as register() provides the token (or right here if it
        // already has).
        self.deviceToken = pushCredentials.token
        registerWithTwilioIfReady()
    }

    public func pushRegistry(
        _ registry: PKPushRegistry,
        didInvalidatePushTokenFor type: PKPushType
    ) {
        guard type == .voIP,
              let token = self.accessToken,
              let deviceToken = self.deviceToken else { return }
        TwilioVoiceSDK.unregister(accessToken: token, deviceToken: deviceToken) { _ in }
    }

    /// iOS 13+ requires CallKit to be notified of the incoming call BEFORE this
    /// method returns. TwilioVoiceSDK.handleNotification is designed to call
    /// `callInviteReceived` synchronously on the delegate for exactly this reason.
    public func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }
        TwilioVoiceSDK.handleNotification(
            payload.dictionaryPayload,
            delegate: self,
            delegateQueue: nil
        )
        completion()
    }
}

// MARK: - NotificationDelegate (Twilio)

extension TwilioVoicePlugin: NotificationDelegate {
    public func callInviteReceived(callInvite: CallInvite) {
        reportIncomingCall(from: callInvite)
    }

    public func cancelledCallInviteReceived(
        cancelledCallInvite: CancelledCallInvite,
        error: Error
    ) {
        guard let uuid = self.callUUID else { return }
        callKitProvider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        self.callInvite = nil
        self.callUUID = nil
        notifyListeners("callCancelled", data: [:], retainUntilConsumed: true)
    }
}

// MARK: - CXProviderDelegate

extension TwilioVoicePlugin: CXProviderDelegate {
    public func providerDidReset(_ provider: CXProvider) {
        // Quickstart (SDK 6.x) pattern: the audio device is enabled ONLY in
        // didActivate; a provider reset means CallKit tore the session down,
        // so make sure the audio graph is stopped too.
        (TwilioVoiceSDK.audioDevice as? DefaultAudioDevice)?.isEnabled = false
        activeCall?.disconnect()
        activeCall = nil
    }

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let callInvite = self.callInvite else {
            action.fail()
            return
        }
        // Disable the Twilio audio device before accepting and hand the SDK our
        // CallKit UUID via AcceptOptions. Per the SDK 6.x contract, a nil
        // AcceptOptions.uuid means "no CallKit here" and the SDK enables the
        // audio device ITSELF at accept — against an AVAudioSession CallKit
        // hasn't activated yet. The audio unit fails to start and retries,
        // audible as ~2-3s of dead microphone right after answering ("they
        // can't hear me at first"). With the uuid set (and the device disabled
        // until CallKit's didActivate re-enables it), audio starts the moment
        // the session is actually live. Resetting the block also clears any
        // stale speaker-route closure a previous call's setSpeaker left behind.
        if let audioDevice = TwilioVoiceSDK.audioDevice as? DefaultAudioDevice {
            audioDevice.isEnabled = false
            audioDevice.block = DefaultAudioDevice.DefaultAVAudioSessionConfigurationBlock
        }
        let acceptOptions = AcceptOptions(callInvite: callInvite) { builder in
            builder.uuid = action.callUUID
        }
        self.activeCall = callInvite.accept(options: acceptOptions, delegate: self)
        self.callInvite = nil
        action.fulfill()
        notifyListeners("callAnswered", data: [:], retainUntilConsumed: true)
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        callInvite?.reject()
        callInvite = nil
        activeCall?.disconnect()
        activeCall = nil
        callUUID = nil
        speakerOn = false
        lastRouteError = ""
        action.fulfill()
        notifyListeners("callEnded", data: [:], retainUntilConsumed: true)
    }

    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        activeCall?.isMuted = action.isMuted
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // Fires once CallKit owns and activates the VoIP audio session. This is
        // the signal that the speaker override will actually engage — if you
        // answer in the foreground and DON'T see this, the answer didn't go
        // through CallKit and setSpeaker(.speaker) will silently stay on the
        // earpiece. Both lock-screen and in-app answers route through
        // CXAnswerCallAction, so it should fire for both.
        tvLog.log("CallKit didActivate — speakerOn=\(self.speakerOn, privacy: .public)")
        emitAudioRoute("didActivate")
        (TwilioVoiceSDK.audioDevice as? DefaultAudioDevice)?.isEnabled = true
        // Watch for the route being yanked back to the earpiece. Earpiece audio
        // works but the speaker override doesn't stick, which points at something
        // (CallKit, Twilio's audio unit, or the WKWebView) reconfiguring the
        // session right after we set it. Re-assert speaker whenever the route
        // changes away from it while the user has speaker selected.
        NotificationCenter.default.removeObserver(
            self, name: AVAudioSession.routeChangeNotification, object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
        // The output route resets to the receiver when the session activates, so
        // reapply any speaker selection the user already made (e.g. tapped
        // speaker before the session finished activating).
        if self.speakerOn {
            self.applySpeakerRoute(true)
        }
    }

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        NotificationCenter.default.removeObserver(
            self, name: AVAudioSession.routeChangeNotification, object: nil
        )
        (TwilioVoiceSDK.audioDevice as? DefaultAudioDevice)?.isEnabled = false
    }

    /// Re-assert the speaker route if it gets reverted mid-call. Only acts when
    /// the user has speaker selected and the current output is NOT the built-in
    /// speaker, so it converges (a successful override flips the route to speaker
    /// and the next notification is a no-op) rather than looping.
    @objc private func handleRouteChange(_ notification: Notification) {
        guard self.speakerOn else { return }
        let session = AVAudioSession.sharedInstance()
        let onSpeaker = session.currentRoute.outputs.contains { $0.portType == .builtInSpeaker }
        let reasonRaw = (notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) ?? 0
        let outputs = session.currentRoute.outputs.map { $0.portType.rawValue }.joined(separator: ",")
        tvLog.log("routeChange reason=\(reasonRaw, privacy: .public) onSpeaker=\(onSpeaker, privacy: .public) attempts=\(self.speakerReassertAttempts, privacy: .public) outputs=[\(outputs, privacy: .public)]")
        emitAudioRoute("routeChange reason=\(reasonRaw)")
        if onSpeaker {
            speakerReassertAttempts = 0
        } else if speakerReassertAttempts < maxSpeakerReasserts {
            speakerReassertAttempts += 1
            DispatchQueue.main.async { self.applySpeakerRoute(true) }
        } else {
            tvLog.error("speaker reassert gave up after \(self.maxSpeakerReasserts, privacy: .public) tries — override not holding")
        }
    }
}

// MARK: - CallDelegate (Twilio call state)

extension TwilioVoicePlugin: CallDelegate {
    public func callDidConnect(call: Call) {
        // Media start restarts Twilio's audio unit, which can pull the output
        // back to the receiver WITHOUT posting a route-change notification —
        // the didActivate watchdog never sees it. If the user already selected
        // speaker (toggled during "Connecting…"), re-assert it now that the
        // audio graph is in its final state.
        if self.speakerOn {
            DispatchQueue.main.async { self.applySpeakerRoute(true) }
        }
        emitAudioRoute("callDidConnect")
        notifyListeners("callConnected", data: ["sid": call.sid ?? ""], retainUntilConsumed: true)
    }

    public func callDidDisconnect(call: Call, error: Error?) {
        if let uuid = self.callUUID {
            callKitProvider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        }
        activeCall = nil
        callUUID = nil
        speakerOn = false
        lastRouteError = ""
        notifyListeners("callDisconnected", data: [
            "error": error?.localizedDescription ?? "",
        ], retainUntilConsumed: true)
    }

    public func callDidFailToConnect(call: Call, error: Error) {
        if let uuid = self.callUUID {
            callKitProvider?.reportCall(with: uuid, endedAt: Date(), reason: .failed)
        }
        activeCall = nil
        callUUID = nil
        speakerOn = false
        lastRouteError = ""
        notifyListeners("callFailed", data: ["error": error.localizedDescription], retainUntilConsumed: true)
    }
}

// MARK: - Bridge View Controller

/// Capacitor 6+ only auto-registers plugins listed in capacitor.config.json's
/// package list (i.e. npm-installed plugins). Local, app-target plugins like
/// this one are NOT discovered automatically anymore — the legacy `.m`
/// `CAP_PLUGIN` macro no longer registers them — so the web layer would get
/// `{"code":"UNIMPLEMENTED"}` when calling TwilioVoice. Registering the
/// instance here in `capacitorDidLoad()` is the supported way to wire up a
/// local plugin. The storyboard's root view controller points at this class.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // Register the SAME instance the AppDelegate already used to stand up
        // VoIP push handling at launch, so JS bridge calls and the live push
        // registry share one plugin instance.
        bridge?.registerPluginInstance(TwilioVoicePlugin.shared)
    }
}
