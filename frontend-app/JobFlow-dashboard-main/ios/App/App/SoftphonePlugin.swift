// ============================================================================
// SoftphonePlugin.swift
// iOS Capacitor plugin stub — registers the "Softphone" plugin name so the
// JS bridge doesn't throw. All methods are no-ops; iOS calling uses the
// tel: fallback in useSoftphone.js until native SIP is implemented.
// ============================================================================

import Foundation
import Capacitor

@objc(SoftphonePlugin)
public class SoftphonePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "SoftphonePlugin"
    public let jsName = "Softphone"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "makeCall",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "answerCall",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "declineCall",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hangup",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMuted",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeaker",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus",    returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "destroy",      returnType: CAPPluginReturnPromise),
    ]

    @objc func initialize(_ call: CAPPluginCall)  { call.resolve() }
    @objc func makeCall(_ call: CAPPluginCall)     { call.resolve() }
    @objc func answerCall(_ call: CAPPluginCall)   { call.resolve() }
    @objc func declineCall(_ call: CAPPluginCall)  { call.resolve() }
    @objc func hangup(_ call: CAPPluginCall)       { call.resolve() }
    @objc func setMuted(_ call: CAPPluginCall)     { call.resolve() }
    @objc func setSpeaker(_ call: CAPPluginCall)   { call.resolve() }
    @objc func destroy(_ call: CAPPluginCall)      { call.resolve() }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(["callState": "idle", "initialized": false, "muted": false])
    }
}
