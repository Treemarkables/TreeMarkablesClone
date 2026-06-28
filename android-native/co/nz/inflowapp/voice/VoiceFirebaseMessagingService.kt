package co.nz.inflowapp.voice

import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.TelecomManager
import android.util.Log
import androidx.core.content.ContextCompat
import co.nz.inflowapp.BuildConfig
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.twilio.voice.CallException
import com.twilio.voice.CallInvite
import com.twilio.voice.CancelledCallInvite
import com.twilio.voice.MessageListener
import com.twilio.voice.Voice
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Single FCM entry point for the app. Mirrors the iOS `AppDelegate+Firebase.swift`
 * (regular push token registration) AND the iOS PushKit handler (Twilio call invites) —
 * on Android both arrive through the one FCM channel.
 *
 * - [onNewToken]: register the FCM token with the server (native, webhook-secret authed,
 *   no session required) — identical contract to iOS NativeTokenRegistration.
 * - [onMessageReceived]: hand the payload to [Voice.handleMessage]. If it is a Twilio
 *   call invite, present it via the Telecom framework ([VoiceConnectionService]); if not,
 *   it is a normal data notification (regular notification+data messages are auto-shown
 *   by the system tray when the app is backgrounded).
 */
class VoiceFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "InflowFCM"
        private const val SERVER_URL = "https://app.treemarkables.co.nz"

        // Injected at build time from android-native/secrets.properties (gitignored) via
        // BuildConfig — never hardcode the webhook secret in source/git. This mirrors the
        // iOS native registration path (AppDelegate+Firebase.swift) but keeps the secret
        // out of the repo. See ANDROID_BUILD_GUIDE.md → "Native registration secret".
        private val WEBHOOK_SECRET = BuildConfig.INFLOW_WEBHOOK_SECRET
        private val OWNER_EMPLOYEE_ID = BuildConfig.INFLOW_OWNER_EMPLOYEE_ID

        /** Last FCM token seen — injected into the webview by MainActivity on resume. */
        @Volatile var lastToken: String? = null
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token: ${token.take(20)}…")
        lastToken = token
        registerTokenWithServer(token)
        // Best-effort: if the webview is alive, surface it for the session-based path too.
        VoiceCallState.emit("nativeFcmToken", JSONObject().put("token", token))
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

    // ── Native server registration (mirrors iOS NativeTokenRegistration) ───────

    private fun registerTokenWithServer(token: String) {
        if (WEBHOOK_SECRET.isBlank() || OWNER_EMPLOYEE_ID.isBlank()) {
            Log.w(TAG, "INFLOW_WEBHOOK_SECRET / OWNER_EMPLOYEE_ID not set — skipping native FCM registration")
            return
        }
        Thread {
            try {
                val url = URL("$SERVER_URL/api/notifications/register-native-fcm-token")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15000
                    readTimeout = 15000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("x-webhook-secret", WEBHOOK_SECRET)
                }
                val body = JSONObject()
                    .put("token", token)
                    .put("employeeId", OWNER_EMPLOYEE_ID)
                    .put("deviceInfo", "Android Native (${Build.VERSION.RELEASE})")
                    .toString()
                OutputStreamWriter(conn.outputStream).use { it.write(body) }

                val code = conn.responseCode
                if (code == 200) {
                    Log.d(TAG, "FCM token registered with server")
                } else {
                    Log.w(TAG, "FCM registration failed HTTP $code")
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "FCM registration error: ${e.message}")
            }
        }.start()
    }
}
