#import <Capacitor/Capacitor.h>

CAP_PLUGIN(SoftphonePlugin, "Softphone",
    CAP_PLUGIN_METHOD(initialize,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(makeCall,     CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(answerCall,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(declineCall,  CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(hangup,       CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setMuted,     CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setSpeaker,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getStatus,    CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(destroy,      CAPPluginReturnPromise);
)
