package veloryz.online.velori

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

internal enum class NativeAuthPurpose { CONFIRM_EMAIL, RESET_PASSWORD }
internal enum class NativeAppDestination { HOME, EXPLORE, REELS, MESSAGES, PROFILE }

internal data class NativeAuthCallback(
    val purpose: NativeAuthPurpose,
    val type: String,
    val tokenHash: String? = null,
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val expiresInSeconds: Long? = null,
) {
    companion object {
        private const val CUSTOM_SCHEME = "online.veloryz.velori"
        private const val APP_HOST = "chat.veloryz.online"

        fun parse(value: String?): NativeAuthCallback? {
            val uri = runCatching { URI(value?.trim().orEmpty()) }.getOrNull() ?: return null
            val path = when {
                uri.scheme.equals(CUSTOM_SCHEME, ignoreCase = true) && uri.host == "auth" -> uri.path
                uri.scheme.equals("https", ignoreCase = true) && uri.host.equals(APP_HOST, true) -> uri.path
                else -> return null
            }
            val params = parseParameters(uri.rawQuery) + parseParameters(uri.rawFragment)
            val type = params["type"]?.lowercase() ?: return null
            val purpose = when {
                type == "recovery" && path in setOf("/reset-password", "/auth/reset-password") ->
                    NativeAuthPurpose.RESET_PASSWORD
                type in setOf("email", "signup") && path in setOf("/confirm", "/auth/confirm") ->
                    NativeAuthPurpose.CONFIRM_EMAIL
                else -> return null
            }
            val tokenHash = params["token_hash"]?.takeIf(String::isNotBlank)
            val accessToken = params["access_token"]?.takeIf(String::isNotBlank)
            val refreshToken = params["refresh_token"]?.takeIf(String::isNotBlank)
            val expiresIn = params["expires_in"]?.toLongOrNull()?.takeIf { it > 0 }
            val hasHash = tokenHash != null
            val hasSession = accessToken != null && refreshToken != null
            if (!hasHash && !hasSession) return null
            return NativeAuthCallback(purpose, type, tokenHash, accessToken, refreshToken, expiresIn)
        }

        private fun parseParameters(raw: String?): Map<String, String> = raw
            ?.split('&')
            ?.mapNotNull { pair ->
                if (pair.isBlank()) return@mapNotNull null
                val parts = pair.split('=', limit = 2)
                val key = decode(parts[0])
                val value = decode(parts.getOrElse(1) { "" })
                key.takeIf(String::isNotBlank)?.let { it to value }
            }
            ?.toMap()
            .orEmpty()

        private fun decode(value: String): String =
            runCatching { URLDecoder.decode(value, StandardCharsets.UTF_8.name()) }.getOrDefault("")
    }
}

internal fun resolveNativeAppDestination(value: String?): NativeAppDestination? {
    val uri = runCatching { URI(value?.trim().orEmpty()) }.getOrNull() ?: return null
    val path = when {
        uri.scheme.equals("online.veloryz.velori", true) && uri.host in
            setOf("home", "explore", "reels", "messages", "profile") ->
            "/${uri.host}" + uri.path.orEmpty().takeUnless { it == "/" }.orEmpty()
        uri.scheme.equals("https", true) && uri.host.equals("chat.veloryz.online", true) -> uri.path
        else -> return null
    }
    return when {
        path == "/" || path == "/home" -> NativeAppDestination.HOME
        path == "/explore" -> NativeAppDestination.EXPLORE
        path == "/reels" -> NativeAppDestination.REELS
        path == "/messages" -> NativeAppDestination.MESSAGES
        path == "/profile" -> NativeAppDestination.PROFILE
        else -> null
    }
}

internal fun normalizeNativeEmail(value: String): String = value.trim().lowercase()

internal fun isValidNativeEmail(value: String): Boolean {
    val email = normalizeNativeEmail(value)
    if (email.length > 254 || email.any(Char::isWhitespace)) return false
    val at = email.lastIndexOf('@')
    if (at < 1 || at == email.lastIndex) return false
    val local = email.substring(0, at)
    val domain = email.substring(at + 1)
    val localAllowed = Regex("^[a-z0-9.!#${'$'}%&'*+/=?^_`{|}~-]+${'$'}", RegexOption.IGNORE_CASE)
    val validDomainLabel = Regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?${'$'}", RegexOption.IGNORE_CASE)
    return local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') &&
        !local.contains("..") && localAllowed.matches(local) && domain.contains('.') &&
        domain.split('.').all(validDomainLabel::matches)
}

internal fun isStrongNativePassword(value: String): Boolean {
    fun isAsciiLetter(char: Char) = char in 'a'..'z' || char in 'A'..'Z'
    return value.length >= 12 && value.any(::isAsciiLetter) && value.any { !isAsciiLetter(it) }
}
