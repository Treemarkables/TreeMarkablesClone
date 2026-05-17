#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift plugin with Capacitor's Objective-C bridge.
// This file must be compiled alongside TwilioVoicePlugin.swift.
CAP_PLUGIN(TwilioVoicePlugin, "TwilioVoice",
    CAP_PLUGIN_METHOD(register, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(unregister, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(answer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(reject, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(hangup, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(mute, CAPPluginReturnPromise);
)
