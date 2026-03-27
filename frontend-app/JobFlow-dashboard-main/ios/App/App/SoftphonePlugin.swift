// ============================================================================
// SoftphonePlugin.swift
// iOS native Capacitor plugin for SIP calling via Linphone SDK.
// Mirrors the Android SoftphonePlugin.java / SoftphoneManager.java exactly.
// ============================================================================

import Foundation
import Capacitor
import linphonesw

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

    private var mCore: Core?
    private var mDelegate: CoreDelegate?
    private var mTimer: Timer?
    private var isInitialized = false

    // =========================================================================
    // INITIALIZE
    // =========================================================================
    @objc func initialize(_ call: CAPPluginCall) {
        guard let sipDomain   = call.getString("sipDomain"),
              let sipUser     = call.getString("sipUser"),
              let sipPassword = call.getString("sipPassword") else {
            call.reject("Missing SIP credentials")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            do {
                if self.mCore != nil {
                    self.register(domain: sipDomain, user: sipUser, password: sipPassword)
                    call.resolve()
                    return
                }

                let core = try Factory.Instance.createCore(configPath: nil, factoryConfigPath: nil, systemContext: nil)
                core.mediaEncryption = .None
                self.mCore = core
                self.attachDelegate()
                self.register(domain: sipDomain, user: sipUser, password: sipPassword)
                try core.start()

                self.mTimer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] _ in
                    self?.mCore?.iterate()
                }

                self.isInitialized = true
                NSLog("[SoftphonePlugin] Initialized: \(sipUser)@\(sipDomain)")
                call.resolve()
            } catch {
                NSLog("[SoftphonePlugin] Init failed: \(error)")
                call.reject("Init failed: \(error.localizedDescription)")
            }
        }
    }

    // =========================================================================
    // REGISTER
    // =========================================================================
    private func register(domain: String, user: String, password: String) {
        guard let core = mCore else { return }
        do {
            for account in core.accountList { core.removeAccount(account: account) }
            core.clearAllAuthInfo()

            let authInfo = try Factory.Instance.createAuthInfo(
                username: user, userid: user,
                passwd: password, ha1: nil, realm: nil, domain: domain
            )
            core.addAuthInfo(info: authInfo)

            let params = try core.createAccountParams()
            if let identity = try? Factory.Instance.createAddress(addr: "sip:\(user)@\(domain)") {
                try? params.setIdentityaddress(newValue: identity)
            }
            if let serverAddr = try? Factory.Instance.createAddress(addr: "sip:\(domain)") {
                serverAddr.transport = .Udp
                try? params.setServeraddress(newValue: serverAddr)
            }
            params.registerEnabled = true

            let account = try core.createAccount(params: params)
            core.addAccount(account: account)
            core.defaultAccount = account
        } catch {
            NSLog("[SoftphonePlugin] Register failed: \(error)")
        }
    }

    // =========================================================================
    // DELEGATE
    // =========================================================================
    private func attachDelegate() {
        let delegate = CoreDelegateStub(
            onRegistrationStateChanged: { [weak self] (_, _, state, message) in
                guard let self = self else { return }
                let s: String
                switch state {
                case .None:     s = "none"
                case .Progress: s = "progress"
                case .Ok:       s = "ok"
                case .Cleared:  s = "cleared"
                case .Failed:   s = "failed"
                default:        s = "none"
                }
                self.notifyListeners("registrationState", data: ["state": s, "message": message])
            },
            onCallStateChanged: { [weak self] (_, call, state, message) in
                guard let self = self else { return }
                let callerNumber = call.remoteAddress?.asStringUriOnly() ?? ""
                let s: String
                switch state {
                case .Idle:               s = "idle"
                case .IncomingReceived:   s = "incomingreceived"
                case .OutgoingInit:       s = "outgoinginit"
                case .OutgoingProgress:   s = "outgoingprogress"
                case .OutgoingRinging:    s = "outgoingearlymedia"
                case .OutgoingEarlyMedia: s = "outgoingearlymedia"
                case .Connected:          s = "connected"
                case .StreamsRunning:     s = "streamsrunning"
                case .End:                s = "end"
                case .Released:           s = "released"
                case .Error:              s = "error"
                default:                  s = "idle"
                }
                self.notifyListeners("callState", data: ["state": s, "callerNumber": callerNumber, "message": message])
            }
        )
        mDelegate = delegate
        mCore?.addDelegate(delegate: delegate)
    }

    // =========================================================================
    // MAKE CALL
    // =========================================================================
    @objc func makeCall(_ call: CAPPluginCall) {
        guard let phoneNumber = call.getString("phoneNumber") else {
            call.reject("phoneNumber required"); return
        }
        DispatchQueue.main.async { [weak self] in
            guard let core = self?.mCore else { call.reject("SIP not initialized"); return }
            do {
                if let addr = try? core.interpretUrl(url: phoneNumber, applyInternationalPrefix: true) {
                    try core.inviteAddress(addr: addr)
                    call.resolve()
                } else {
                    call.reject("Invalid phone number")
                }
            } catch {
                call.reject("makeCall failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func answerCall(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            if let c = self?.mCore?.currentCall, c.state == .IncomingReceived { try? c.accept() }
            call.resolve()
        }
    }

    @objc func declineCall(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            try? self?.mCore?.currentCall?.decline(reason: .Declined)
            call.resolve()
        }
    }

    @objc func hangup(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            try? self?.mCore?.currentCall?.terminate()
            call.resolve()
        }
    }

    @objc func setMuted(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        DispatchQueue.main.async { [weak self] in
            self?.mCore?.currentCall?.microphoneMuted = muted
            call.resolve()
        }
    }

    @objc func setSpeaker(_ call: CAPPluginCall) {
        let speaker = call.getBool("speaker") ?? false
        DispatchQueue.main.async { [weak self] in
            guard let core = self?.mCore else { call.resolve(); return }
            let target: AudioDeviceType = speaker ? .Speaker : .Earpiece
            for device in core.audioDevices {
                if device.type == target && device.hasCapability(capability: .CapabilityPlay) {
                    core.outputAudioDevice = device; break
                }
            }
            call.resolve()
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(["callState": "idle", "initialized": isInitialized, "muted": mCore?.currentCall?.microphoneMuted ?? false])
    }

    @objc func destroy(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.mTimer?.invalidate(); self?.mTimer = nil
            self?.mCore?.stop(); self?.mCore = nil
            self?.isInitialized = false
            call.resolve()
        }
    }
}
