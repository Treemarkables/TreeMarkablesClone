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
 * Full-screen incoming-call notification — the PRIMARY ring surface on Android.
 *
 * Our PhoneAccount is SELF-MANAGED, and for self-managed calls the system shows no
 * incoming-call UI and plays no ringtone (unlike iOS CallKit) — the app must render
 * its own. Telecom still owns the Connection lifecycle/audio; this notifier provides
 * the visible + audible ring: full-screen intent (lock screen takeover), ringtone and
 * vibration via the notification channel. Tapping opens the app, where the in-app call
 * screen answers/declines (wired through TwilioVoicePlugin).
 */
object IncomingCallNotifier {

    fun show(context: Context, from: String, callInvite: CallInvite) {
        ensureChannel(context)

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

        val fullScreenIntent = Intent(context, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(VoiceConstants.EXTRA_CALL_FROM, from)
            putExtra(VoiceConstants.EXTRA_CALL_SID, callInvite.callSid)
        }
        val fullScreenPending = PendingIntent.getActivity(context, 0, fullScreenIntent, flags)

        // ANSWER — an activity intent into MainActivity carrying PERFORM_ANSWER: the
        // activity answers via Telecom then the web in-call overlay is already on screen.
        val answerIntent = Intent(context, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(VoiceConstants.EXTRA_PERFORM_ANSWER, true)
        }
        val answerPending = PendingIntent.getActivity(context, 1, answerIntent, flags)

        // DECLINE — no UI needed; a broadcast receiver rejects the invite.
        val declineIntent = Intent(context, VoiceCallActionReceiver::class.java)
            .setAction(VoiceConstants.ACTION_DECLINE_CALL)
        val declinePending = PendingIntent.getBroadcast(context, 2, declineIntent, flags)

        val notification: Notification = NotificationCompat.Builder(context, VoiceConstants.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("Inflow — incoming call")
            .setContentText(from)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPending, true)
            .setOngoing(true)
            .setAutoCancel(true)
            .addAction(android.R.drawable.sym_action_call, "Answer", answerPending)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePending)
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
            // Self-managed Telecom calls get NO system ringtone — this channel IS the ring.
            setSound(
                android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE),
                android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 1000, 800, 1000, 800, 1000)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }
}
