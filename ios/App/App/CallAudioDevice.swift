//
//  CallAudioDevice.swift
//  App
//
//  A custom Twilio Voice `AudioDevice` that REPLACES Twilio's `DefaultAudioDevice`
//  so this app owns the `AVAudioSession` and the CoreAudio `VoiceProcessingIO`
//  audio unit directly.
//
//  WHY THIS EXISTS
//  ---------------
//  This app is a Capacitor app — the UI is a foreground `WKWebView`. WebKit's
//  media stack grabs an `AVAudioSession` of its own, and while that foreground
//  webview is alive it effectively co-owns the shared audio session. With
//  Twilio's `DefaultAudioDevice`, Twilio configures the session on its own
//  internal schedule (and re-applies its `DefaultAVAudioSessionConfigurationBlock`
//  whenever IT decides to). The net effect we observed: on a FOREGROUND INCOMING
//  call (app open -> answer -> tap Speaker), `overrideOutputAudioPort(.speaker)`
//  would "take" for a moment and then the route would silently fall back to the
//  receiver, because the webview's session ownership + Twilio's own session
//  config kept stomping our speaker override.
//
//  The fix: take ownership. By driving the `VoiceProcessingIO` audio unit
//  ourselves AND re-applying our preferred category/route (`.defaultToSpeaker` +
//  `overrideOutputAudioPort(.speaker)`) as part of EVERY audio-unit (re)start —
//  start, interruption-resume, and route-change re-assert — the speaker route
//  holds even against the webview. The audio-unit start is the moment iOS commits
//  the route, so re-applying the override right before/around start is what makes
//  it stick.
//
//  This file uses ONLY public CoreAudio / AVFoundation / TwilioVoice APIs — it is
//  App Store safe. No private APIs.
//
//  Audio path notes (no retain cycles):
//   - The render & capture callbacks are TOP-LEVEL C functions (not closures).
//   - `self` reaches them via the AudioDeviceContext refCon as
//     `Unmanaged.passUnretained` — we never retain `self` from the C side, and
//     the audio unit is torn down before `self` goes away, so the unretained
//     pointer is always valid while a callback can fire.
//

import Foundation
import AVFoundation
import TwilioVoice
import CoreAudio
import AudioToolbox

// MARK: - Tunables

private let kPreferredSampleRate: UInt32 = AudioFormat.SampleRate48000          // 48 kHz
private let kPreferredNumberOfChannels: Int = AudioFormat.ChannelsMono          // mono
private let kPreferredIOBufferDuration: TimeInterval = 0.01                     // ~480 frames @ 48k
private let kMaxAudioUnitInitializeAttempts = 5
private let kAudioUnitInitializeRetryDelay: TimeInterval = 0.1

// VoiceProcessingIO bus layout (matches Twilio's example):
//   bus 0 = output (to hardware / playout), bus 1 = input (from mic / capture).
private let kOutputBus: AudioUnitElement = 0
private let kInputBus: AudioUnitElement = 1

// MARK: - CallAudioDevice

final class CallAudioDevice: NSObject, AudioDevice {

    // MARK: Public speaker API (the plugin drives these)

    /// Whether the caller wants the loudspeaker. Reapplied on every (re)start of
    /// the audio unit and on route changes so the webview can't steal it back.
    private(set) var speakerEnabled: Bool = false

    /// Set the desired speaker state. If the unit is running, the new route is
    /// applied immediately on the main thread (AVAudioSession route mutations
    /// MUST run on the main thread or they silently no-op under Capacitor).
    func setSpeaker(_ on: Bool) {
        speakerEnabled = on
        guard audioUnit != nil else { return }
        runOnMain {
            self.configureAudioSession()
            self.overrideOutputPort()
        }
    }

    // MARK: Twilio contexts

    // Opaque `void *` handed to us by the SDK in start{Rendering,Capturing}.
    // We pass these (boxed) to the C callbacks so they can call
    // AudioDeviceReadRenderData / AudioDeviceWriteCaptureData.
    fileprivate var renderingContext: AudioDeviceContext?
    fileprivate var capturingContext: AudioDeviceContext?

    // MARK: CoreAudio state

    fileprivate var audioUnit: AudioUnit?

    /// Scratch AudioBufferList used by the capture callback to receive mic audio
    /// from AudioUnitRender before forwarding it to the SDK. Allocated once the
    /// format is known; freed on teardown.
    fileprivate var captureBufferList: UnsafeMutableAudioBufferListPointer?

    private var format: AudioFormat?

    private var isInterrupted = false
    private var observersRegistered = false

    // MARK: Lifecycle

    override init() {
        super.init()
    }

    deinit {
        unregisterObservers()
        teardownAudioUnit()
        freeCaptureBuffer()
    }

    // MARK: Format (shared by renderer + capturer)

    /// Single shared format: mono, 48 kHz, 16-bit PCM, framesPerBuffer derived
    /// from the 0.01s I/O buffer (~480). Cached lazily.
    private func sharedFormat() -> AudioFormat? {
        if let format = format { return format }
        let framesPerBuffer = Int(Double(kPreferredSampleRate) * kPreferredIOBufferDuration)
        let f = AudioFormat(channels: kPreferredNumberOfChannels,
                            sampleRate: kPreferredSampleRate,
                            framesPerBuffer: framesPerBuffer)
        format = f
        return f
    }

    // MARK: - AudioDeviceRenderer

    func renderFormat() -> AudioFormat? {
        return sharedFormat()
    }

    func initializeRenderer() -> Bool {
        // Format is fixed and always supported; nothing to pre-allocate here.
        return true
    }

    func startRendering(_ context: AudioDeviceContext) -> Bool {
        renderingContext = context
        return startAudioUnitIfNeeded()
    }

    func stopRendering() -> Bool {
        renderingContext = nil
        // Only fully tear the unit down once BOTH directions are stopped.
        if capturingContext == nil {
            teardownAudioUnit()
        }
        return true
    }

    // MARK: - AudioDeviceCapturer

    func captureFormat() -> AudioFormat? {
        return sharedFormat()
    }

    func initializeCapturer() -> Bool {
        return true
    }

    func startCapturing(_ context: AudioDeviceContext) -> Bool {
        capturingContext = context
        return startAudioUnitIfNeeded()
    }

    func stopCapturing() -> Bool {
        capturingContext = nil
        if renderingContext == nil {
            teardownAudioUnit()
        }
        return true
    }

    // MARK: - Audio session ownership (THE KEY PART)

    /// Configure the shared AVAudioSession the way a duplex VoIP call needs it,
    /// applying `.defaultToSpeaker` when the loudspeaker is requested. Run on the
    /// main thread. We re-run this around every audio-unit (re)start so the route
    /// is committed as part of the start and survives the foreground webview.
    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            var options: AVAudioSession.CategoryOptions = [.allowBluetoothHFP, .allowBluetoothA2DP]
            if speakerEnabled {
                options.insert(.defaultToSpeaker)
            }
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: options)
            try session.setPreferredSampleRate(Double(kPreferredSampleRate))
            try session.setPreferredIOBufferDuration(kPreferredIOBufferDuration)
        } catch {
            NSLog("[CallAudioDevice] configureAudioSession error: \(error.localizedDescription)")
        }
    }

    /// Push the actual output port to speaker/none. Separate from category config
    /// because iOS treats `.defaultToSpeaker` as the *default* while
    /// `overrideOutputAudioPort` is the *active* override — both are needed for a
    /// reliable, sticky speaker route. Main thread only.
    private func overrideOutputPort() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.overrideOutputAudioPort(speakerEnabled ? .speaker : .none)
        } catch {
            NSLog("[CallAudioDevice] overrideOutputAudioPort error: \(error.localizedDescription)")
        }
    }

    // MARK: - Audio unit start / stop / teardown

    /// Ensure the audio unit exists and is running. Idempotent: calling it for
    /// both the renderer and capturer start only builds/starts once.
    @discardableResult
    private func startAudioUnitIfNeeded() -> Bool {
        if audioUnit != nil {
            // Already running; just re-assert our preferred route so a second
            // start (render after capture, say) re-applies the speaker.
            runOnMain {
                self.configureAudioSession()
                self.overrideOutputPort()
            }
            return true
        }

        var ok = false
        // Session config + route override must happen on the main thread, and we
        // want it applied BEFORE we start the unit so iOS commits the route as
        // part of the start. Build + start the unit in the same hop for ordering.
        runOnMain {
            self.configureAudioSession()
            do {
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                NSLog("[CallAudioDevice] setActive(true) error: \(error.localizedDescription)")
            }
            guard self.setupAudioUnit() else {
                ok = false
                return
            }
            ok = self.startAudioUnit()
            // Re-assert the speaker AFTER start — the start is the moment the
            // route is actually committed, so overriding here is what sticks.
            self.overrideOutputPort()
        }

        if ok {
            registerObservers()
        }
        return ok
    }

    /// Build the duplex VoiceProcessingIO audio unit. Returns true on success.
    private func setupAudioUnit() -> Bool {
        guard let format = sharedFormat() else { return false }

        // Allocate the capture scratch buffer once we know the format.
        allocateCaptureBufferIfNeeded()

        var desc = AudioComponentDescription(
            componentType: kAudioUnitType_Output,
            componentSubType: kAudioUnitSubType_VoiceProcessingIO,
            componentManufacturer: kAudioUnitManufacturer_Apple,
            componentFlags: 0,
            componentFlagsMask: 0)

        guard let component = AudioComponentFindNext(nil, &desc) else {
            NSLog("[CallAudioDevice] VoiceProcessingIO component not found")
            return false
        }

        var unit: AudioUnit?
        var status = AudioComponentInstanceNew(component, &unit)
        guard status == noErr, let audioUnit = unit else {
            NSLog("[CallAudioDevice] AudioComponentInstanceNew failed: \(status)")
            return false
        }
        self.audioUnit = audioUnit

        // Enable output (bus 0) and input (bus 1).
        var enable: UInt32 = 1
        status = AudioUnitSetProperty(audioUnit, kAudioOutputUnitProperty_EnableIO,
                                      kAudioUnitScope_Output, kOutputBus,
                                      &enable, UInt32(MemoryLayout<UInt32>.size))
        guard status == noErr else { return failSetup("enable output bus", status) }

        status = AudioUnitSetProperty(audioUnit, kAudioOutputUnitProperty_EnableIO,
                                      kAudioUnitScope_Input, kInputBus,
                                      &enable, UInt32(MemoryLayout<UInt32>.size))
        guard status == noErr else { return failSetup("enable input bus", status) }

        // Stream format: applied to the input scope of the OUTPUT bus (what we
        // feed the speaker) and the output scope of the INPUT bus (what we read
        // from the mic). This matches Twilio's example bus/scope pairing.
        var asbd = format.streamDescription()

        status = AudioUnitSetProperty(audioUnit, kAudioUnitProperty_StreamFormat,
                                      kAudioUnitScope_Input, kOutputBus,
                                      &asbd, UInt32(MemoryLayout<AudioStreamBasicDescription>.size))
        guard status == noErr else { return failSetup("stream format (output bus)", status) }

        status = AudioUnitSetProperty(audioUnit, kAudioUnitProperty_StreamFormat,
                                      kAudioUnitScope_Output, kInputBus,
                                      &asbd, UInt32(MemoryLayout<AudioStreamBasicDescription>.size))
        guard status == noErr else { return failSetup("stream format (input bus)", status) }

        // Render (playout) callback on the output bus. refCon = unretained self.
        let selfRef = UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())

        var renderCallback = AURenderCallbackStruct(
            inputProc: CallAudioDevicePlayoutCallback,
            inputProcRefCon: selfRef)
        status = AudioUnitSetProperty(audioUnit, kAudioUnitProperty_SetRenderCallback,
                                      kAudioUnitScope_Output, kOutputBus,
                                      &renderCallback, UInt32(MemoryLayout<AURenderCallbackStruct>.size))
        guard status == noErr else { return failSetup("set render callback", status) }

        // Capture (record) callback on the input bus.
        var captureCallback = AURenderCallbackStruct(
            inputProc: CallAudioDeviceRecordCallback,
            inputProcRefCon: selfRef)
        status = AudioUnitSetProperty(audioUnit, kAudioOutputUnitProperty_SetInputCallback,
                                      kAudioUnitScope_Input, kInputBus,
                                      &captureCallback, UInt32(MemoryLayout<AURenderCallbackStruct>.size))
        guard status == noErr else { return failSetup("set capture callback", status) }

        // Initialize with retry — VoiceProcessingIO sometimes fails its first
        // init right after CallKit activates the session.
        status = AudioUnitInitialize(audioUnit)
        var attempts = 0
        while status != noErr && attempts < kMaxAudioUnitInitializeAttempts {
            attempts += 1
            NSLog("[CallAudioDevice] AudioUnitInitialize failed (\(status)), retry \(attempts)")
            Thread.sleep(forTimeInterval: kAudioUnitInitializeRetryDelay)
            status = AudioUnitInitialize(audioUnit)
        }
        guard status == noErr else { return failSetup("AudioUnitInitialize", status) }

        return true
    }

    private func failSetup(_ what: String, _ status: OSStatus) -> Bool {
        NSLog("[CallAudioDevice] setup failed at \(what): \(status)")
        teardownAudioUnit()
        return false
    }

    private func startAudioUnit() -> Bool {
        guard let audioUnit = audioUnit else { return false }
        let status = AudioOutputUnitStart(audioUnit)
        if status != noErr {
            NSLog("[CallAudioDevice] AudioOutputUnitStart failed: \(status)")
            return false
        }
        return true
    }

    private func stopAudioUnit() -> Bool {
        guard let audioUnit = audioUnit else { return false }
        let status = AudioOutputUnitStop(audioUnit)
        if status != noErr {
            NSLog("[CallAudioDevice] AudioOutputUnitStop failed: \(status)")
            return false
        }
        return true
    }

    private func teardownAudioUnit() {
        guard let audioUnit = audioUnit else { return }
        AudioOutputUnitStop(audioUnit)
        AudioUnitUninitialize(audioUnit)
        AudioComponentInstanceDispose(audioUnit)
        self.audioUnit = nil
    }

    // MARK: - Capture scratch buffer

    private func allocateCaptureBufferIfNeeded() {
        guard captureBufferList == nil else { return }
        // One mono buffer. mData is left NULL — AudioUnitRender fills it from the
        // unit's own buffers (we request null-buffer "pull" rendering), and the
        // record callback reads mData back out afterward.
        let list = AudioBufferList.allocate(maximumBuffers: 1)
        list[0] = AudioBuffer(mNumberChannels: UInt32(kPreferredNumberOfChannels),
                              mDataByteSize: 0,
                              mData: nil)
        captureBufferList = list
    }

    private func freeCaptureBuffer() {
        if let list = captureBufferList {
            free(list.unsafeMutablePointer)
            captureBufferList = nil
        }
    }

    // MARK: - Notifications: interruption + route change

    private func registerObservers() {
        guard !observersRegistered else { return }
        observersRegistered = true
        let nc = NotificationCenter.default
        nc.addObserver(self,
                       selector: #selector(handleInterruption(_:)),
                       name: AVAudioSession.interruptionNotification,
                       object: nil)
        nc.addObserver(self,
                       selector: #selector(handleRouteChange(_:)),
                       name: AVAudioSession.routeChangeNotification,
                       object: nil)
    }

    private func unregisterObservers() {
        guard observersRegistered else { return }
        observersRegistered = false
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard
            let info = notification.userInfo,
            let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: raw)
        else { return }

        // Stop/start on the SDK worker thread to stay thread-safe with the
        // audio path, as the Twilio example does.
        let context = renderingContext ?? capturingContext
        switch type {
        case .began:
            isInterrupted = true
            if let context = context {
                AudioDeviceExecuteWorkerBlock(context: context) { [weak self] in
                    _ = self?.stopAudioUnit()
                }
            } else {
                _ = stopAudioUnit()
            }
        case .ended:
            isInterrupted = false
            if let context = context {
                AudioDeviceExecuteWorkerBlock(context: context) { [weak self] in
                    guard let self = self else { return }
                    self.runOnMain {
                        self.configureAudioSession()
                        try? AVAudioSession.sharedInstance().setActive(true)
                        _ = self.startAudioUnit()
                        self.overrideOutputPort()
                    }
                }
            }
        @unknown default:
            break
        }
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        // If the user wants the speaker but the current output drifted off it
        // (e.g. WebKit or a transient device change pulled the route back to the
        // receiver), re-assert. Skip while interrupted.
        guard speakerEnabled, !isInterrupted else { return }

        let session = AVAudioSession.sharedInstance()
        let onSpeaker = session.currentRoute.outputs.contains { $0.portType == .builtInSpeaker }
        guard !onSpeaker else { return }

        runOnMain {
            self.configureAudioSession()
            self.overrideOutputPort()
        }
    }

    // MARK: - Helpers

    private func runOnMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }
}

// MARK: - Top-level C callbacks (C-compatible function pointers, no captures)

/// Playout: pull SDK render data into the output AudioBufferList. Silence if no
/// rendering context yet.
private func CallAudioDevicePlayoutCallback(
    _ refCon: UnsafeMutableRawPointer,
    _ actionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
    _ timestamp: UnsafePointer<AudioTimeStamp>,
    _ busNumber: UInt32,
    _ numFrames: UInt32,
    _ bufferList: UnsafeMutablePointer<AudioBufferList>?
) -> OSStatus {
    guard let bufferList = bufferList else { return noErr }
    let abl = UnsafeMutableAudioBufferListPointer(bufferList)
    guard abl.count > 0 else { return noErr }

    let buffer = abl[0]
    let byteSize = Int(buffer.mDataByteSize)
    guard let data = buffer.mData else {
        actionFlags.pointee.insert(.unitRenderAction_OutputIsSilence)
        return noErr
    }

    let device = Unmanaged<CallAudioDevice>.fromOpaque(refCon).takeUnretainedValue()
    guard let context = device.renderingContext else {
        // No SDK audio yet — emit silence.
        memset(data, 0, byteSize)
        actionFlags.pointee.insert(.unitRenderAction_OutputIsSilence)
        return noErr
    }

    let typed = data.assumingMemoryBound(to: Int8.self)
    AudioDeviceReadRenderData(context: context, data: typed, sizeInBytes: byteSize)
    return noErr
}

/// Record: render the mic via AudioUnitRender, then hand the captured PCM to the
/// SDK with AudioDeviceWriteCaptureData.
private func CallAudioDeviceRecordCallback(
    _ refCon: UnsafeMutableRawPointer,
    _ actionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
    _ timestamp: UnsafePointer<AudioTimeStamp>,
    _ busNumber: UInt32,
    _ numFrames: UInt32,
    _ bufferList: UnsafeMutablePointer<AudioBufferList>?
) -> OSStatus {
    let device = Unmanaged<CallAudioDevice>.fromOpaque(refCon).takeUnretainedValue()

    guard
        let context = device.capturingContext,
        let audioUnit = device.audioUnit,
        let captureList = device.captureBufferList
    else { return noErr }

    // Request a null-buffer render: the unit fills its own buffer and points
    // mData at it. mNumberChannels=1, mData=NULL, byteSize sized for the request.
    captureList[0].mNumberChannels = UInt32(kPreferredNumberOfChannels)
    captureList[0].mDataByteSize = numFrames * UInt32(MemoryLayout<Int16>.size) * UInt32(kPreferredNumberOfChannels)
    captureList[0].mData = nil

    let status = AudioUnitRender(audioUnit, actionFlags, timestamp,
                                 kInputBus, numFrames, captureList.unsafeMutablePointer)
    guard status == noErr else { return status }

    guard let data = captureList[0].mData else { return noErr }
    let byteSize = Int(captureList[0].mDataByteSize)
    let typed = data.assumingMemoryBound(to: Int8.self)
    AudioDeviceWriteCaptureData(context: context, data: typed, sizeInBytes: byteSize)
    return noErr
}
