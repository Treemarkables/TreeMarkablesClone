package co.nz.inflowapp.voice

import android.telecom.DisconnectCause
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.firebase.messaging.FirebaseMessaging
import com.twilio.voice.RegistrationException
import com.twilio.voice.RegistrationListener
import com.twilio.voice.UnregistrationListener
import com.twilio.voice.Voice
import org.json.JSONObject

/**
 * Android port of the iOS `TwilioVoicePlugin.swift`.
 *
 * The JS contract is identical (see client/src/hooks/useTwilioVoice.ts):
 *   methods: register / unregister / answer / reject / hangup / mute / setSpeaker
 *   events : incomingCall, registered, registrationError, callCancelled,
 *            callAnswered, callEnded, callConnected, callDisconnected, callFailed
 *
 * Key platform difference from iOS:
 *  - iOS registers with Twilio using a PushKit VoIP device token.
 *  - Android registers using the **FCM token**, and incoming invites are delivered
 *    as FCM data messages ([VoiceFirebaseMessagingService]) rather than via a
 *    separate VoIP push channel.
 *
 * Answer/reject/hangup are routed through the Telecom [VoiceConnection] so the action
 * works whether it was triggered from the native call UI (lock screen) or from the
 * in-app web call screen.
 */
@CapacitorPlugin(name = "TwilioVoice")
class TwilioVoicePlugin : Plugin(), VoiceCallState.Listener {

    private var accessToken: String? = null
    private var fcmToken: String? = null

    override fun load() {
        super.load()
        // Attach so native components (FCM service / ConnectionService) can push
        // events into the webview while it's alive.
        VoiceCallState.listener = this
    }

    override fun handleOnDestroy() {
        if (VoiceCallState.listener === this) VoiceCallState.listener = null
        super.handleOnDestroy()
    }

    // ── VoiceCallState.Listener ────────────────────────────────────────────────
    override fun onVoiceEvent(event: String, data: JSONObject) {
        // Forward native events to JS. JSObject extends JSONObject so we can wrap.
        notifyListeners(event, JSObject.fromJSONObject(data))
    }

    // ── JS-callable methods ────────────────────────────────────────────────────

    @PluginMethod
    fun register(call: PluginCall) {
        val token = call.getString("token")
        if (token.isNullOrBlank()) {
            call.reject("token is required")
            return
        }
        accessToken = token

        // Twilio Android needs BOTH the access token and the current FCM token.
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful || task.result.isNullOrBlank()) {
                val msg = task.exception?.localizedMessage ?: "FCM token unavailable"
                VoiceCallState.emit(
                    VoiceConstants.EVENT_REGISTRATION_ERROR,
                    JSONObject().put("message", msg),
                )
                call.reject("Could not obtain FCM token: $msg")
                return@addOnCompleteListener
            }
            val fcm = task.result
            fcmToken = fcm
            Voice.register(token, Voice.RegistrationChannel.FCM, fcm, registrationListener)
            call.resolve()
        }
    }

    @PluginMethod
    fun unregister(call: PluginCall) {
        val token = accessToken
        val fcm = fcmToken
        if (token == null || fcm == null) {
            call.resolve()
            return
        }
        Voice.unregister(token, Voice.RegistrationChannel.FCM, fcm, unregistrationListener)
        call.resolve()
    }

    @PluginMethod
    fun answer(call: PluginCall) {
        val connection = VoiceCallState.activeConnection
        if (connection != null) {
            // Route through Telecom so native + in-app stay in sync.
            connection.onAnswer()
        } else {
            // No Telecom connection (rare) — accept the invite directly.
            VoiceCallState.activeInvite?.accept(context, callListener)
        }
        VoiceCallState.emit(VoiceConstants.EVENT_CALL_ANSWERED)
        call.resolve()
    }

    @PluginMethod
    fun reject(call: PluginCall) {
        VoiceCallState.activeInvite?.reject(context)
        VoiceCallState.activeConnection?.setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
        VoiceCallState.activeConnection?.destroy()
        VoiceCallState.clear()
        call.resolve()
    }

    @PluginMethod
    fun hangup(call: PluginCall) {
        VoiceCallState.activeCall?.disconnect()
        VoiceCallState.activeConnection?.onDisconnect()
        call.resolve()
    }

    @PluginMethod
    fun mute(call: PluginCall) {
        val muted = call.getBoolean("muted", true) ?: true
        VoiceCallState.activeCall?.mute(muted)
        call.resolve()
    }

    @PluginMethod
    fun setSpeaker(call: PluginCall) {
        val on = call.getBoolean("on", false) ?: false
        // Speakerphone is driven by the AudioManager; the Connection owns audio
        // routing while a Telecom call is active.
        VoiceCallState.activeConnection?.setSpeaker(on)
        call.resolve()
    }

    // ── Twilio listeners ───────────────────────────────────────────────────────

    private val registrationListener = object : RegistrationListener {
        override fun onRegistered(accessToken: String, fcmToken: String) {
            VoiceCallState.emit(
                VoiceConstants.EVENT_REGISTERED,
                JSONObject().put("deviceToken", fcmToken),
            )
        }

        override fun onError(error: RegistrationException, accessToken: String, fcmToken: String) {
            VoiceCallState.emit(
                VoiceConstants.EVENT_REGISTRATION_ERROR,
                JSONObject().put("message", error.message ?: "registration error"),
            )
        }
    }

    private val unregistrationListener = object : UnregistrationListener {
        override fun onUnregistered(accessToken: String?, fcmToken: String?) {}
        override fun onError(error: RegistrationException, accessToken: String?, fcmToken: String?) {}
    }

    /** Used only when answering without a Telecom connection (fallback). */
    private val callListener = TwilioCallListener()
}
