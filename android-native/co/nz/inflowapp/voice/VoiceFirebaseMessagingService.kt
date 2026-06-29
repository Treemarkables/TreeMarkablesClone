package co.nz.inflowapp.voice

import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.twilio.voice.CallException
import com.twilio.voice.CallInvite
import com.twilio.voice.CancelledCallInvite
import com.twilio.voice.MessageListener
import com.twilio.voice.Voice
import org.json.JSONObject

/**
 * Single FCM entry point for the app. Mirrors the iOS `AppDelegate+Firebase.swift`
 * (regular push token registration) AND the iOS PushKit handler (Twilio call invites) —
 * on Android both arrive through the one FCM channel.
 *
 * - [onNewToken]: stash the token and bridge it into the webview. The web app POSTs it
 *   to /api/notifications/register-token with the signed-in employee's SESSION cookie, so
 *   it registers per-user (multi-staff safe) — same as iOS. (We must NOT POST natively with
 *   a hardcoded owner id: that registered every device as the owner so staff never got
 *   their own pushes — the bug iOS already removed.)
 * - [onMessageReceived]: hand the payload to [Voice.handleMessage]. If it is a Twilio
 *   call invite, present it via the Telecom framework ([VoiceConnectionService]); if not,
 *   it is a normal data notification (regular notification+data messages are auto-shown
 *   by the system tray when the app is backgrounded).
 */
class VoiceFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "InflowFCM"

        /** Last FCM token seen — injected into the webview by MainActivity on resume. */
        @Volatile var lastToken: String? = null
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token: ${token.take(20)}…")
        // Per-user registration: stash the token so MainActivity bridges it into the webview
        // on resume; the web app then POSTs it to /api/notifications/register-token with the
        // logged-in employee's session cookie. No native POST + no hardcoded owner id.
        lastToken = token
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        if (message.data.isEmpty()) return

        val handled = Voice.handleMessage(
            applicationContext,
            message.data,
            object : MessageListener {
                override fun onCallInvite(callInvite: CallInvite) {
                    presentIncomingCall(callInvite)
                }

                override fun onCancelledCallInvite(
                    cancelledCallInvite: CancelledCallInvite,
                    callException: CallException?,
                ) {
                    cancelIncomingCall()
                }
            },
        )

        if (!handled) {
            // Not a Twilio message → a regular data push. notification+data messages from
            // the server are displayed by the system automatically when backgrounded; for
            // foreground data we let the webview's own handlers react. Nothing to do here.
            Log.d(TAG, "Non-Twilio FCM data message received")
        }
    }

    // ── Twilio call invite → Telecom ───────────────────────────────────────────

    private fun presentIncomingCall(callInvite: CallInvite) {
        VoiceCallState.activeInvite = callInvite

        val telecomManager = getSystemService(TELECOM_SERVICE) as TelecomManager
        val handle = VoiceConnectionService.phoneAccountHandle(this)

        val from = callInvite.from ?: "Unknown"
        val extras = Bundle().apply {
            putParcelable(
                TelecomManager.EXTRA_INCOMING_CALL_ADDRESS,
                Uri.fromParts("tel", from, null),
            )
            val callExtras = Bundle().apply {
                putParcelable(VoiceConstants.EXTRA_INCOMING_CALL_INVITE, callInvite)
                putString(VoiceConstants.EXTRA_CALL_FROM, from)
                putString(VoiceConstants.EXTRA_CALL_TO, callInvite.to ?: "")
                putString(VoiceConstants.EXTRA_CALL_SID, callInvite.callSid)
            }
            putBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, callExtras)
        }

        try {
            telecomManager.addNewIncomingCall(handle, extras)
        } catch (e: SecurityException) {
            // PhoneAccount not registered/enabled — fall back to a full-screen notification.
            Log.e(TAG, "addNewIncomingCall failed: ${e.message}")
            IncomingCallNotifier.show(this, from, callInvite)
        }

        // Mirror iOS: surface to JS as soon as possible. data values must be strings.
        VoiceCallState.emit(
            VoiceConstants.EVENT_INCOMING_CALL,
            JSONObject()
                .put("from", from)
                .put("to", callInvite.to ?: "")
                .put("callSid", callInvite.callSid),
        )
    }

    private fun cancelIncomingCall() {
        VoiceCallState.activeConnection?.let {
            it.setDisconnected(android.telecom.DisconnectCause(android.telecom.DisconnectCause.CANCELED))
            it.destroy()
        }
        IncomingCallNotifier.cancel(this)
        VoiceCallState.clear()
        VoiceCallState.emit(VoiceConstants.EVENT_CALL_CANCELLED)
    }
}
