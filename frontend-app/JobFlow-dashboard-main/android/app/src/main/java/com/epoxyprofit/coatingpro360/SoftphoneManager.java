package com.epoxyprofit.coatingpro360;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.linphone.core.Account;
import org.linphone.core.AccountParams;
import org.linphone.core.Address;
import org.linphone.core.AuthInfo;
import org.linphone.core.Call;
import org.linphone.core.Core;
import org.linphone.core.CoreListenerStub;
import org.linphone.core.Factory;
import org.linphone.core.MediaEncryption;
import org.linphone.core.RegistrationState;
import org.linphone.core.TransportType;

/**
 * SoftphoneManager — wraps the Linphone Core for SIP calling.
 * Singleton pattern so the Core persists across plugin calls.
 */
public class SoftphoneManager {

    private static final String TAG = "SoftphoneManager";

    public interface SoftphoneListener {
        void onRegistrationState(String state, String message);
        void onCallState(String state, String callerNumber, String message);
        void onError(String message);
    }

    private static SoftphoneManager instance;

    private Core core;
    private Handler iterateHandler;
    private SoftphoneListener listener;
    private boolean initialized = false;

    private final Runnable iterateRunnable = new Runnable() {
        @Override
        public void run() {
            if (core != null) {
                core.iterate();
            }
            if (iterateHandler != null) {
                iterateHandler.postDelayed(this, 20);
            }
        }
    };

    private SoftphoneManager() {}

    public static synchronized SoftphoneManager getInstance() {
        if (instance == null) {
            instance = new SoftphoneManager();
        }
        return instance;
    }

    public void setListener(SoftphoneListener listener) {
        this.listener = listener;
    }

    // =========================================================================
    // INITIALIZE — sets up Core and registers with SIP server
    // =========================================================================
    public void initialize(Context context, String sipDomain, String sipUser, String sipPassword, boolean incomingEnabled) {
        try {
            if (core != null) {
                // Already initialized — just update registration
                Log.d(TAG, "Core already initialized, re-registering");
                register(sipDomain, sipUser, sipPassword);
                return;
            }

            Factory factory = Factory.instance();
            factory.setDebugMode(true, TAG);

            core = factory.createCore(null, null, context);
            core.setMediaEncryption(MediaEncryption.None);

            // Add Core listener
            core.addListener(coreListener);

            // Run iterate on the main thread — required for Android DNS resolution.
            // c-ares (Linphone's DNS resolver) gets EPERM when run from a background
            // HandlerThread on Android 9+. Main thread has proper network access.
            iterateHandler = new Handler(Looper.getMainLooper());

            // Start Core before registering accounts
            core.start();

            // Start the iterate loop
            iterateHandler.post(iterateRunnable);

            // Register with SIP server (must be after core.start())
            register(sipDomain, sipUser, sipPassword);

            initialized = true;
            Log.d(TAG, "SoftphoneManager initialized for " + sipUser + "@" + sipDomain);

        } catch (Exception e) {
            Log.e(TAG, "Init failed: " + e.getMessage());
            if (listener != null) listener.onError("Init failed: " + e.getMessage());
        }
    }

    // =========================================================================
    // REGISTER
    // =========================================================================
    private void register(String sipDomain, String sipUser, String sipPassword) {
        // Clear existing accounts
        for (Account account : core.getAccountList()) {
            core.removeAccount(account);
        }
        core.clearAllAuthInfo();

        // Auth info
        AuthInfo authInfo = Factory.instance().createAuthInfo(
            sipUser, sipUser, sipPassword, null, null, sipDomain
        );
        core.addAuthInfo(authInfo);

        // Account params
        AccountParams params = core.createAccountParams();

        Address identity = Factory.instance().createAddress("sip:" + sipUser + "@" + sipDomain);
        if (identity == null) {
            if (listener != null) listener.onError("Invalid SIP identity");
            return;
        }
        params.setIdentityAddress(identity);

        Address serverAddr = Factory.instance().createAddress("sip:" + sipDomain);
        if (serverAddr != null) {
            serverAddr.setTransport(TransportType.Tcp);
            params.setServerAddress(serverAddr);
        }

        params.setRegisterEnabled(true);

        Account account = core.createAccount(params);
        core.addAccount(account);
        core.setDefaultAccount(account);
    }

    // =========================================================================
    // MAKE OUTGOING CALL
    // =========================================================================
    public void makeCall(String phoneNumber) {
        if (core == null) {
            if (listener != null) listener.onError("SIP not initialized");
            return;
        }
        try {
            Address remoteAddress = core.interpretUrl(phoneNumber);
            if (remoteAddress == null) {
                if (listener != null) listener.onError("Invalid phone number: " + phoneNumber);
                return;
            }
            core.inviteAddress(remoteAddress);
            Log.d(TAG, "Calling: " + phoneNumber);
        } catch (Exception e) {
            Log.e(TAG, "makeCall failed: " + e.getMessage());
            if (listener != null) listener.onError("Call failed: " + e.getMessage());
        }
    }

    // =========================================================================
    // ANSWER INCOMING CALL
    // =========================================================================
    public void answerCall() {
        if (core == null) return;
        Call call = core.getCurrentCall();
        if (call != null && call.getState() == Call.State.IncomingReceived) {
            call.accept();
        }
    }

    // =========================================================================
    // DECLINE INCOMING CALL
    // =========================================================================
    public void declineCall() {
        if (core == null) return;
        Call call = core.getCurrentCall();
        if (call != null) {
            call.decline(org.linphone.core.Reason.Declined);
        }
    }

    // =========================================================================
    // HANGUP
    // =========================================================================
    public void hangup() {
        if (core == null) return;
        Call call = core.getCurrentCall();
        if (call != null) {
            call.terminate();
        }
    }

    // =========================================================================
    // MUTE / UNMUTE
    // =========================================================================
    public void setMuted(boolean muted) {
        if (core == null) return;
        Call call = core.getCurrentCall();
        if (call != null) {
            call.setMicrophoneMuted(muted);
        }
    }

    public boolean isMuted() {
        if (core == null) return false;
        Call call = core.getCurrentCall();
        return call != null && call.getMicrophoneMuted();
    }

    // =========================================================================
    // SPEAKER
    // =========================================================================
    public void setSpeaker(boolean speaker) {
        if (core == null) return;
        String targetType = speaker ? "Speaker" : "Earpiece";
        for (org.linphone.core.AudioDevice device : core.getAudioDevices()) {
            if (device.getType().toString().equalsIgnoreCase(targetType)
                    && device.hasCapability(org.linphone.core.AudioDevice.Capabilities.CapabilityPlay)) {
                core.setOutputAudioDevice(device);
                return;
            }
        }
    }

    // =========================================================================
    // SEND DTMF TONE
    // =========================================================================
    public void sendDtmf(String tone) {
        if (core == null) return;
        Call call = core.getCurrentCall();
        if (call != null && !tone.isEmpty()) {
            call.sendDtmf(tone.charAt(0));
        }
    }

    // =========================================================================
    // STATUS
    // =========================================================================
    public String getCallState() {
        if (core == null) return "idle";
        Call call = core.getCurrentCall();
        if (call == null) return "idle";
        return call.getState().toString().toLowerCase();
    }

    public boolean isInitialized() {
        return initialized && core != null;
    }

    // =========================================================================
    // UNREGISTER / DESTROY
    // =========================================================================
    public void destroy() {
        if (iterateHandler != null) {
            iterateHandler.removeCallbacks(iterateRunnable);
            iterateHandler = null;
        }
        if (core != null) {
            core.stop();
            core = null;
        }
        initialized = false;
    }

    // =========================================================================
    // CORE LISTENER — fires events back to the plugin
    // =========================================================================
    private final CoreListenerStub coreListener = new CoreListenerStub() {

        public void onRegistrationStateChanged(Core core, Account account, RegistrationState state, String message) {
            Log.d(TAG, "Registration state: " + state + " — " + message);
            if (listener != null) {
                listener.onRegistrationState(state.toString().toLowerCase(), message);
            }
        }

        public void onCallStateChanged(Core core, Call call, Call.State state, String message) {
            Log.d(TAG, "Call state: " + state + " — " + message);
            String callerNumber = "";
            if (call.getRemoteAddress() != null) {
                callerNumber = call.getRemoteAddress().asStringUriOnly();
            }
            if (listener != null) {
                listener.onCallState(state.toString().toLowerCase(), callerNumber, message);
            }
        }
    };
}
