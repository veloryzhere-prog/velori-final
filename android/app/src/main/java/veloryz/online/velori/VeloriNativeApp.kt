package veloryz.online.velori

import android.content.Context
import android.net.Uri
import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

private val Canvas = Color(0xFFFAF8FC)
private val Paper = Color.White
private val Ink = Color(0xFF211428)
private val Muted = Color(0xFF77677E)
private val Line = Color(0xFFDFD4E7)
private val Accent = Color(0xFF922FE6)
private val Tint = Color(0xFFEEE1FA)

private enum class Destination(val label: String, val mark: String) {
    Home("Home", "⌂"), Explore("Explore", "⌕"), Create("Add", "+"), Messages("Messages", "◌"), Profile("Profile", "●"),
}

@Composable
internal fun VeloriNativeApp(context: Context) {
    val repository = remember { SupabaseNativeRepository(context) }
    val scope = rememberCoroutineScope()
    var session by remember { mutableStateOf(repository.cachedSession()) }
    var page by remember { mutableStateOf(Destination.Home) }
    var authMode by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var posts by remember { mutableStateOf<List<NativePost>>(emptyList()) }
    var people by remember { mutableStateOf<List<NativeProfile>>(emptyList()) }
    var profile by remember { mutableStateOf<NativeProfile?>(null) }
    var threads by remember { mutableStateOf<List<NativeThread>>(emptyList()) }
    var activeThread by remember { mutableStateOf<NativeThread?>(null) }
    var messages by remember { mutableStateOf<List<NativeMessage>>(emptyList()) }
    var reels by remember { mutableStateOf<List<NativeReel>>(emptyList()) }
    var showReels by remember { mutableStateOf(false) }

    LaunchedEffect(page, session?.userId, activeThread?.id, showReels) {
        error = null
        runCatching {
            if (page == Destination.Home && showReels) reels = repository.loadReels() else when (page) {
                Destination.Home -> posts = repository.loadFeed()
                Destination.Explore -> people = repository.loadExplore()
                Destination.Messages -> if (session != null) {
                    threads = repository.loadThreads(session!!)
                    activeThread?.let { messages = repository.loadMessages(session!!, it.id) }
                }
                Destination.Profile -> if (session != null) profile = repository.loadProfile(session!!.userId)
                Destination.Create -> Unit
            }
        }.onFailure { error = it.message ?: "Could not load this screen." }
    }

    MaterialTheme(colorScheme = lightColorScheme(
        primary = Accent, onPrimary = Color.White, background = Canvas, surface = Paper,
        onBackground = Ink, onSurface = Ink, outline = Line,
    )) {
        if (authMode != null) {
            AuthScreen(
                mode = authMode!!, busy = busy, error = error, notice = notice,
                onBack = { authMode = null; error = null; notice = null },
                onModeChange = { authMode = it; error = null; notice = null },
                onSubmit = { email, password ->
                    busy = true; error = null; notice = null
                    scope.launch {
                        runCatching {
                            if (authMode == "Create account") repository.signUp(email, password)
                            else { repository.signIn(email, password); true }
                        }.onSuccess { signedIn ->
                            if (signedIn) { session = repository.cachedSession(); authMode = null; notice = "Welcome to VELORI." }
                            else notice = "Check your email to confirm your account, then sign in."
                        }.onFailure { error = it.message ?: "Authentication failed." }
                        busy = false
                    }
                },
            )
            return@MaterialTheme
        }

        Scaffold(
            containerColor = Canvas,
            contentWindowInsets = WindowInsets.statusBars,
            topBar = {
                NativeHeader(
                    title = if (activeThread != null && page == Destination.Messages) activeThread!!.title else "VELORI",
                subtitle = if (showReels) "Reels" else if (session == null) "A place for what moves you" else "Your people, your moments",
                leadingAction = if (showReels) ({ showReels = false }) else if (activeThread != null && page == Destination.Messages) ({ activeThread = null }) else null,
                    onSignIn = { authMode = "Sign in" }, signedIn = session != null,
                )
            },
            bottomBar = {
                NavigationBar(
                    containerColor = Paper,
                    windowInsets = WindowInsets.navigationBars,
                ) {
                    Destination.entries.forEach { destination ->
                        NavigationBarItem(
                            selected = page == destination,
                            onClick = {
                                if (destination == Destination.Messages && session == null || destination == Destination.Profile && session == null) {
                                    authMode = "Sign in"
                                } else {
                                    if (destination != Destination.Messages) activeThread = null
                                    showReels = false
                                    page = destination
                                }
                            },
                            icon = { Text(destination.mark, fontSize = if (destination == Destination.Create) 25.sp else 21.sp, fontWeight = FontWeight.SemiBold) },
                            label = { Text(destination.label, fontSize = 10.sp) },
                            alwaysShowLabel = true,
                        )
                    }
                }
            },
        ) { scaffoldPadding ->
            Column(Modifier.fillMaxSize().padding(scaffoldPadding)) {
                if (notice != null) NoticeBanner(notice!!, onDismiss = { notice = null })
                if (error != null) ErrorBanner(error!!, onRetry = {
                    val current = page
                    page = Destination.Home
                    page = current
                })
                if (showReels) {
                    ReelsScreen(reels)
                } else when (page) {
                    Destination.Home -> FeedScreen(posts, busy, onReels = { showReels = true }, onRefresh = {
                        scope.launch { runCatching { posts = repository.loadFeed() }.onFailure { error = it.message } }
                    })
                    Destination.Explore -> ExploreScreen(people, session != null, onSignIn = { authMode = "Sign in" }, onMessage = { person ->
                        val current = session ?: return@ExploreScreen
                        busy = true
                        scope.launch {
                            runCatching {
                                val id = repository.openDirectConversation(current, person.id)
                                activeThread = NativeThread(id, person.displayName.ifBlank { "@${person.username}" }, "direct")
                                page = Destination.Messages
                            }.onFailure { error = it.message }
                            busy = false
                        }
                    })
                    Destination.Create -> CreateScreen(session != null, busy, onSignIn = { authMode = "Sign in" }, onPublish = { body ->
                        val current = session ?: return@CreateScreen
                        busy = true; error = null
                        scope.launch {
                            runCatching { repository.createPost(current, body) }
                                .onSuccess { notice = "Your post is live."; page = Destination.Home }
                                .onFailure { error = it.message }
                            busy = false
                        }
                    })
                    Destination.Messages -> if (activeThread == null) {
                        InboxScreen(threads, onOpen = { activeThread = it })
                    } else {
                        ThreadScreen(messages, session?.userId.orEmpty(), busy, onSend = { body, complete ->
                            val current = session ?: return@ThreadScreen
                            val thread = activeThread ?: return@ThreadScreen
                            busy = true
                            scope.launch {
                                runCatching { repository.sendMessage(current, thread.id, body); repository.loadMessages(current, thread.id) }
                                    .onSuccess { messages = it; complete(true) }
                                    .onFailure { error = it.message; complete(false) }
                                busy = false
                            }
                        })
                    }
                    Destination.Profile -> ProfileScreen(profile, session?.email.orEmpty(), onSignOut = {
                        repository.signOut(); session = null; profile = null; page = Destination.Home
                        notice = "You are signed out."
                    })
                }
            }
        }
    }
}

@Composable
private fun NativeHeader(title: String, subtitle: String, leadingAction: (() -> Unit)?, onSignIn: () -> Unit, signedIn: Boolean) {
    Row(
        Modifier.fillMaxWidth().background(Paper)
            .padding(WindowInsets.statusBars.asPaddingValues())
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leadingAction != null) {
            Text("‹", Modifier.clickable(onClick = leadingAction).padding(end = 14.dp), color = Accent, fontSize = 34.sp)
        }
        Column(Modifier.weight(1f)) {
            Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Text(subtitle, color = Muted, fontSize = 12.sp)
        }
        if (!signedIn) TextButton(onClick = onSignIn) { Text("Sign in") }
    }
    Divider(color = Line.copy(alpha = .75f), thickness = .6.dp)
}

@Composable
private fun FeedScreen(posts: List<NativePost>, busy: Boolean, onReels: () -> Unit, onRefresh: () -> Unit) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 18.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(Modifier.fillMaxWidth().background(Tint, RoundedCornerShape(24.dp)).padding(22.dp)) {
                Text("Your world, in motion.", color = Ink, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                Text("Stories, ideas and people worth coming back to.", color = Muted, modifier = Modifier.padding(top = 6.dp))
                TextButton(onClick = onReels, modifier = Modifier.padding(top = 6.dp)) { Text("Watch Reels  →") }
            }
        }
        if (busy) item { LoadingRow() }
        if (posts.isEmpty() && !busy) item {
            EmptyCard("The feed is quiet right now", "Public posts from the community will appear here when available.")
        }
        items(posts, key = { it.id }) { post ->
            Surface(color = Paper, shape = RoundedCornerShape(20.dp), tonalElevation = 1.dp) {
                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                    Text(post.author, fontWeight = FontWeight.SemiBold, color = Ink)
                    Text(post.createdAt.toDateLabel(), color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                    Text(post.body, color = Ink, fontSize = 16.sp, lineHeight = 24.sp, modifier = Modifier.padding(top = 14.dp))
                    Text("VELORI", color = Accent, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp))
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                TextButton(onClick = onRefresh) { Text("Refresh feed") }
            }
        }
    }
}

@Composable
private fun ReelsScreen(reels: List<NativeReel>) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { ScreenIntro("Reels", "Public videos shared by the VELORI community.") }
        if (reels.isEmpty()) item { EmptyCard("No public reels yet", "Published public reels will appear here when available.") }
        items(reels, key = { it.id }) { reel ->
            Surface(color = Paper, shape = RoundedCornerShape(20.dp), tonalElevation = 1.dp) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    if (reel.videoUrl.startsWith("https://")) {
                        AndroidView(
                            modifier = Modifier.fillMaxWidth().height(420.dp),
                            factory = { context ->
                                VideoView(context).apply {
                                    val controller = MediaController(context)
                                    controller.setAnchorView(this)
                                    setMediaController(controller)
                                    setVideoURI(Uri.parse(reel.videoUrl))
                                    setOnPreparedListener { video -> video.isLooping = true; start() }
                                }
                            },
                            onRelease = { it.stopPlayback() },
                        )
                    } else {
                        EmptyCard("Video unavailable", "This reel doesn't have a playable public video URL.")
                    }
                    Text(reel.title.ifBlank { "VELORI Reel" }, color = Ink, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 10.dp))
                    if (reel.caption.isNotBlank()) Text(reel.caption, color = Muted, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}

@Composable
private fun ExploreScreen(people: List<NativeProfile>, signedIn: Boolean, onSignIn: () -> Unit, onMessage: (NativeProfile) -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenIntro("Find your people", "Discover public VELORI profiles.") }
        if (people.isEmpty()) item { EmptyCard("No profiles to show", "Public profiles will appear here when available.") }
        items(people, key = { it.id }) { person ->
            Surface(color = Paper, shape = RoundedCornerShape(18.dp), tonalElevation = 1.dp) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Avatar(person.displayName.ifBlank { person.username })
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(person.displayName.ifBlank { "@${person.username}" }, fontWeight = FontWeight.SemiBold)
                        Text("@${person.username}", color = Muted, fontSize = 12.sp)
                        if (person.bio.isNotBlank()) Text(person.bio, color = Muted, maxLines = 2, fontSize = 13.sp)
                    }
                    TextButton(onClick = { if (signedIn) onMessage(person) else onSignIn() }) { Text("Message") }
                }
            }
        }
    }
}

@Composable
private fun CreateScreen(signedIn: Boolean, busy: Boolean, onSignIn: () -> Unit, onPublish: (String) -> Unit) {
    var body by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ScreenIntro("Create a post", "Share a thought with your VELORI community.")
        if (!signedIn) {
            EmptyCard("Sign in to publish", "Your post will be saved to your account and shared under the platform's existing visibility rules.")
            PrimaryButton("Sign in", onClick = onSignIn)
        } else {
            OutlinedTextField(
                value = body, onValueChange = { body = it.take(2000) }, modifier = Modifier.fillMaxWidth().weight(1f),
                label = { Text("What's on your mind?") }, minLines = 6, shape = RoundedCornerShape(20.dp),
            )
            Text("Text posts are supported here. Add media, stories and reels use their native creation flow in a later phase.", color = Muted, fontSize = 12.sp)
            PrimaryButton(if (busy) "Publishing…" else "Publish post", enabled = body.isNotBlank() && !busy, onClick = { onPublish(body) })
        }
    }
}

@Composable
private fun InboxScreen(threads: List<NativeThread>, onOpen: (NativeThread) -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenIntro("Messages", "Private conversations, protected by your account access.") }
        if (threads.isEmpty()) item { EmptyCard("No conversations yet", "Find someone in Explore and start a conversation.") }
        items(threads, key = { it.id }) { thread ->
            Surface(color = Paper, shape = RoundedCornerShape(18.dp), modifier = Modifier.clickable { onOpen(thread) }) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Avatar(thread.title)
                    Spacer(Modifier.width(12.dp))
                    Column { Text(thread.title, fontWeight = FontWeight.SemiBold); Text(if (thread.kind == "group") "Group conversation" else "Direct conversation", color = Muted, fontSize = 12.sp) }
                }
            }
        }
    }
}

@Composable
private fun ThreadScreen(messages: List<NativeMessage>, currentUserId: String, busy: Boolean, onSend: (String, (Boolean) -> Unit) -> Unit) {
    var draft by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            if (messages.isEmpty()) item { EmptyCard("Start the conversation", "Messages are sent securely through your existing VELORI account.") }
            items(messages, key = { it.id }) { message ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.senderId == currentUserId) Arrangement.End else Arrangement.Start) {
                    Text(message.body, Modifier.background(if (message.senderId == currentUserId) Tint else Paper, RoundedCornerShape(18.dp)).padding(horizontal = 14.dp, vertical = 10.dp), color = Ink)
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(draft, { draft = it.take(2000) }, Modifier.weight(1f), placeholder = { Text("Write a message") }, shape = RoundedCornerShape(24.dp), singleLine = true)
            TextButton(enabled = draft.isNotBlank() && !busy, onClick = {
                onSend(draft.trim()) { sent -> if (sent) draft = "" }
            }) { Text("Send") }
        }
    }
}

@Composable
private fun ProfileScreen(profile: NativeProfile?, email: String, onSignOut: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Spacer(Modifier.height(22.dp))
        Avatar(profile?.displayName?.ifBlank { profile.username } ?: email, size = 84)
        Text(profile?.displayName?.ifBlank { "Your profile" } ?: "Your profile", fontWeight = FontWeight.Bold, fontSize = 23.sp)
        Text(profile?.let { "@${it.username}" } ?: email, color = Muted)
        if (profile?.bio?.isNotBlank() == true) Text(profile.bio, color = Ink)
        if (profile == null) Text("Your profile details are not available right now.", color = Muted)
        Spacer(Modifier.height(10.dp))
        Text("Your account", color = Muted, fontSize = 12.sp)
        Text(email, color = Ink)
        Spacer(Modifier.weight(1f))
        TextButton(onClick = onSignOut) { Text("Sign out") }
    }
}

@Composable
private fun AuthScreen(
    mode: String, busy: Boolean, error: String?, notice: String?, onBack: () -> Unit,
    onModeChange: (String) -> Unit, onSubmit: (String, String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().background(Canvas).padding(WindowInsets.statusBars.asPaddingValues()).imePadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("‹ Back", Modifier.clickable(onClick = onBack).padding(vertical = 8.dp), color = Accent, fontSize = 16.sp)
        Spacer(Modifier.height(16.dp))
        Text("VELORI", color = Accent, fontWeight = FontWeight.Black, fontSize = 16.sp)
        Text(mode, color = Ink, fontWeight = FontWeight.Bold, fontSize = 30.sp)
        Text("Use your existing VELORI account. Email confirmation remains enabled for new accounts.", color = Muted)
        OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Email") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), singleLine = true)
        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), singleLine = true)
        if (error != null) Text(error, color = Color(0xFFC42453))
        if (notice != null) Text(notice, color = Color(0xFF147A50))
        PrimaryButton(if (busy) "Please wait…" else mode, enabled = !busy && email.contains('@') && password.length >= 8, onClick = { onSubmit(email, password) })
        TextButton(onClick = { onModeChange(if (mode == "Sign in") "Create account" else "Sign in") }) {
            Text(if (mode == "Sign in") "New to VELORI? Create an account" else "Already have an account? Sign in")
        }
        Spacer(Modifier.weight(1f))
        Text("Your session is encrypted with Android Keystore on this device.", color = Muted, fontSize = 12.sp)
    }
}

@Composable
private fun ScreenIntro(title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
        Text(title, color = Ink, fontSize = 25.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = Muted, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun Avatar(label: String, size: Int = 48) {
    val initial = label.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "V"
    Surface(color = Tint, shape = CircleShape, modifier = Modifier.size(size.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(initial, color = Accent, fontWeight = FontWeight.Bold, fontSize = (size / 2.5).sp)
        }
    }
}

@Composable
private fun EmptyCard(title: String, subtitle: String) {
    Surface(color = Paper, shape = RoundedCornerShape(20.dp), tonalElevation = 1.dp) {
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            Text(title, color = Ink, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 5.dp))
        }
    }
}

@Composable
private fun PrimaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick, enabled = enabled, modifier = Modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Accent),
    ) { Text(label, fontWeight = FontWeight.SemiBold) }
}

@Composable
private fun LoadingRow() {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) { CircularProgressIndicator(Modifier.size(24.dp), color = Accent, strokeWidth = 2.dp) }
}

@Composable
private fun ErrorBanner(message: String, onRetry: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(Color(0xFFFFEEF2)).padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(message, Modifier.weight(1f), color = Color(0xFFC42453), fontSize = 12.sp)
        TextButton(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
private fun NoticeBanner(message: String, onDismiss: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(Tint).padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(message, Modifier.weight(1f), color = Ink, fontSize = 13.sp)
        TextButton(onClick = onDismiss) { Text("Dismiss") }
    }
}

private fun String.toDateLabel(): String = runCatching {
    val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).parse(take(19))
    SimpleDateFormat("MMM d · h:mm a", Locale.getDefault()).format(parsed ?: Date())
}.getOrDefault("")
