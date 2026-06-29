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

    // Notification channel for the (fallback) full-screen incoming-call notification.
    const val NOTIFICATION_CHANNEL_ID = "inflow_incoming_calls"
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
