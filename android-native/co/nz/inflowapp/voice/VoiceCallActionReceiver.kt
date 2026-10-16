package co.nz.inflowapp.voice

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telecom.DisconnectCause

/**
 * Handles the DECLINE action on the incoming-call notification. (Answer routes through
 * MainActivity via an activity PendingIntent instead — Android blocks activity starts
 * from receivers, and answering must surface the in-call UI.)
 */
class VoiceCallActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != VoiceConstants.ACTION_DECLINE_CALL) return
        IncomingCallNotifier.cancel(context)

        val connection = VoiceCallState.activeConnection
        if (connection != null) {
            // Telecom path — onReject rejects the invite + tears down + emits.
            connection.onReject()
        } else {
            VoiceCallState.activeInvite?.reject(context.applicationContext)
            VoiceCallState.clear()
            VoiceCallState.emit(VoiceConstants.EVENT_CALL_ENDED)
        }
    }
}
