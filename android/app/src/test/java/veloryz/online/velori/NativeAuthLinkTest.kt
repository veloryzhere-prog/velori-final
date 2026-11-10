package veloryz.online.velori

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeAuthLinkTest {
    @Test
    fun `accepts the configured email confirmation callback`() {
        val callback = NativeAuthCallback.parse(
            "online.veloryz.velori://auth/confirm?token_hash=abc123&type=email",
        )

        assertEquals(NativeAuthPurpose.CONFIRM_EMAIL, callback?.purpose)
        assertEquals("abc123", callback?.tokenHash)
    }

    @Test
    fun `accepts recovery callback tokens in a fragment`() {
        val callback = NativeAuthCallback.parse(
            "online.veloryz.velori://auth/reset-password#access_token=access&refresh_token=refresh&type=recovery&expires_in=3600",
        )

        assertEquals(NativeAuthPurpose.RESET_PASSWORD, callback?.purpose)
        assertEquals("access", callback?.accessToken)
        assertEquals("refresh", callback?.refreshToken)
        assertEquals(3600L, callback?.expiresInSeconds)
    }

    @Test
    fun `accepts the https confirmation route only on the VELORI domain`() {
        val callback = NativeAuthCallback.parse(
            "https://chat.veloryz.online/auth/confirm?token_hash=abc123&type=signup",
        )

        assertEquals(NativeAuthPurpose.CONFIRM_EMAIL, callback?.purpose)
        assertNull(NativeAuthCallback.parse("https://example.com/auth/confirm?token_hash=a&type=email"))
    }

    @Test
    fun `rejects unsupported hosts paths types and incomplete credentials`() {
        assertNull(NativeAuthCallback.parse("online.veloryz.velori://auth/confirm?token_hash=a&type=recovery"))
        assertNull(NativeAuthCallback.parse("online.veloryz.velori://messages/thread?token_hash=a&type=email"))
        assertNull(NativeAuthCallback.parse("online.veloryz.velori://auth/confirm?type=email"))
        assertNull(NativeAuthCallback.parse("https://chat.veloryz.online/auth/confirm?token_hash=a&type=magiclink"))
    }

    @Test
    fun `matches browser email and password validation`() {
        assertEquals("person@example.com", normalizeNativeEmail(" Person@Example.com "))
        assertTrue(isValidNativeEmail("person@example.com"))
        assertFalse(isValidNativeEmail("person@localhost"))
        assertFalse(isValidNativeEmail("person..name@example.com"))
        assertTrue(isStrongNativePassword("velori-pass-123"))
        assertFalse(isStrongNativePassword("short1!"))
        assertFalse(isStrongNativePassword("lettersonlylong"))
    }

    @Test
    fun `maps only supported app links to native destinations`() {
        assertEquals(
            NativeAppDestination.EXPLORE,
            resolveNativeAppDestination("online.veloryz.velori://explore"),
        )
        assertEquals(
            NativeAppDestination.REELS,
            resolveNativeAppDestination("https://chat.veloryz.online/reels"),
        )
        assertEquals(
            NativeAppDestination.MESSAGES,
            resolveNativeAppDestination("online.veloryz.velori://messages"),
        )
        assertNull(resolveNativeAppDestination("https://evil.example/home"))
        assertNull(resolveNativeAppDestination("online.veloryz.velori://settings"))
    }
}
