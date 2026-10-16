package co.nz.inflowapp.voice

/**
 * Shared constants for the Twilio Voice + Telecom (ConnectionService) integration.
 *
 * This is the Android counterpart to the iOS `TwilioVoicePlugin.swift`. On iOS the
 * call invite arrives via PushKit (a dedicated VoIP channel) and CallKit renders the
 * native call UI. On Android the invite arrives as an FCM **data message** (handled in
 * [VoiceFirebaseMessagingService]) and the Telecom framework's self-managed
 * [VoiceConnectionService] renders the native incoming-call UI.
 */
object VoiceConstants {
    // Telecom PhoneAccount
    const val PHONE_ACCOUNT_ID = "co.nz.inflowapp.voice"
    const val PHONE_ACCOUNT_LABEL = "Inflow"

    // Connection / Service intent extras
    const val EXTRA_INCOMING_CALL_INVITE = "INCOMING_CALL_INVITE"
    const val EXTRA_CANCELLED_CALL_INVITE = "CANCELLED_CALL_INVITE"
    const val EXTRA_CALL_FROM = "CALL_FROM"
    const val EXTRA_CALL_TO = "CALL_TO"
    const val EXTRA_CALL_SID = "CALL_SID"

    // Notification action plumbing. Answer routes through MainActivity (an activity
    // PendingIntent — receivers can't start activities on modern Android); Decline
    // goes through VoiceCallActionReceiver (no UI needed).
    const val EXTRA_PERFORM_ANSWER = "PERFORM_ANSWER"
    const val ACTION_DECLINE_CALL = "co.nz.inflowapp.voice.DECLINE_CALL"

    // Notification channel for the full-screen incoming-call notification (the primary
    // ring surface — self-managed Telecom calls get no system UI/ringtone).
    // v2: channel settings are immutable once created; v1 was created silent.
    const val NOTIFICATION_CHANNEL_ID = "inflow_incoming_calls_v2"
    const val NOTIFICATION_CHANNEL_NAME = "Incoming calls"
    const val INCOMING_CALL_NOTIFICATION_ID = 4321

    // Plugin event names — MUST match the iOS plugin and the JS listener map in
    // client/src/hooks/useTwilioVoice.ts.
    const val EVENT_INCOMING_CALL = "incomingCall"
    const val EVENT_REGISTERED = "registered"
    const val EVENT_REGISTRATION_ERROR = "registrationError"
    const val EVENT_CALL_CANCELLED = "callCancelled"
    const val EVENT_CALL_ANSWERED = "callAnswered"
    const val EVENT_CALL_ENDED = "callEnded"
    const val EVENT_CALL_CONNECTED = "callConnected"
    const val EVENT_CALL_DISCONNECTED = "callDisconnected"
    const val EVENT_CALL_FAILED = "callFailed"
}
