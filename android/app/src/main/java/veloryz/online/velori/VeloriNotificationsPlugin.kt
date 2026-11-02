package veloryz.online.velori

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.onesignal.OneSignal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "VeloriNotifications")
class VeloriNotificationsPlugin : Plugin() {
    override fun load() {
        OneSignal.Notifications.addPermissionObserver {
            notifyListeners("permissionChanged", notificationState())
        }
        OneSignal.User.pushSubscription.addObserver {
            notifyListeners("subscriptionChanged", notificationState())
        }
        OneSignal.Notifications.addClickListener { event ->
            val route = notificationRoute(event.notification.additionalData)
            if (route.isNotEmpty()) {
                savePendingRoute(route)
                notifyListeners("notificationClick", JSObject().put("route", route))
            }
        }
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        call.resolve(notificationState())
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val granted = OneSignal.Notifications.requestPermission(false)
                call.resolve(notificationState().put("granted", granted))
            } catch (_: Exception) {
                call.reject("Notification permission could not be requested.")
            }
        }
    }

    @PluginMethod
    fun login(call: PluginCall) {
        val externalId = call.getString("externalId")?.trim().orEmpty()
        val identityToken = call.getString("identityToken")?.trim().orEmpty()
        if (externalId.isEmpty() || identityToken.isEmpty()) {
            call.reject("A verified account identity is required.")
            return
        }
        try {
            OneSignal.login(externalId, identityToken)
            call.resolve(JSObject().put("linked", true))
        } catch (_: Exception) {
            call.reject("This device could not be linked to the signed-in account.")
        }
    }

    @PluginMethod
    fun logout(call: PluginCall) {
        try {
            OneSignal.logout()
            call.resolve(JSObject().put("linked", false))
        } catch (_: Exception) {
            call.reject("This device could not be detached from the signed-in account.")
        }
    }

    @PluginMethod
    fun optIn(call: PluginCall) {
        try {
            OneSignal.User.pushSubscription.optIn()
            call.resolve(notificationState())
        } catch (_: Exception) {
            call.reject("This device could not subscribe to push notifications.")
        }
    }

    @PluginMethod
    fun optOut(call: PluginCall) {
        try {
            OneSignal.User.pushSubscription.optOut()
            call.resolve(notificationState())
        } catch (_: Exception) {
            call.reject("This device could not unsubscribe from push notifications.")
        }
    }

    @PluginMethod
    fun openNotificationSettings(call: PluginCall) {
        try {
            val intent = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:${context.packageName}"))
            }
            activity.startActivity(intent)
            call.resolve()
        } catch (_: Exception) {
            call.reject("Notification settings could not be opened.")
        }
    }

    @PluginMethod
    fun takePendingNotificationRoute(call: PluginCall) {
        val preferences = context.getSharedPreferences(PREFERENCES, 0)
        val route = preferences.getString(PENDING_ROUTE, null)
        preferences.edit().remove(PENDING_ROUTE).apply()
        call.resolve(JSObject().put("route", route))
    }

    private fun notificationState(): JSObject {
        val pushSubscription = OneSignal.User.pushSubscription
        return JSObject()
            .put("permissionGranted", OneSignal.Notifications.permission)
            .put("canRequestPermission", OneSignal.Notifications.canRequestPermission)
            .put("subscriptionId", pushSubscription.id)
            .put("optedIn", pushSubscription.optedIn)
            .put("externalId", OneSignal.User.externalId)
    }

    private fun notificationRoute(data: org.json.JSONObject?): String {
        if (data == null) return ""
        return sequenceOf("route", "link", "url")
            .map { data.optString(it).trim() }
            .firstOrNull { it.isNotEmpty() }
            .orEmpty()
    }

    private fun savePendingRoute(route: String) {
        context.getSharedPreferences(PREFERENCES, 0)
            .edit()
            .putString(PENDING_ROUTE, route)
            .apply()
    }

    private companion object {
        const val PREFERENCES = "velori_notification_state"
        const val PENDING_ROUTE = "pending_notification_route"
    }
}
