package com.epoxyprofit.coatingpro360;

import android.Manifest;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * SoftphonePlugin — Capacitor bridge between JavaScript and SoftphoneManager.
 *
 * JS usage:
 *   import { Softphone } from '../plugins/Softphone';
 *
 *   await Softphone.initialize({ sipDomain, sipUser, sipPassword, incomingEnabled });
 *   await Softphone.makeCall({ phoneNumber: '+15555555555' });
 *   await Softphone.hangup();
 *   await Softphone.setMuted({ muted: true });
 *   await Softphone.setSpeaker({ speaker: true });
 *   await Softphone.answerCall();
 *   await Softphone.declineCall();
 *
 *   Softphone.addListener('callState', (data) => { ... });
 *   Softphone.addListener('registrationState', (data) => { ... });
 */
@CapacitorPlugin(
    name = "Softphone",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class SoftphonePlugin extends Plugin {

    private static final String TAG = "SoftphonePlugin";

    @Override
    public void load() {
        // Attach listener so SoftphoneManager can fire events back to JS
        SoftphoneManager.getInstance().setListener(new SoftphoneManager.SoftphoneListener() {
            @Override
            public void onRegistrationState(String state, String message) {
                JSObject data = new JSObject();
                data.put("state", state);
                data.put("message", message);
                notifyListeners("registrationState", data);
            }

            @Override
            public void onCallState(String state, String callerNumber, String message) {
                JSObject data = new JSObject();
                data.put("state", state);
                data.put("callerNumber", callerNumber);
                data.put("message", message);
                notifyListeners("callState", data);
            }

            @Override
            public void onError(String message) {
                JSObject data = new JSObject();
                data.put("message", message);
                notifyListeners("error", data);
            }
        });
    }

    // =========================================================================
    // initialize({ sipDomain, sipUser, sipPassword, incomingEnabled })
    // =========================================================================
    @PluginMethod
    public void initialize(PluginCall call) {
        String sipDomain = call.getString("sipDomain");
        String sipUser = call.getString("sipUser");
        String sipPassword = call.getString("sipPassword");
        boolean incomingEnabled = Boolean.TRUE.equals(call.getBoolean("incomingEnabled", false));

        if (sipDomain == null || sipUser == null || sipPassword == null) {
            call.reject("sipDomain, sipUser, and sipPassword are required");
            return;
        }

        // Request microphone permission first
        if (!hasRequiredPermissions()) {
            savedCall = call;
            requestPermissionForAlias("microphone", call, "micPermissionCallback");
            return;
        }

        doInitialize(call, sipDomain, sipUser, sipPassword, incomingEnabled);
    }

    private PluginCall savedCall;

    @PermissionCallback
    private void micPermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == com.getcapacitor.PermissionState.GRANTED) {
            String sipDomain = call.getString("sipDomain");
            String sipUser = call.getString("sipUser");
            String sipPassword = call.getString("sipPassword");
            boolean incomingEnabled = Boolean.TRUE.equals(call.getBoolean("incomingEnabled", false));
            doInitialize(call, sipDomain, sipUser, sipPassword, incomingEnabled);
        } else {
            call.reject("Microphone permission denied — cannot make calls");
        }
    }

    private void doInitialize(PluginCall call, String sipDomain, String sipUser, String sipPassword, boolean incomingEnabled) {
        try {
            SoftphoneManager.getInstance().initialize(
                getContext(), sipDomain, sipUser, sipPassword, incomingEnabled
            );
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "initialize error: " + e.getMessage());
            call.reject("Failed to initialize SIP: " + e.getMessage());
        }
    }

    // =========================================================================
    // makeCall({ phoneNumber })
    // =========================================================================
    @PluginMethod
    public void makeCall(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            call.reject("phoneNumber is required");
            return;
        }
        SoftphoneManager.getInstance().makeCall(phoneNumber);
        call.resolve();
    }

    // =========================================================================
    // answerCall()
    // =========================================================================
    @PluginMethod
    public void answerCall(PluginCall call) {
        SoftphoneManager.getInstance().answerCall();
        call.resolve();
    }

    // =========================================================================
    // declineCall()
    // =========================================================================
    @PluginMethod
    public void declineCall(PluginCall call) {
        SoftphoneManager.getInstance().declineCall();
        call.resolve();
    }

    // =========================================================================
    // hangup()
    // =========================================================================
    @PluginMethod
    public void hangup(PluginCall call) {
        SoftphoneManager.getInstance().hangup();
        call.resolve();
    }

    // =========================================================================
    // setMuted({ muted: boolean })
    // =========================================================================
    @PluginMethod
    public void setMuted(PluginCall call) {
        boolean muted = Boolean.TRUE.equals(call.getBoolean("muted", false));
        SoftphoneManager.getInstance().setMuted(muted);
        JSObject result = new JSObject();
        result.put("muted", muted);
        call.resolve(result);
    }

    // =========================================================================
    // setSpeaker({ speaker: boolean })
    // =========================================================================
    @PluginMethod
    public void setSpeaker(PluginCall call) {
        boolean speaker = Boolean.TRUE.equals(call.getBoolean("speaker", false));
        SoftphoneManager.getInstance().setSpeaker(speaker);
        call.resolve();
    }

    // =========================================================================
    // getStatus() — returns current call + registration state
    // =========================================================================
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("callState", SoftphoneManager.getInstance().getCallState());
        result.put("initialized", SoftphoneManager.getInstance().isInitialized());
        result.put("muted", SoftphoneManager.getInstance().isMuted());
        call.resolve(result);
    }

    // =========================================================================
    // destroy() — unregister and clean up
    // =========================================================================
    @PluginMethod
    public void destroy(PluginCall call) {
        SoftphoneManager.getInstance().destroy();
        call.resolve();
    }
}
