package veloryz.online.velori

import android.content.Intent
import androidx.core.view.WindowInsetsControllerCompat
import android.view.HapticFeedbackConstants
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "VeloriDevice")
class VeloriDevicePlugin : Plugin() {
    @PluginMethod
    fun setSystemBars(call: PluginCall) {
        val darkMode = call.getBoolean("darkMode") ?: false
        val controller = WindowInsetsControllerCompat(activity.window, activity.window.decorView)
        controller.isAppearanceLightStatusBars = !darkMode
        controller.isAppearanceLightNavigationBars = !darkMode
        call.resolve()
    }

    @PluginMethod
    fun haptic(call: PluginCall) {
        val style = call.getString("style")?.trim()
        val feedback = when (style) {
            "selection" -> HapticFeedbackConstants.CLOCK_TICK
            "light" -> HapticFeedbackConstants.KEYBOARD_TAP
            else -> {
                call.reject("Unsupported haptic style.")
                return
            }
        }
        val performed = bridge.webView.performHapticFeedback(feedback)
        call.resolve(JSObject().put("performed", performed))
    }

    @PluginMethod
    fun share(call: PluginCall) {
        val url = call.getString("url")?.trim().orEmpty()
        val title = call.getString("title")?.trim().orEmpty()
        if (!url.startsWith("https://chat.veloryz.online/") || title.isEmpty()) {
            call.reject("A valid VELORI link and title are required.")
            return
        }

        try {
            val intent = Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_SUBJECT, title)
                .putExtra(Intent.EXTRA_TEXT, call.getString("text")?.trim().orEmpty())
            activity.startActivity(Intent.createChooser(intent, title))
            call.resolve()
        } catch (_: Exception) {
            call.reject("The Android share sheet could not be opened.")
        }
    }
}
