#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift plugin with Capacitor's Objective-C bridge.
// This file must be compiled alongside TwilioVoicePlugin.swift.
//
// CRITICAL: this method list is THE list the bridge consults when dispatching
// JS calls — the Swift class's `pluginMethods` property does NOT extend it.
// Any @objc plugin method missing here is rejected as "not implemented"
// before Swift ever runs. That is exactly how the in-call Speaker toggle was
// broken for months (setSpeaker absent → silently rejected on every build
// 12-36, while mute/hangup — listed below — worked): every new Swift method
// MUST be added here too.
CAP_PLUGIN(TwilioVoicePlugin, "TwilioVoice",
    CAP_PLUGIN_METHOD(register, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(unregister, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(answer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(reject, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(hangup, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(mute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setSpeaker, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(sendDigits, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(showAudioRoutePicker, CAPPluginReturnPromise);
)
