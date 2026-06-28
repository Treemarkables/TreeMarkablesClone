package co.nz.inflowapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import co.nz.inflowapp.voice.TwilioVoicePlugin
import co.nz.inflowapp.voice.VoiceConnectionService
import co.nz.inflowapp.voice.VoiceFirebaseMessagingService
import com.getcapacitor.BridgeActivity

/**
 * Replaces the generated MainActivity.java (delete that file after copying this in).
 *
 * Responsibilities:
 *  - Register the manually-authored [TwilioVoicePlugin] (plugins defined in the app
 *    module are not auto-discovered, so register before super.onCreate()).
 *  - Register the self-managed Telecom PhoneAccount used for the native call UI.
 *  - Request the runtime permissions calls + push need.
 *  - Bridge the FCM token into the webview (the session-based registration path), the
 *    Android equivalent of the iOS `bridgeTokenToWebView`.
 */
class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(TwilioVoicePlugin::class.java)
        super.onCreate(savedInstanceState)

        VoiceConnectionService.registerPhoneAccount(this)
        requestRuntimePermissions()
    }

    override fun onResume() {
        super.onResume()
        bridgeFcmTokenToWebView()
    }

    private fun bridgeFcmTokenToWebView() {
        val token = VoiceFirebaseMessagingService.lastToken ?: return
        val js = """
            (function() {
              try { localStorage.setItem('__nativeFcmToken', '$token'); } catch (e) {}
              window.__pendingNativeFcmToken = '$token';
              window.dispatchEvent(new CustomEvent('nativeFcmToken', { detail: '$token' }));
            })();
        """.trimIndent()
        bridge?.webView?.post {
            bridge?.webView?.evaluateJavascript(js, null)
        }
    }

    private fun requestRuntimePermissions() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed += Manifest.permission.RECORD_AUDIO
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed += Manifest.permission.POST_NOTIFICATIONS
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), 1001)
        }
    }
}
