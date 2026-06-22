import Foundation
import UIKit
import AVFoundation
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

    @objc func setSpeaker(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        // Drive speaker state on shared so the route-change watchdog and the
        // didActivate reapply (both registered on shared's CallKit provider)
        // see the user's selection. On a JS-routed second instance, self.speakerOn
        // would be stranded and the override would never hold.
        let shared = TwilioVoicePlugin.shared
        shared.speakerOn = on
        shared.speakerReassertAttempts = 0
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
        }
    }

    /// Forces the live call's audio route to the speaker (or back to the
    /// receiver). Must be called on the main thread.
    private func applySpeakerRoute(_ on: Bool) {
        let applyRoute = {
            let session = AVAudioSession.sharedInstance()
            do {
                // A bare overrideOutputAudioPort(.speaker) is transient under
                // CallKit: the next session reconfiguration (Twilio audio-unit
                // restart, route recompute) silently reverts to the earpiece —
                // the button stays "on" but the volume never changes. Adding
                // .defaultToSpeaker to the category makes speaker the session's
                // standing preference, which survives those cycles; the
                // override still gives the immediate switch. Bluetooth options
                // mirror Twilio's default config so paired headsets keep
                // working and win over .defaultToSpeaker when connected.
                var options: AVAudioSession.CategoryOptions = [
                    .allowBluetoothHFP, .allowBluetoothA2DP,
                ]
                if on { options.insert(.defaultToSpeaker) }
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: options)
                try session.overrideOutputAudioPort(on ? .speaker : .none)
            } catch {
                tvLog.error("setSpeaker(\(on, privacy: .public)) failed: \(error.localizedDescription, privacy: .public)")
            }
            // What iOS ACTUALLY routed to (expect builtInSpeaker when on=true,
            // receiver when off) plus the session state — the ground truth when
            // the toggle doesn't match the audible output.
            let outputs = session.currentRoute.outputs
                .map { $0.portType.rawValue }
                .joined(separator: ",")
            tvLog.log("setSpeaker(\(on, privacy: .public)) cat=\(session.category.rawValue, privacy: .public) mode=\(session.mode.rawValue, privacy: .public) outputs=[\(outputs, privacy: .public)]")
        }
        // Twilio's DefaultAudioDevice owns the AVAudioSession, so routing
        // changes must also live inside the device's configuration block —
        // that's what re-runs on each internal audio-unit cycle.
        if let audioDevice = TwilioVoiceSDK.audioDevice as? DefaultAudioDevice {
            audioDevice.block = {
                DefaultAudioDevice.DefaultAVAudioSessionConfigurationBlock()
                applyRoute()
            }
            audioDevice.block()
        } else {
            applyRoute()
        }
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
        activeCall?.disconnect()
        activeCall = nil
    }

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let callInvite = self.callInvite else {
            action.fail()
            return
        }
        let acceptOptions = AcceptOptions(callInvite: callInvite) { _ in }
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
        notifyListeners("callConnected", data: ["sid": call.sid ?? ""], retainUntilConsumed: true)
    }

    public func callDidDisconnect(call: Call, error: Error?) {
        if let uuid = self.callUUID {
            callKitProvider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        }
        activeCall = nil
        callUUID = nil
        speakerOn = false
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
