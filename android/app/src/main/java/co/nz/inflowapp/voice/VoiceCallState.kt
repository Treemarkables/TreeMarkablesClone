package co.nz.inflowapp.voice

import com.twilio.voice.Call
import com.twilio.voice.CallInvite
import org.json.JSONObject

/**
 * Process-wide holder for the current call + a thin bridge back to the Capacitor
 * plugin so native components (FCM service, ConnectionService, Connection) can emit
 * JS events without holding a reference to the plugin instance directly.
 *
 * Why a singleton: the FCM data message that carries an incoming call can arrive when
 * the app process is dead. The Telecom UI ([VoiceConnectionService]) then runs without
 * any webview attached — exactly like CallKit on iOS. When the user opens the app and
 * the Capacitor plugin loads, it attaches itself here ([listener]) and starts receiving
 * events; until then [emit] is a no-op for the JS layer (the native call UI still works).
 */
object VoiceCallState {

    /** Implemented by [TwilioVoicePlugin] so native code can push events to JS. */
    interface Listener {
        fun onVoiceEvent(event: String, data: JSONObject)
    }

    @Volatile var listener: Listener? = null

    /** The pending invite (ringing, not yet answered). */
    @Volatile var activeInvite: CallInvite? = null

    /** The live connected call (after answer). */
    @Volatile var activeCall: Call? = null

    /** The Telecom connection currently presenting the native call UI. */
    @Volatile var activeConnection: VoiceConnection? = null

    fun emit(event: String, data: JSONObject = JSONObject()) {
        listener?.onVoiceEvent(event, data)
    }

    fun clear() {
        activeInvite = null
        activeCall = null
        activeConnection = null
    }
}
