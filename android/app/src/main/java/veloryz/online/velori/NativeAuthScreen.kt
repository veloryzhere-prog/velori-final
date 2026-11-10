package veloryz.online.velori

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal enum class NativeAuthMode(val title: String) {
    SIGN_IN("Sign in"),
    SIGN_UP("Create account"),
    FORGOT_PASSWORD("Reset password"),
    NEW_PASSWORD("Choose a new password"),
}

@Composable
internal fun NativeAuthScreen(
    mode: NativeAuthMode,
    busy: Boolean,
    error: String?,
    notice: String?,
    onBack: () -> Unit,
    onModeChange: (NativeAuthMode) -> Unit,
    onSubmit: (displayName: String, email: String, password: String) -> Unit,
) {
    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember(mode) { mutableStateOf("") }
    var confirmation by remember(mode) { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    val canSubmit = when (mode) {
        NativeAuthMode.SIGN_IN -> isValidNativeEmail(email) && password.isNotEmpty()
        NativeAuthMode.SIGN_UP -> displayName.trim().isNotEmpty() && isValidNativeEmail(email) &&
            isStrongNativePassword(password) && password == confirmation
        NativeAuthMode.FORGOT_PASSWORD -> isValidNativeEmail(email)
        NativeAuthMode.NEW_PASSWORD -> isStrongNativePassword(password) && password == confirmation
    }
    val passwordTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation()

    Column(
        Modifier.fillMaxSize()
            .background(NativeCanvas)
            .padding(WindowInsets.statusBars.asPaddingValues())
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("‹ Back", Modifier.clickable(onClick = onBack).padding(vertical = 8.dp), color = NativeAccent, fontSize = 16.sp)
        Text("VELORI", color = NativeAccent, fontWeight = FontWeight.Black, fontSize = 16.sp)
        Text(mode.title, color = NativeInk, fontWeight = FontWeight.Bold, fontSize = 30.sp)
        Text(
            when (mode) {
                NativeAuthMode.SIGN_UP -> "Create your account. We'll email a secure confirmation link."
                NativeAuthMode.FORGOT_PASSWORD -> "Enter your account email and we'll send a secure recovery link."
                NativeAuthMode.NEW_PASSWORD -> "Choose a new password for your VELORI account."
                NativeAuthMode.SIGN_IN -> "Sign in with the account you already use on VELORI."
            },
            color = NativeMuted,
        )
        if (mode == NativeAuthMode.SIGN_UP) {
            OutlinedTextField(
                displayName,
                { displayName = it.take(80) },
                Modifier.fillMaxWidth(),
                label = { Text("Full name") },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
            )
        }
        if (mode != NativeAuthMode.NEW_PASSWORD) {
            OutlinedTextField(
                email,
                { email = it.take(254) },
                Modifier.fillMaxWidth(),
                label = { Text("Email") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
            )
        }
        if (mode != NativeAuthMode.FORGOT_PASSWORD) {
            OutlinedTextField(
                password,
                { password = it.take(128) },
                Modifier.fillMaxWidth(),
                label = { Text(if (mode == NativeAuthMode.NEW_PASSWORD) "New password" else "Password") },
                visualTransformation = passwordTransformation,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
            )
            TextButton(onClick = { passwordVisible = !passwordVisible }) {
                Text(if (passwordVisible) "Hide password" else "Show password")
            }
            if (mode == NativeAuthMode.SIGN_UP || mode == NativeAuthMode.NEW_PASSWORD) {
                OutlinedTextField(
                    confirmation,
                    { confirmation = it.take(128) },
                    Modifier.fillMaxWidth(),
                    label = { Text("Confirm password") },
                    visualTransformation = passwordTransformation,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                )
                Text("Use at least 12 characters with a letter and a number or symbol.", color = NativeMuted, fontSize = 12.sp)
            }
        }
        if (error != null) Text(error, color = NativeError, fontSize = 13.sp)
        if (notice != null) Text(notice, color = NativeSuccess, fontSize = 13.sp)
        NativePrimaryButton(
            label = if (busy) "Please wait…" else when (mode) {
                NativeAuthMode.SIGN_IN -> "Sign in"
                NativeAuthMode.SIGN_UP -> "Create account"
                NativeAuthMode.FORGOT_PASSWORD -> "Send recovery email"
                NativeAuthMode.NEW_PASSWORD -> "Update password"
            },
            enabled = canSubmit && !busy,
            onClick = { onSubmit(displayName.trim(), normalizeNativeEmail(email), password) },
        )
        when (mode) {
            NativeAuthMode.SIGN_IN -> {
                TextButton(onClick = { onModeChange(NativeAuthMode.FORGOT_PASSWORD) }) { Text("Forgot password?") }
                TextButton(onClick = { onModeChange(NativeAuthMode.SIGN_UP) }) { Text("New to VELORI? Create an account") }
            }
            NativeAuthMode.SIGN_UP -> TextButton(onClick = { onModeChange(NativeAuthMode.SIGN_IN) }) {
                Text("Already have an account? Sign in")
            }
            NativeAuthMode.FORGOT_PASSWORD, NativeAuthMode.NEW_PASSWORD -> TextButton(onClick = { onModeChange(NativeAuthMode.SIGN_IN) }) {
                Text("Back to sign in")
            }
        }
        Text("Your session is protected by Android Keystore on this device.", color = NativeMuted, fontSize = 12.sp)
    }
}

private val NativeCanvas = Color(0xFFFAF8FC)
private val NativeInk = Color(0xFF211428)
private val NativeMuted = Color(0xFF77677E)
private val NativeAccent = Color(0xFF922FE6)
private val NativeError = Color(0xFFC42453)
private val NativeSuccess = Color(0xFF147A50)

@Composable
private fun NativePrimaryButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = NativeAccent),
    ) { Text(label, fontWeight = FontWeight.SemiBold) }
}
