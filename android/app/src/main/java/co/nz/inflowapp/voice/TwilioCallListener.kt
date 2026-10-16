package co.nz.inflowapp.voice

import android.telecom.DisconnectCause
import com.twilio.voice.Call
import com.twilio.voice.CallException
import org.json.JSONObject

/**
 * Bridges Twilio [Call] state to (a) the Telecom [VoiceConnection] that owns the native
 * call UI and (b) the JS event stream. Mirrors the iOS `CallDelegate` extension.
 */
class TwilioCallListener : Call.Listener {

    override fun onConnected(call: Call) {
        VoiceCallState.activeCall = call
        VoiceCallState.activeConnection?.setActive()
        VoiceCallState.emit(
            VoiceConstants.EVENT_CALL_CONNECTED,
            JSONObject().put("sid", call.sid ?: ""),
        )
    }

    override fun onDisconnected(call: Call, error: CallException?) {
        VoiceCallState.activeConnection?.setDisconnected(
            DisconnectCause(if (error != null) DisconnectCause.ERROR else DisconnectCause.REMOTE),
        )
        VoiceCallState.activeConnection?.destroy()
        VoiceCallState.clear()
        VoiceCallState.emit(
            VoiceConstants.EVENT_CALL_DISCONNECTED,
            JSONObject().put("error", error?.localizedMessage ?: ""),
        )
    }

    override fun onConnectFailure(call: Call, error: CallException) {
        VoiceCallState.activeConnection?.setDisconnected(DisconnectCause(DisconnectCause.ERROR))
        VoiceCallState.activeConnection?.destroy()
        VoiceCallState.clear()
        VoiceCallState.emit(
            VoiceConstants.EVENT_CALL_FAILED,
            JSONObject().put("error", error.localizedMessage ?: "connect failure"),
        )
    }

    override fun onRinging(call: Call) {}

    override fun onReconnecting(call: Call, error: CallException) {}

    override fun onReconnected(call: Call) {}
}
