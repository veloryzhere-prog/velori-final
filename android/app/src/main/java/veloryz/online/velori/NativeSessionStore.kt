package veloryz.online.velori

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal data class NativeSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String,
    val expiresAt: Long,
)

internal class NativeSessionStore(context: Context) {
    private val preferences = context.getSharedPreferences("velori_native_session", Context.MODE_PRIVATE)

    fun read(): NativeSession? = runCatching {
        val encoded = preferences.getString(SESSION_KEY, null) ?: return null
        val parts = Base64.decode(encoded, Base64.NO_WRAP)
        val iv = parts.copyOfRange(0, IV_SIZE)
        val ciphertext = parts.copyOfRange(IV_SIZE, parts.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), GCMParameterSpec(TAG_BITS, iv))
        JSONObject(cipher.doFinal(ciphertext).toString(Charsets.UTF_8)).run {
            NativeSession(
                getString("access_token"), getString("refresh_token"), getString("user_id"),
                getString("email"), getLong("expires_at"),
            )
        }
    }.getOrNull()

    fun write(session: NativeSession) {
        val payload = JSONObject().apply {
            put("access_token", session.accessToken)
            put("refresh_token", session.refreshToken)
            put("user_id", session.userId)
            put("email", session.email)
            put("expires_at", session.expiresAt)
        }.toString().toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
        val encrypted = cipher.iv + cipher.doFinal(payload)
        preferences.edit().putString(SESSION_KEY, Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
    }

    fun clear() = preferences.edit().remove(SESSION_KEY).apply()

    private fun encryptionKey(): SecretKey {
        val store = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE).run {
            init(
                KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "velori-native-session-v1"
        const val SESSION_KEY = "encrypted_session"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_SIZE = 12
        const val TAG_BITS = 128
    }
}
