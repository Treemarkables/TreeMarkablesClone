import Foundation
import UIKit
import AVFoundation
import Capacitor
import TwilioVoice
import PushKit
import CallKit

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

    // MARK: - Plugin Lifecycle

    public override func load() {
        super.load()
        DispatchQueue.main.async {
            self.setupCallKit()
            // Stand up the VoIP push registry at launch — NOT lazily inside
            // register() (which only runs once the webview has loaded and JS
            // calls it). When a call cold-launches the app (screen locked or
            // app killed), iOS delivers the VoIP push during launch and requires
            // a live PKPushRegistry delegate to receive it and report a call to
            // CallKit. If the registry isn't up yet, the push is dropped and the
            // phone never rings. Handling an incoming push needs no access token,
            // so this is safe to do before JS hands one over.
            self.registerForVoIPPush()
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
        guard let callInvite = self.callInvite else {
            call.reject("No active call invite")
            return
        }
        let acceptOptions = AcceptOptions(callInvite: callInvite) { _ in }
        self.activeCall = callInvite.accept(options: acceptOptions, delegate: self)
        self.callInvite = nil
        call.resolve()
    }

    @objc func reject(_ call: CAPPluginCall) {
        self.callInvite?.reject()
        self.callInvite = nil
        if let uuid = self.callUUID {
            let action = CXEndCallAction(call: uuid)
            self.callKitCallController.request(CXTransaction(action: action)) { _ in }
            self.callUUID = nil
        }
        call.resolve()
    }

    @objc func hangup(_ call: CAPPluginCall) {
        self.activeCall?.disconnect()
        call.resolve()
    }

    @objc func mute(_ call: CAPPluginCall) {
        let isMuted = call.getBool("muted") ?? true
        self.activeCall?.isMuted = isMuted
        call.resolve()
    }

    @objc func setSpeaker(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        let applyRoute = {
            do {
                try AVAudioSession.sharedInstance()
                    .overrideOutputAudioPort(on ? .speaker : .none)
            } catch {
                NSLog("[TwilioVoice] Failed to set speaker route: \(error.localizedDescription)")
            }
        }
        // Twilio's DefaultAudioDevice owns the AVAudioSession, so a bare
        // overrideOutputAudioPort gets reverted on the next audio-unit cycle.
        // Routing changes must run inside the device's configuration block.
        if let audioDevice = TwilioVoiceSDK.audioDevice as? DefaultAudioDevice {
            audioDevice.block = {
                DefaultAudioDevice.DefaultAVAudioSessionConfigurationBlock()
                applyRoute()
            }
            audioDevice.block()
        } else {
            applyRoute()
        }
        call.resolve()
    }

    // MARK: - CallKit Setup

    private func setupCallKit() {
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
        action.fulfill()
        notifyListeners("callEnded", data: [:], retainUntilConsumed: true)
    }

    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        activeCall?.isMuted = action.isMuted
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        (TwilioVoiceSDK.audioDevice as? DefaultAudioDevice)?.isEnabled = true
    }

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        (TwilioVoiceSDK.audioDevice as? DefaultAudioDevice)?.isEnabled = false
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
        bridge?.registerPluginInstance(TwilioVoicePlugin())
    }
}
