package co.nz.inflowapp.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import co.nz.inflowapp.MainActivity
import com.twilio.voice.CallInvite

/**
 * Full-screen incoming-call notification used only as a fallback when the Telecom
 * framework refuses the call (e.g. self-managed PhoneAccount disabled by the user).
 * The Telecom [VoiceConnectionService] path is preferred — this keeps calls reachable
 * if Telecom is unavailable.
 */
object IncomingCallNotifier {

    fun show(context: Context, from: String, callInvite: CallInvite) {
        ensureChannel(context)

        val fullScreenIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(VoiceConstants.EXTRA_CALL_FROM, from)
            putExtra(VoiceConstants.EXTRA_CALL_SID, callInvite.callSid)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val fullScreenPending = PendingIntent.getActivity(context, 0, fullScreenIntent, flags)

        val notification: Notification = NotificationCompat.Builder(context, VoiceConstants.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("Incoming call")
            .setContentText(from)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(fullScreenPending, true)
            .setOngoing(true)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context)
            .notify(VoiceConstants.INCOMING_CALL_NOTIFICATION_ID, notification)
    }

    fun cancel(context: Context) {
        NotificationManagerCompat.from(context)
            .cancel(VoiceConstants.INCOMING_CALL_NOTIFICATION_ID)
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(VoiceConstants.NOTIFICATION_CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            VoiceConstants.NOTIFICATION_CHANNEL_ID,
            VoiceConstants.NOTIFICATION_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Incoming Inflow voice calls"
            setSound(null, null) // Telecom/ringtone handles audio; avoid double-ring
        }
        manager.createNotificationChannel(channel)
    }
}
