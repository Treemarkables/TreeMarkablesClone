package co.nz.inflowapp.voice

import android.content.Context
import android.telecom.CallAudioState
import android.telecom.Connection
import android.telecom.DisconnectCause
import com.twilio.voice.AcceptOptions
import com.twilio.voice.CallInvite

/**
 * A single self-managed Telecom call. Maps the native call UI actions (answer / reject /
 * hang up / mute / speaker) onto the Twilio [CallInvite] / Call — mirroring the iOS
 * `CXProviderDelegate` extension in TwilioVoicePlugin.swift.
 */
class VoiceConnection(private val appContext: Context) : Connection() {

    var callInvite: CallInvite? = null
    private val callListener = TwilioCallListener()

    override fun onAnswer() {
        super.onAnswer()
        val invite = callInvite ?: run {
            setDisconnected(DisconnectCause(DisconnectCause.ERROR))
            destroy()
            return
        }
        setDialing()
        val options = AcceptOptions.Builder().build()
        VoiceCallState.activeCall = invite.accept(appContext, options, callListener)
        VoiceCallState.activeInvite = null
        VoiceCallState.emit(VoiceConstants.EVENT_CALL_ANSWERED)
    }

    override fun onReject() {
        super.onReject()
        callInvite?.reject(appContext)
        VoiceCallState.activeInvite = null
        setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
        destroy()
        VoiceCallState.clear()
        VoiceCallState.emit(VoiceConstants.EVENT_CALL_ENDED)
    }

    override fun onDisconnect() {
        super.onDisconnect()
        VoiceCallState.activeCall?.disconnect()
        callInvite?.reject(appContext)
        setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
        destroy()
        VoiceCallState.clear()
        VoiceCallState.emit(VoiceConstants.EVENT_CALL_ENDED)
    }

    override fun onAbort() {
        super.onAbort()
        onDisconnect()
    }

    override fun onStateChanged(state: Int) {
        super.onStateChanged(state)
    }

    /** Driven from the in-app web call screen via TwilioVoicePlugin.setSpeaker. */
    fun setSpeaker(on: Boolean) {
        setAudioRoute(if (on) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE)
    }
}
