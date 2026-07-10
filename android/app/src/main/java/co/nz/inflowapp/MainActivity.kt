package co.nz.inflowapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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

        // Bridge the token the moment FCM issues it. On a cold start the token arrives
        // seconds AFTER onResume, so resume-only bridging missed it until the next
        // background/foreground cycle (Android twin of the iOS cold-boot bridge race —
        // see bridgeTokenToWebView in AppDelegate+Firebase.swift).
        VoiceFirebaseMessagingService.onTokenReceived = {
            runOnUiThread { bridgeFcmTokenToWebView() }
        }
    }

    override fun onDestroy() {
        VoiceFirebaseMessagingService.onTokenReceived = null
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        bridgeFcmTokenToWebView()
    }

    private fun bridgeFcmTokenToWebView(attempt: Int = 0) {
        if (attempt >= 20) return
        val token = VoiceFirebaseMessagingService.lastToken ?: return
        val webView = bridge?.webView ?: run {
            Handler(Looper.getMainLooper()).postDelayed({ bridgeFcmTokenToWebView(attempt + 1) }, 500)
            return
        }
        // Only inject once the document is the remote app — mid-boot the webview is still
        // on about:blank and the localStorage write + event land on the wrong origin and
        // are silently lost (while evaluateJavascript reports success). Same origin-guard
        // lesson as iOS; protocol check avoids hardcoding the host here.
        val js = """
            (function() {
              if (location.protocol !== 'https:') return 'not-ready';
              try { localStorage.setItem('__nativeFcmToken', '$token'); } catch (e) {}
              window.__pendingNativeFcmToken = '$token';
              window.dispatchEvent(new CustomEvent('nativeFcmToken', { detail: '$token' }));
              return 'ok';
            })();
        """.trimIndent()
        webView.evaluateJavascript(js) { result ->
            if (result == null || !result.contains("ok")) {
                webView.postDelayed({ bridgeFcmTokenToWebView(attempt + 1) }, 500)
            }
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
