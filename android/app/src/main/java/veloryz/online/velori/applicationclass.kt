package veloryz.online.velori

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import com.onesignal.OneSignal
import com.onesignal.notifications.INotificationClickListener
import com.onesignal.notifications.INotificationClickEvent

class ApplicationClass : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        OneSignal.initWithContext(this, "86e2e54e-2c25-49cb-97e5-f64030ac74b9")
        OneSignal.Notifications.addClickListener(object : INotificationClickListener {
            override fun onClick(event: INotificationClickEvent) {
                val data = event.notification.additionalData
                val route = sequenceOf("route", "link", "url")
                    .map { data?.optString(it)?.trim().orEmpty() }
                    .firstOrNull { it.isNotEmpty() }
                if (route != null) {
                    getSharedPreferences("velori_notification_state", Context.MODE_PRIVATE)
                        .edit()
                        .putString("pending_notification_route", route)
                        .apply()
                }
            }
        })
    }

    private fun createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "general",
            "VELORI notifications",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Messages and activity updates from VELORI"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
