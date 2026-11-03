package veloryz.online.velori

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal data class NativePost(val id: String, val body: String, val author: String, val createdAt: String)
internal data class NativeProfile(val id: String, val username: String, val displayName: String, val bio: String)
internal data class NativeThread(val id: String, val title: String, val kind: String)
internal data class NativeMessage(val id: String, val senderId: String, val body: String, val createdAt: String)
internal data class NativeReel(val id: String, val title: String, val caption: String, val videoUrl: String)

internal class SupabaseNativeRepository(context: Context) {
    private val sessions = NativeSessionStore(context)
    private val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val anonKey = BuildConfig.SUPABASE_ANON_KEY

    fun cachedSession(): NativeSession? = sessions.read()
    fun signOut() = sessions.clear()

    suspend fun restoreSession(): NativeSession? = withContext(Dispatchers.IO) { freshSession() }

    private fun freshSession(): NativeSession? {
        val existing = sessions.read() ?: return null
        if (existing.expiresAt > System.currentTimeMillis() / 1000 + 60) return existing
        return runCatching {
            val refreshed = requestObject(
                "POST", "/auth/v1/token?grant_type=refresh_token",
                JSONObject().put("refresh_token", existing.refreshToken), anonKey,
            )
            parseSession(refreshed).also(sessions::write)
        }.getOrElse {
            sessions.clear()
            null
        }
    }

    suspend fun signIn(email: String, password: String): NativeSession = withContext(Dispatchers.IO) {
        val json = requestObject("POST", "/auth/v1/token?grant_type=password", JSONObject().apply {
            put("email", email.trim())
            put("password", password)
        }, bearer = anonKey)
        parseSession(json).also(sessions::write)
    }

    suspend fun signUp(displayName: String, email: String, password: String): Boolean = withContext(Dispatchers.IO) {
        val redirect = encodeQueryValue("online.veloryz.velori://auth/confirm")
        val json = requestObject("POST", "/auth/v1/signup?redirect_to=$redirect", JSONObject().apply {
            put("email", email.trim())
            put("password", password)
            put("data", JSONObject().put("display_name", displayName.trim()))
        }, bearer = anonKey)
        if (json.has("access_token") && json.has("refresh_token")) {
            parseSession(json).also(sessions::write)
            true
        } else false
    }

    suspend fun requestPasswordRecovery(email: String) = withContext(Dispatchers.IO) {
        val redirect = encodeQueryValue("online.veloryz.velori://auth/reset-password")
        requestRaw(
            "POST",
            "/auth/v1/recover?redirect_to=$redirect",
            JSONObject().put("email", email.trim()),
            bearer = anonKey,
        )
    }

    suspend fun verifyAuthLink(tokenHash: String, type: String): NativeSession = withContext(Dispatchers.IO) {
        require(type in setOf("email", "signup", "recovery")) { "This VELORI link is not supported." }
        val json = requestObject(
            "POST",
            "/auth/v1/verify",
            JSONObject().put("token_hash", tokenHash).put("type", type),
            bearer = anonKey,
        )
        parseSession(json).also(sessions::write)
    }

    suspend fun restoreAuthLinkSession(accessToken: String, refreshToken: String, expiresIn: Long): NativeSession = withContext(Dispatchers.IO) {
        val user = requestObject("GET", "/auth/v1/user", null, bearer = accessToken)
        val session = NativeSession(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = user.getString("id"),
            email = user.optString("email"),
            expiresAt = System.currentTimeMillis() / 1000 + expiresIn.coerceAtLeast(1),
        )
        sessions.write(session)
        session
    }

    suspend fun updatePassword(session: NativeSession, password: String) = withContext(Dispatchers.IO) {
        val bearer = freshSession()?.accessToken ?: session.accessToken
        requestRaw("PUT", "/auth/v1/user", JSONObject().put("password", password), bearer)
    }

    suspend fun loadFeed(): List<NativePost> = withContext(Dispatchers.IO) {
        val bearer = freshSession()?.accessToken
        val items = requestArray(
            "GET",
            "/rest/v1/posts?select=id,body,created_at,profiles!posts_author_id_fkey(username,display_name)" +
                "&deleted_at=is.null&archived_at=is.null&is_published=eq.true&is_hidden=eq.false&order=created_at.desc&limit=30",
            null, bearer,
        )
        (0 until items.length()).map { index ->
            val item = items.getJSONObject(index)
            val profile = item.optJSONObject("profiles") ?: JSONObject()
            NativePost(
                item.getString("id"), item.optString("body"),
                profile.optString("display_name").ifBlank { "@${profile.optString("username", "member")}" },
                item.optString("created_at"),
            )
        }
    }

    suspend fun loadExplore(): List<NativeProfile> = withContext(Dispatchers.IO) {
        val items = requestArray(
            "GET",
            "/rest/v1/profiles?select=id,username,display_name,bio&is_private=eq.false&order=created_at.desc&limit=40",
            null,
        )
        (0 until items.length()).map { index ->
            val item = items.getJSONObject(index)
            NativeProfile(item.getString("id"), item.optString("username"), item.optString("display_name"), item.optString("bio"))
        }
    }

    suspend fun loadReels(): List<NativeReel> = withContext(Dispatchers.IO) {
        val rows = requestArray(
            "GET",
            "/rest/v1/reels?select=id,title,caption,video_url&status=eq.published&is_deleted=eq.false" +
                "&visibility=eq.public&order=published_at.desc&limit=30",
            null,
        )
        (0 until rows.length()).map { index -> rows.getJSONObject(index).let {
            NativeReel(it.getString("id"), it.optString("title"), it.optString("caption"), it.optString("video_url"))
        } }
    }

    suspend fun loadProfile(userId: String): NativeProfile? = withContext(Dispatchers.IO) {
        val rows = requestArray("GET", "/rest/v1/profiles?select=id,username,display_name,bio&id=eq.$userId&limit=1", null, freshSession()?.accessToken)
        if (rows.length() == 0) null else rows.getJSONObject(0).let {
            NativeProfile(it.getString("id"), it.optString("username"), it.optString("display_name"), it.optString("bio"))
        }
    }

    suspend fun createPost(session: NativeSession, body: String) = withContext(Dispatchers.IO) {
        val bearer = freshSession()?.accessToken ?: session.accessToken
        requestRaw("POST", "/rest/v1/posts", JSONObject().apply {
            put("author_id", session.userId)
            put("body", body.trim())
        }, bearer, "return=minimal")
    }

    suspend fun loadThreads(session: NativeSession): List<NativeThread> = withContext(Dispatchers.IO) {
        val bearer = freshSession()?.accessToken ?: session.accessToken
        val rows = requestArray(
            "GET",
            "/rest/v1/conversation_participants?select=conversation_id,conversations(id,title,kind,last_message_at)" +
                "&user_id=eq.${session.userId}&archived_at=is.null&order=joined_at.desc&limit=50",
            null, bearer,
        )
        (0 until rows.length()).mapNotNull { index ->
            val conversation = rows.getJSONObject(index).optJSONObject("conversations") ?: return@mapNotNull null
            NativeThread(
                conversation.getString("id"), conversation.optString("title").ifBlank { "Conversation" },
                conversation.optString("kind", "direct"),
            )
        }
    }

    suspend fun openDirectConversation(session: NativeSession, otherUserId: String): String = withContext(Dispatchers.IO) {
        val bearer = freshSession()?.accessToken ?: session.accessToken
        org.json.JSONTokener(
            requestRaw("POST", "/rest/v1/rpc/open_direct_conversation", JSONObject().put("p_other_user_id", otherUserId), bearer),
        ).nextValue().toString()
    }

    suspend fun loadMessages(session: NativeSession, conversationId: String): List<NativeMessage> = withContext(Dispatchers.IO) {
        val bearer = freshSession()?.accessToken ?: session.accessToken
        val rows = requestArray(
            "GET",
            "/rest/v1/messages?select=id,sender_id,body,created_at,deleted_at&conversation_id=eq.$conversationId" +
                "&deleted_at=is.null&order=created_at.asc&limit=100",
            null, bearer,
        )
        (0 until rows.length()).map { index -> rows.getJSONObject(index).let {
            NativeMessage(it.getString("id"), it.getString("sender_id"), it.optString("body"), it.optString("created_at"))
        } }
    }

    suspend fun sendMessage(session: NativeSession, conversationId: String, body: String) = withContext(Dispatchers.IO) {
        val bearer = freshSession()?.accessToken ?: session.accessToken
        requestRaw("POST", "/rest/v1/messages", JSONObject().apply {
            put("conversation_id", conversationId)
            put("sender_id", session.userId)
            put("kind", "text")
            put("body", body.trim())
            put("client_nonce", java.util.UUID.randomUUID().toString())
        }, bearer, "return=minimal")
    }

    private fun parseSession(json: JSONObject): NativeSession {
        val user = json.getJSONObject("user")
        return NativeSession(
            json.getString("access_token"), json.getString("refresh_token"), user.getString("id"),
            user.optString("email"), System.currentTimeMillis() / 1000 + json.optLong("expires_in", 3600),
        )
    }

    private fun requestArray(method: String, path: String, body: JSONObject?, bearer: String? = null): JSONArray =
        JSONArray(requestRaw(method, path, body, bearer, "return=representation"))

    private fun requestObject(
        method: String,
        path: String,
        body: JSONObject?,
        bearer: String? = sessions.read()?.accessToken,
        prefer: String? = null,
    ): JSONObject = JSONObject(requestRaw(method, path, body, bearer, prefer))

    private fun requestRaw(
        method: String,
        path: String,
        body: JSONObject?,
        bearer: String? = sessions.read()?.accessToken,
        prefer: String? = null,
    ): String {
        check(baseUrl.startsWith("https://") && anonKey.isNotBlank()) {
            "The native Supabase connection is not configured in this build."
        }
        val connection = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 20_000
            setRequestProperty("apikey", anonKey)
            setRequestProperty("Authorization", "Bearer ${bearer ?: anonKey}")
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            if (prefer != null) setRequestProperty("Prefer", prefer)
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray()) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val failure = runCatching { JSONObject(response) }.getOrNull() ?: JSONObject()
                val code = failure.optString("code", failure.optString("error_code"))
                val message = failure.optString("message", failure.optString("msg"))
                error(friendlyRequestError(code, message, status))
            }
            return response
        } finally {
            connection.disconnect()
        }
    }

    private fun encodeQueryValue(value: String): String =
        URLEncoder.encode(value, Charsets.UTF_8.name())

    private fun friendlyRequestError(code: String, message: String, status: Int): String = when {
        code == "invalid_credentials" -> "The email or password is incorrect. Please try again."
        code == "email_not_confirmed" -> "Please confirm your email from the link we sent before signing in."
        code == "user_already_exists" || code == "email_exists" || message.contains("already registered", true) ->
            "An account already exists for that email. Sign in or reset your password."
        code == "weak_password" || message.contains("password should be", true) ->
            "Choose a password with at least 12 characters, including a letter and a number or symbol."
        code == "otp_expired" -> "This link has expired or has already been used. Request a new email."
        code == "over_email_send_rate_limit" ->
            "Email delivery is temporarily rate limited. Please try again later."
        code == "over_request_rate_limit" -> "Too many attempts. Please wait before trying again."
        message.contains("redirect", true) && message.contains("allow", true) ->
            "The VELORI email link is not enabled in Supabase Auth settings yet. Add the native callback URL to the allowed redirect URLs."
        status >= 500 -> "VELORI is temporarily unavailable. Please try again shortly."
        message.contains("network", true) -> "We couldn't connect. Check your connection and try again."
        else -> "VELORI couldn't complete that request. Please try again."
    }

}
