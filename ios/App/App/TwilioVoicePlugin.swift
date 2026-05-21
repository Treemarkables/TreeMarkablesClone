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
            self.registerForVoIPPush()
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
        // Assign to stored property so the registry — and therefore the delegate
        // callbacks — remain alive for the lifetime of the plugin instance.
        let registry = PKPushRegistry(queue: DispatchQueue.main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        self.voipRegistry = registry
    }

    // MARK: - Incoming Call Presentation

    private func reportIncomingCall(from callInvite: CallInvite) {
        self.callInvite = callInvite
        let uuid = UUID()
        self.callUUID = uuid

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

        notifyListeners("incomingCall", data: [
            "from": callerNumber,
            "to": callInvite.to ?? "",
            "callSid": callInvite.callSid,
            "callerName": knownName ?? "",
        ])
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
        guard type == .voIP, let token = self.accessToken else { return }
        let deviceToken = pushCredentials.token
        self.deviceToken = deviceToken

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
        notifyListeners("callCancelled", data: [:])
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
        notifyListeners("callAnswered", data: [:])
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        callInvite?.reject()
        callInvite = nil
        activeCall?.disconnect()
        activeCall = nil
        callUUID = nil
        action.fulfill()
        notifyListeners("callEnded", data: [:])
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
        notifyListeners("callConnected", data: ["sid": call.sid ?? ""])
    }

    public func callDidDisconnect(call: Call, error: Error?) {
        if let uuid = self.callUUID {
            callKitProvider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        }
        activeCall = nil
        callUUID = nil
        notifyListeners("callDisconnected", data: [
            "error": error?.localizedDescription ?? "",
        ])
    }

    public func callDidFailToConnect(call: Call, error: Error) {
        if let uuid = self.callUUID {
            callKitProvider?.reportCall(with: uuid, endedAt: Date(), reason: .failed)
        }
        activeCall = nil
        callUUID = nil
        notifyListeners("callFailed", data: ["error": error.localizedDescription])
    }
}
