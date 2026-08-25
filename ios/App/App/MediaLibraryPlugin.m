#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift plugin with Capacitor's Objective-C bridge.
// This file must be compiled alongside MediaLibraryPlugin.swift.
//
// CRITICAL (learned the hard way on TwilioVoicePlugin): this method list is THE
// list the bridge consults when dispatching JS calls — the Swift class's
// `pluginMethods` property does NOT extend it. Any @objc plugin method missing
// here is rejected as "not implemented" before Swift ever runs. Every new Swift
// method MUST be added here too.
CAP_PLUGIN(MediaLibraryPlugin, "MediaLibrary",
    CAP_PLUGIN_METHOD(saveToPhotos, CAPPluginReturnPromise);
)
