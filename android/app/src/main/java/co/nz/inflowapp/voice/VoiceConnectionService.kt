package co.nz.inflowapp.voice

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import com.twilio.voice.CallInvite

/**
 * Self-managed [ConnectionService] — the Android counterpart to iOS CallKit.
 * The system uses this to render the native incoming-call UI (lock screen, recents,
 * audio routing) for Twilio Voice calls.
 */
class VoiceConnectionService : ConnectionService() {

    companion object {
        fun phoneAccountHandle(context: Context): PhoneAccountHandle =
            PhoneAccountHandle(
                ComponentName(context, VoiceConnectionService::class.java),
                VoiceConstants.PHONE_ACCOUNT_ID,
            )

        /** Register the self-managed PhoneAccount. Call once on app start. Idempotent. */
        fun registerPhoneAccount(context: Context) {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val account = PhoneAccount.builder(
                phoneAccountHandle(context),
                VoiceConstants.PHONE_ACCOUNT_LABEL,
            )
                .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                .build()
            telecomManager.registerPhoneAccount(account)
        }
    }

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest,
    ): Connection {
        val callExtras = request.extras.getBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS)
            ?: request.extras
        @Suppress("DEPRECATION")
        val invite: CallInvite? =
            callExtras.getParcelable(VoiceConstants.EXTRA_INCOMING_CALL_INVITE)
        val from = callExtras.getString(VoiceConstants.EXTRA_CALL_FROM) ?: invite?.from ?: "Unknown"

        val connection = VoiceConnection(applicationContext).apply {
            callInvite = invite
            connectionProperties = Connection.PROPERTY_SELF_MANAGED
            setAddress(Uri.fromParts("tel", from, null), TelecomManager.PRESENTATION_ALLOWED)
            setCallerDisplayName("Inflow Customer", TelecomManager.PRESENTATION_ALLOWED)
            audioModeIsVoip = true
            setRinging()
        }
        VoiceCallState.activeConnection = connection
        return connection
    }

    override fun onCreateIncomingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?,
    ) {
        // System refused the call (e.g. Do Not Disturb / another self-managed call active).
        VoiceCallState.activeInvite?.reject(applicationContext)
        VoiceCallState.clear()
        VoiceCallState.emit(VoiceConstants.EVENT_CALL_CANCELLED)
    }

    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?,
    ): Connection {
        // This app only receives inbound calls (parity with iOS). Reject outgoing.
        return Connection.createFailedConnection(
            DisconnectCause(DisconnectCause.ERROR, "Outgoing calls not supported"),
        )
    }
}
