import { forgeGuides } from "./forge-guides.ts";
export type InformationSection = { title: string; text: string; items?: string[] };
export type InformationPage = {
  label: string;
  category: string;
  title: string;
  intro: string;
  accent: string;
  sections: InformationSection[];
  actions: { label: string; to: string }[];
  questions?: { question: string; answer: string }[];
  status?: string;
};
const s = (title: string, text: string, items?: string[]) => ({ title, text, items });
const a = (label: string, to: string) => ({ label, to });
export const informationPages: Record<string, InformationPage> = {
  veloryz: {
    label: "VELORYZ",
    category: "THE STUDIO BEHIND VELORI",
    title: "Ideas, made into everyday experiences.",
    intro:
      "VELORYZ builds digital products and thoughtful interfaces. VELORI is our social platform for sharing, creating and staying connected.",
    accent: "Independent. People first.",
    sections: [
      s(
        "A studio with a product mindset",
        "VELORYZ brings product design, website development, interface design and backend management together. VELORI puts that work into one social experience.",
      ),
      s(
        "The people behind the product",
        "VELORI is a VELORYZ product, created by Aryan Raj Singh. Our work focuses on clear interfaces, useful creative tools and dependable account controls.",
      ),
      s("What we are building", "A connected experience for everyday expression.", [
        "VELORI: posts, short-form reels, stories and conversations.",
        "Dedicated creation studios for posts, reels and stories.",
        "Privacy-aware profiles, groups and community discovery.",
        "VELORYZ AI: a separate planned experience, currently under construction.",
      ]),
      s(
        "A direct way to reach us",
        "Use the official contact details on our Contact page for product questions, collaboration or feedback.",
      ),
    ],
    actions: [a("Explore VELORI", "/about"), a("Talk to the team", "/contact")],
  },
  about: {
    label: "About VELORI",
    category: "YOUR WORLD. YOUR PEOPLE.",
    title: "A place for your kind of connection.",
    intro:
      "Share the little moments, create something that feels like you, and keep your people close. VELORI brings posts, stories, reels and conversation into one space.",
    accent: "A VELORYZ product",
    sections: [
      s(
        "Your perspective, in a post",
        "Create a photo, gallery or written thought. Add a caption, choose an audience and keep unfinished ideas as drafts.",
      ),
      s(
        "The moments in between",
        "Stories give the day a place to live. Reels bring ideas into motion. Each has a dedicated creation studio and a focused viewing experience.",
      ),
      s(
        "Conversations with a little more personality",
        "Direct and group chats support replies, reactions, attachments and voice notes. Open the conversation name for shared media, people, nicknames, themes and safety controls.",
      ),
      s(
        "Your circle, your boundaries",
        "Choose who can message you and how your profile and connection lists appear. Mutual connections show people you both follow when privacy rules allow it.",
      ),
      s(
        "Make the space feel right",
        "Choose your appearance and motion level. Full brings the interface to life, Gentle keeps it calm, and Off keeps it still. Your content stays in your control.",
      ),
    ],
    actions: [a("Find your people", "/people"), a("Create your account", "/signup")],
  },
  blog: {
    label: "Journal",
    category: "THE VELORI JOURNAL",
    title: "What’s new in your world.",
    intro:
      "Product stories, practical guides and the details that make VELORI feel better. Written around the features we are building and improving.",
    accent: "Product updates · October 2026",
    sections: [
      s(
        "A better home for conversations",
        "The inbox now fills the available display, with a stable composer and independent scrolling. Conversation details keep media, reels, files, participants and personal settings together.",
        [
          "Switching a thread clears the previous conversation immediately.",
          "Themes and nicknames personalize your own view.",
          "Queued preference changes show their synchronization status.",
        ],
      ),
      s(
        "The people you both follow",
        "A familiar connection can be a good place to start. Shared following appears on eligible profiles and direct-chat details while respecting private profiles, list visibility and blocking.",
      ),
      s(
        "A little more life, with a little more choice",
        "The parchment announcement opens like a vintage letter. Branded loading loops and interface transitions share the same Full, Gentle and Off controls. Movement stays optional.",
      ),
      s(
        "Your information, easier to find",
        "The rebuilt VELORI directory brings help, product documentation, careers, privacy guidance and our roadmap into one consistent reading experience. Every page is managed through the CMS.",
      ),
      s(
        "Building what comes next",
        "Our roadmap separates available improvements from planned work. VELORYZ AI remains under construction. Check the roadmap for direction without treating planned features as available today.",
      ),
    ],
    actions: [a("Read the roadmap", "/roadmap"), a("Get product help", "/help")],
  },
  jobs: {
    label: "Careers",
    category: "BUILD SOMETHING THAT CONNECTS PEOPLE",
    title: "Good work starts with good people.",
    intro:
      "Help shape a social experience that is creative, clear and easy to use. Explore the kind of work behind VELORI and how to introduce yourself to VELORYZ.",
    accent: "Careers at VELORI / VELORYZ",
    status: "No open positions announced",
    sections: [
      s(
        "Current opportunities",
        "There are no active vacancies announced here today. Future openings will be published on this page with a role description, requirements and a clear application process.",
      ),
      s(
        "The work behind VELORI",
        "These are areas of future team growth, not advertised job openings.",
        [
          "Product design: thoughtful mobile and desktop experiences.",
          "Frontend engineering: accessible interfaces and creative tools.",
          "Backend engineering: reliable data, privacy and media workflows.",
          "Community and trust: clear guidance and responsible support.",
        ],
      ),
      s(
        "Introduce yourself",
        "If you would like to collaborate, send a short introduction, your area of interest and links to work you are comfortable sharing. Use the official email below; it opens your email application and does not create a tracked job application.",
      ),
      s("What to include", "Give the team enough context to understand your work.", [
        "Your name and the kind of work you want to do.",
        "A portfolio, project link or concise description of your experience.",
        "Your preferred way to be contacted.",
      ]),
      s(
        "A simple application safety rule",
        "VELORYZ does not ask for a VELORI password, sign-in code or payment to consider an introduction. Only trust opportunities confirmed through the official contact channel.",
      ),
    ],
    actions: [a("Introduce yourself", "@careers"), a("Meet the studio", "/veloryz")],
  },
  help: {
    label: "Help center",
    category: "A LITTLE HELP GOES A LONG WAY",
    title: "Let’s make it simple.",
    intro:
      "Find clear answers about your account, your content and your conversations. Search the guide or open a topic below.",
    accent: "The VELORI help center",
    sections: [
      s(
        "Your account",
        "Sign in with your account email. Use Forgot password for recovery, and follow the verification link when email confirmation is required.",
      ),
      s(
        "Create and share",
        "Start from Create and choose Post, Reel or Story. Review the preview and audience before publishing. Keep drafts open until their save completes.",
      ),
      s(
        "Messages and media",
        "Open a conversation name for its settings and shared content. The expression picker adds emoji to your draft and lets you choose an animated GIF from your device. Sending follows the same private attachment workflow.",
      ),
      s(
        "Privacy and safety",
        "Review who can message you, profile visibility and connection lists. Block and report controls are available in relevant content and conversation menus.",
      ),
      s(
        "Need a person?",
        "Contact the team with the page address, the action you tried and what happened. Never send passwords or verification codes.",
      ),
    ],
    questions: [
      {
        question: "Why are my animations not moving?",
        answer:
          "Open the motion icon at the top left. Choose Full for animated scenes, Gentle for soft transitions or Off for a still interface. Device setting follows your system preference. Hidden and off-screen loops pause to save work.",
      },
      {
        question: "How do I change my chat theme or nickname?",
        answer:
          "Open the conversation name, choose Settings, then select your personal theme or nickname. These customize your view. Check the synchronization status if you are offline.",
      },
      {
        question: "How can I send emoji or a GIF?",
        answer:
          "Use the expression button beside the message field. Choose an emoji or search the curated categories, or type any Unicode emoji using your device keyboard. The GIF tab lets you upload a GIF from your device. Review its preview and press Send.",
      },
      {
        question: "What does Child Mode do?",
        answer:
          "It is an optional conversation text filter for configured terms and some disguised variants. It can stop a matching outgoing draft and hide matching text. It is self-disableable, does not inspect images, GIFs, video or voice, and is not a parental lock.",
      },
      {
        question: "What does delete for everyone mean?",
        answer:
          "Eligible messages you sent can be deleted for everyone after the service acknowledges the action. Delete for me hides the message from your account. Neither can recall screenshots or existing copies.",
      },
      {
        question: "Where are followers, following and mutuals?",
        answer:
          "Open the connection counts on a profile. People you both follow means shared accepted following, when the target profile’s privacy, connection-list settings and blocks permit it.",
      },
      {
        question: "What if I am offline?",
        answer:
          "A previously visited, cached site may show VELORI’s recovery screen. Reconnect and use Retry. First visits and browser security errors can still show a browser error. Keep unsynced drafts and preferences until they are saved.",
      },
      {
        question: "How do announcements work?",
        answer:
          "Eligible announcements published by the team appear according to their schedule, audience and frequency settings. Full motion unrolls the letter; Gentle fades it in and Off shows it directly. An already dismissed announcement may not appear again.",
      },
      {
        question: "Is VELORYZ AI available?",
        answer:
          "No. VELORYZ AI is under construction. Its page explains the planned direction; it does not provide an active assistant, collect prompts or connect private conversations.",
      },
    ],
    actions: [a("Contact support", "/contact"), a("Safety center", "/safety")],
  },
  developers: {
    label: "Developers & API",
    category: "BUILD WITH VELORI",
    title: "Clear guides for what connects us.",
    intro:
      "Understand VELORI’s product architecture, supported media and integration boundaries. Public developer API registration is under construction.",
    accent: "Developer documentation",
    status: "Public API · under construction",
    sections: [
      s(
        "The current platform",
        "The app uses React, TypeScript, Vite and React Router. Supabase provides authentication, PostgreSQL, private media storage, realtime events and server functions. The admin console manages content, communication and platform settings.",
      ),
      s(
        "Public API availability",
        "No public API keys, app registration or stable third-party API contract are offered here yet. Internal database tables and administrative endpoints must not be treated as public integration APIs.",
      ),
      s(
        "Media in the product",
        "Posts, reels, stories and messages have their own validation and audience rules. Messaging supports JPEG, PNG, WebP, GIF, MP4, PDF and supported audio formats with a 25 MB attachment limit.",
      ),
      s(
        "Running the source project",
        "Follow START_HERE.md in your project download. Use the included lockfile, configure your own environment where needed, then run the project’s development and verification commands. Hosted records and uploaded private media are separate from source.",
      ),
      s("Integration principles", "Keep user permissions and service boundaries explicit.", [
        "Never include an administrative secret in client code.",
        "Respect row-level security, account visibility and media permissions.",
        "Use documented contracts when a public API is released.",
        "Ask the team before automating account or administrative actions.",
      ]),
      s(
        "Have an integration proposal?",
        "Describe the user problem, the data you need and how the user would authorize access. Send the proposal through our official contact channel.",
      ),
    ],
    actions: [a("Discuss an integration", "@developers"), a("View product roadmap", "/roadmap")],
  },
  privacy: {
    label: "Privacy",
    category: "YOUR SPACE. YOUR CHOICES.",
    title: "Privacy you can understand.",
    intro:
      "A practical guide to the information VELORI uses and the controls you can manage. The platform operator is responsible for its complete legal privacy notice.",
    accent: "VELORI privacy guide",
    sections: [
      s(
        "Account and profile data",
        "VELORI uses authentication and profile information to provide your account. Your posts, reels, stories, messages, follows and interactions support the features you choose to use.",
      ),
      s(
        "Audience and visibility",
        "Choose an audience before publishing and review your profile and connection-list settings. Private content is governed by the service’s access policies. Mutual lists respect relevant visibility and blocking controls.",
      ),
      s(
        "Conversations and attachments",
        "Message attachments use private storage and time-limited access links. Recipients may copy content they can access. VELORI does not claim that its direct messages are end-to-end encrypted.",
      ),
      s(
        "Personal preferences",
        "Appearance, motion, recovery drafts and pending changes may be kept on your device. Chat preferences and hidden messages can synchronize to your account. Wait for pending work to save before clearing browser data.",
      ),
      s(
        "Your controls and questions",
        "Use Privacy settings for available controls. For a privacy question or removal concern, contact the team through the official channel. Retention, legal basis and jurisdiction-specific rights belong in the operator’s reviewed notice.",
      ),
    ],
    actions: [a("Manage privacy", "/settings/privacy"), a("Contact the team", "@privacy")],
  },
  terms: {
    label: "Terms",
    category: "SHARING THE SAME SPACE",
    title: "Clear expectations for our community.",
    intro:
      "These product-use expectations explain how to participate responsibly. They do not replace a complete legal agreement reviewed by the platform operator.",
    accent: "VELORI terms overview",
    sections: [
      s(
        "Your account",
        "Protect access to your account. Do not impersonate another person or share verification codes. Use recovery tools when you cannot sign in.",
      ),
      s(
        "What you share",
        "Only publish material you have permission to share. Respect copyright, privacy and other people’s dignity. Choose the audience carefully; content that another person can view may be copied.",
      ),
      s(
        "How we participate",
        "Do not harass, threaten, exploit or defraud people. Do not publish unlawful content, evade access controls or distribute malicious files. Community guidelines explain expected behavior.",
      ),
      s(
        "Moderation and availability",
        "Authorized administrators can manage content and review reports. Features may change or become unavailable during maintenance. This summary does not promise an uptime or moderation response time.",
      ),
      s(
        "Questions and legal terms",
        "Use the official contact channel for questions. Commercial terms, applicable age requirements, dispute processes and jurisdiction-specific provisions require the operator’s reviewed agreement.",
      ),
    ],
    actions: [a("Community guidelines", "/community-guidelines"), a("Contact", "/contact")],
  },
  locations: {
    label: "Places & discovery",
    category: "A WORLD OF PERSPECTIVES",
    title: "Discover a place through its people.",
    intro:
      "Explore places and interests mentioned by the community. Search member content by a city, place name or topic.",
    accent: "VELORI discovery guide",
    sections: [
      s(
        "Start with a place or topic",
        "Use the search below to open VELORI’s existing search experience. Results depend on what members have shared and what your account can access.",
      ),
      s(
        "What a result means",
        "A name in a caption or profile is member-provided information. This is not a verified place database, check-in system or nearby-location map.",
      ),
      s(
        "Share location thoughtfully",
        "Avoid posting a home address, daily routine or another person’s live location without permission. Review a post’s audience before sharing personal details.",
      ),
    ],
    actions: [a("Open Explore", "/explore"), a("Find people", "/people")],
  },
  popular: {
    label: "Explore VELORI",
    category: "FIND YOUR NEXT FAVORITE",
    title: "More perspectives. More possibilities.",
    intro:
      "Discover the people, posts and reels available in your VELORI world. Start with a format and follow what interests you.",
    accent: "Explore & community",
    sections: [
      s(
        "Posts worth a closer look",
        "Open Explore to browse available posts. Save something you want to revisit or open the profile behind it.",
      ),
      s(
        "Ideas in motion",
        "Reels has its own short-form viewer, with next and previous navigation, likes and comments. Creation stays in a separate studio.",
      ),
      s(
        "People make it personal",
        "Search for a username, display name or topic. Follow people whose work you want to see again. Your feed is shaped by the connections you choose.",
      ),
      s(
        "About popularity",
        "This guide does not present an invented global ranking or trending count. Content availability continues to follow the product’s actual visibility rules.",
      ),
    ],
    actions: [
      a("Browse posts", "/explore"),
      a("Watch reels", "/reels"),
      a("Meet people", "/people"),
    ],
  },
  lite: {
    label: "VELORI Lite",
    category: "COMFORTABLE ON YOUR DEVICE",
    title: "A lighter way to spend time here.",
    intro:
      "Adjust the interface to your device and your attention. This guide uses VELORI’s available controls; Lite is not a separate native app.",
    accent: "Device & performance guide",
    sections: [
      s(
        "Choose your motion",
        "Use the motion control to choose Full, Gentle, Off or your device setting. Less interface motion does not automatically reduce the size of uploaded videos.",
      ),
      s(
        "A place on your home screen",
        "When supported and enabled by the platform, your browser can offer installation. Availability varies by browser and device. Use its Install or Add to Home Screen option.",
      ),
      s(
        "Stay ready for connection changes",
        "Previously cached visits may show custom offline recovery. Reconnect before sending or saving, and keep pending drafts until synchronization completes.",
      ),
      s(
        "Everyday comfort",
        "Use current browser software, keep storage space available and choose a motion level that feels comfortable. This page does not promise a measured data-saving percentage.",
      ),
    ],
    actions: [
      a("Open motion controls", "@motion"),
      a("Appearance settings", "/settings/appearance"),
    ],
  },
  "veloryz-ai": {
    label: "VELORYZ AI",
    category: "A NEW IDEA, IN THE MAKING",
    title: "A thoughtful assistant. Still taking shape.",
    intro:
      "VELORYZ AI is under construction. We are exploring ways to help people turn an idea into a clearer draft and a more useful next step.",
    accent: "VELORYZ AI documentation",
    status: "Under construction · not available yet",
    sections: [
      s(
        "What this page is",
        "A preview of the planned direction and its boundaries. There is no active assistant, chat box, prompt submission or AI subscription available here today.",
      ),
      s("The direction we are exploring", "Potential areas of work, not available features.", [
        "Writing support for captions and first drafts.",
        "Idea organization and creative planning.",
        "Clear explanations and practical next steps.",
      ]),
      s(
        "Privacy before access",
        "A future integration should clearly explain its provider, what information is sent and what the user is authorizing. This page does not import VELORI chats or upload account content.",
      ),
      s(
        "Current development stage",
        "The experience and its access model are still being planned. No release date, pricing or usage allowance has been announced.",
      ),
      s(
        "Keep in the loop",
        "Follow the product journal and roadmap for published updates. Product feedback can be sent through the contact page.",
      ),
    ],
    actions: [a("Read the roadmap", "/roadmap"), a("Share feedback", "@ai")],
  },
  "contact-uploading": {
    label: "Contacts & non-users",
    category: "PEOPLE, WITH PERMISSION",
    title: "Your address book stays yours.",
    intro:
      "Find people through VELORI’s existing search and connection tools. Address-book importing and phone-contact matching are not currently offered.",
    accent: "Contacts & non-user guidance",
    sections: [
      s(
        "How people discovery works",
        "Search a profile name or username, explore the People directory and open eligible shared-following lists. These are not matches against your private phone address book.",
      ),
      s(
        "If you do not use VELORI",
        "Someone may mention your name or include your information in content. For a concern, use the official contact channel and describe the relevant page or post without sending unnecessary private information.",
      ),
      s(
        "Before you share another person’s details",
        "Ask permission before posting private contact information, an address or a conversation. Use audience controls thoughtfully.",
      ),
      s(
        "If importing is introduced later",
        "The feature would need clear information about consent, data use, access and removal. It will be documented before being offered.",
      ),
    ],
    actions: [a("Privacy guide", "/privacy"), a("Contact about a concern", "@privacy")],
  },
  verified: {
    label: "Verification",
    category: "IDENTITY & TRUST",
    title: "Trust deserves a clear explanation.",
    intro:
      "Understand account identity and the current limits of verification on VELORI. Paid verification and self-service applications are not available.",
    accent: "VELORI verification guide",
    status: "Public verification program · not launched",
    sections: [
      s(
        "No badge sales",
        "This page does not collect payments, identity documents or verification applications. Do not pay someone who promises a VELORI badge or asks for a sign-in code.",
      ),
      s(
        "Look at the account, not only a badge",
        "A visual badge does not guarantee that every statement, link or offer from an account is safe. Consider the profile and the context before acting.",
      ),
      s(
        "Impersonation concerns",
        "Use the relevant profile, content or message reporting tools. Contact the team through the published channel if you need further guidance.",
      ),
      s(
        "Future program information",
        "If an official verification program is introduced, eligibility and process details will be published here. No external service subscription grants a VELORI entitlement.",
      ),
    ],
    actions: [a("Safety center", "/safety"), a("Contact the team", "@support")],
  },
  roadmap: {
    label: "Roadmap",
    category: "BUILDING THE NEXT CHAPTER",
    title: "A clear view of what comes next.",
    intro:
      "A practical view of the work behind VELORI. Available features and future ideas are separated so you know what you can use today.",
    accent: "Product direction · October 2026",
    sections: [
      s(
        "Available · create and connect",
        "Posts, dedicated creation studios, story and reel viewing, profiles, follows, groups and conversations form the current product.",
      ),
      s(
        "Improving · clarity and reliability",
        "Current work focuses on editable product documentation, chat expression tools, accessible motion and layouts across devices.",
      ),
      s(
        "Planned · VELORYZ AI",
        "The AI experience is under construction. Its provider, access model and release timing have not been announced.",
      ),
      s(
        "Planned · developer access",
        "A public developer API and third-party app registration are not currently available. Integration requirements are being explored.",
      ),
      s(
        "Suggest the next improvement",
        "Tell the team the task you are trying to complete, the difficulty you encountered and the result that would help. Planned work is direction rather than a delivery-date commitment.",
      ),
    ],
    actions: [a("Share a product idea", "@feedback"), a("Read the journal", "/blog")],
  },
  contact: {
    label: "Contact",
    category: "A REAL CONVERSATION STARTS HERE",
    title: "Let’s make something better.",
    intro:
      "Product help, collaboration, privacy questions or thoughtful feedback. Reach the VELORI team through the official channel below.",
    accent: "VELORI / VELORYZ contact",
    sections: [
      s(
        "Product support",
        "Tell us the page, the action you tried, what happened and the approximate time. Include an error reference if one is shown. Never send a password, access code or verification link.",
      ),
      s(
        "Collaboration and careers",
        "Introduce your work, your area of interest and the kind of collaboration you have in mind. See Careers for the current opportunities policy.",
      ),
      s(
        "Privacy and safety questions",
        "Use in-app reporting for a specific message or content item when possible. For a wider concern, describe the issue and share only the information needed to understand it.",
      ),
      s(
        "What happens when you contact us",
        "The contact form prepares an email in your own email application. You review and send it there. It does not silently submit a support ticket or promise a response time.",
      ),
    ],
    actions: [a("Write to the team", "@support"), a("Open Help", "/help")],
  },
  safety: {
    label: "Safety center",
    category: "YOUR BOUNDARIES MATTER",
    title: "Feel more in control.",
    intro: "Practical steps for your account, your audience and your conversations.",
    accent: "VELORI safety guide",
    sections: [
      s(
        "Protect your sign-in",
        "Use a unique password and the genuine site address. Never share verification codes or account recovery links.",
      ),
      s(
        "Set your boundaries",
        "Review private-profile, interaction and messaging choices. Open a chat’s name to find mute, block and report controls.",
      ),
      s(
        "Understand Child Mode",
        "The optional text filter recognizes configured terms and some disguises. It is self-disableable, does not inspect media or audio, and is not a complete child-safety or guardian-lock system.",
      ),
      s(
        "Delete with clear expectations",
        "Delete for me hides a message from your account. Eligible own messages can be deleted for everyone after server acknowledgment. Screenshots and earlier copies cannot be recalled.",
      ),
      s(
        "Report thoughtfully",
        "Use the relevant report action and provide context. Reports are reviewed through authorized moderation tools without a promised response time.",
      ),
    ],
    actions: [a("Privacy settings", "/settings/privacy"), a("Get help", "/help")],
  },
  "community-guidelines": {
    label: "Community guidelines",
    category: "GOOD SPACES TAKE CARE",
    title: "Make room for each other.",
    intro:
      "A few clear expectations for sharing a social space with respect, responsibility and care.",
    accent: "The VELORI community",
    sections: [
      s(
        "Respect the person",
        "Disagree with ideas without harassment, threats, hate or humiliation. Do not target someone with repeated unwanted contact.",
      ),
      s(
        "Share what you have a right to share",
        "Respect copyright and privacy. Do not post another person’s private contact details, sensitive information or conversations without permission.",
      ),
      s(
        "Be honest about who you are",
        "Do not impersonate another person, deceive people about an offer or manipulate account access.",
      ),
      s(
        "Keep the platform safe",
        "Do not distribute malicious files, evade account controls or exploit others. Use safety and reporting tools for concerns.",
      ),
      s(
        "Help improve the space",
        "A useful report includes context and the relevant content. Avoid reposting harmful or private material publicly to make a complaint.",
      ),
    ],
    actions: [a("Safety center", "/safety"), a("Contact", "/contact")],
  },
  cookies: {
    label: "Cookies & storage",
    category: "WHAT STAYS ON YOUR DEVICE",
    title: "Small settings. Clear choices.",
    intro: "Understand the local information that supports your VELORI experience.",
    accent: "Browser storage guide",
    sections: [
      s(
        "Sign-in and preferences",
        "Authentication session information and appearance or motion choices can be stored locally so the app can continue your session and remember your preferences.",
      ),
      s(
        "Drafts and pending work",
        "Recovery copies and queued chat preference changes may remain on your device until they synchronize. Wait for a save acknowledgment before clearing browser data.",
      ),
      s(
        "Announcements and recovery",
        "Announcement frequency or dismissal state and cached offline recovery information may be stored to support delivery and reconnect behavior.",
      ),
      s(
        "Your browser controls",
        "Signing out ends the app session. Browser site-data controls can clear local information, including unsynced work. Some storage is necessary for normal sign-in behavior.",
      ),
    ],
    actions: [a("Privacy guide", "/privacy"), a("Help", "/help")],
  },
  "data-policy": {
    label: "Your data",
    category: "INFORMATION, IN CONTEXT",
    title: "Know what supports your experience.",
    intro: "A product overview of account, content and device information used by VELORI.",
    accent: "Data-use guide",
    sections: [
      s(
        "Account and content",
        "The service stores profiles, follows, posts, stories, reels, notifications, conversations, attachments and interactions needed for those features.",
      ),
      s(
        "Access to content",
        "Audience settings, authenticated participation, storage policies and database access rules control which accounts can access protected content.",
      ),
      s(
        "Your device",
        "Session information, preferences, draft recovery and pending changes may be kept in browser storage. See the Cookies & storage guide before clearing them.",
      ),
      s(
        "Questions and requests",
        "Use the official contact channel for a data concern. This page does not provide a self-service export or account-deletion form. The operator’s reviewed notice must cover retention and applicable rights.",
      ),
    ],
    actions: [a("Contact about data", "@privacy"), a("Privacy settings", "/settings/privacy")],
  },
  "acceptable-use": {
    label: "Acceptable use",
    category: "USE VELORI WITH CARE",
    title: "Create freely. Act responsibly.",
    intro: "Practical expectations for using VELORI and respecting the people who use it.",
    accent: "Platform use guide",
    sections: [
      s(
        "Respect people",
        "Do not harass, threaten, exploit, defraud or impersonate people. Protect private information and respect another person’s boundaries.",
      ),
      s(
        "Respect access",
        "Do not enter accounts or data that are not yours, evade restrictions or disrupt the service.",
      ),
      s(
        "Respect content",
        "Only upload materials you have permission to share. Do not distribute malicious files or use the platform for unlawful activity.",
      ),
      s(
        "Raise a concern",
        "Use available reporting controls for a specific content item or message. Contact the team for a wider question.",
      ),
    ],
    actions: [a("Community guidelines", "/community-guidelines"), a("Safety", "/safety")],
  },
  legal: {
    label: "Legal information",
    category: "POLICIES & PRODUCT GUIDANCE",
    title: "The details behind the experience.",
    intro: "Find VELORI’s product policies, privacy guidance and official contact channel.",
    accent: "VELORI information",
    sections: [
      s(
        "Policy directory",
        "Read Terms, Privacy, Cookies & storage, Your data, Acceptable use and Community guidelines for the current product guidance.",
      ),
      s(
        "Operator information",
        "VELORI is presented as a VELORYZ product. Complete operator identity, commercial terms and jurisdiction-specific legal information require the platform operator’s reviewed notice.",
      ),
      s(
        "Content and branding",
        "Respect the rights in content you share and the branding of others. A directory link does not imply a partnership or grant an external service entitlement.",
      ),
      s(
        "Questions",
        "Use the Contact page to ask about a policy or raise a concern. These product guides are not represented as independent legal advice or a lawyer-reviewed contract.",
      ),
    ],
    actions: [a("Terms", "/terms"), a("Privacy", "/privacy"), a("Contact", "/contact")],
  },
  directory: {
    label: "Site directory",
    category: "FIND YOUR WAY AROUND",
    title: "Everything has its place.",
    intro:
      "The official VELORI and VELORYZ information directory. Choose a topic and continue from there.",
    accent: "VELORI documentation",
    sections: [
      s("The product", "Meet VELORI, read the journal and find practical help."),
      s("The studio", "Meet VELORYZ, explore careers and see the direction of upcoming work."),
      s("Your choices", "Read privacy, safety and data guidance, or contact the team."),
    ],
    actions: [a("About VELORI", "/about"), a("Help center", "/help"), a("Contact", "/contact")],
  },
};
Object.assign(informationPages, forgeGuides);
export const forgeFooterLinks = [
  ["Forge AI", "/forge"],
  ["Forge guide", "/forge-docs"],
  ["Forge pricing", "/forge-pricing"],
  ["Forge API", "/forge-api"],
  ["Forge security", "/forge-security"],
  ["Payments & billing", "/forge-payments"],
] as const;
export const informationFooterLinks = [
  ...forgeFooterLinks,
  ["VELORYZ", "/veloryz"],
  ["About", "/about"],
  ["Journal", "/blog"],
  ["Careers", "/jobs"],
  ["Help", "/help"],
  ["Developers & API", "/developers"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Places & discovery", "/locations"],
  ["Explore", "/popular"],
  ["VELORI Lite", "/lite"],
  ["VELORYZ AI", "/veloryz-ai"],
  ["Contacts & non-users", "/contact-uploading"],
  ["Verification", "/verified"],
  ["Roadmap", "/roadmap"],
  ["Contact", "/contact"],
] as const;
export const extraInformationSlugs = [
  "forge-payments",
  "forge-docs",
  "forge-pricing",
  "forge-api",
  "forge-security",
  "veloryz",
  "blog",
  "jobs",
  "developers",
  "locations",
  "popular",
  "lite",
  "veloryz-ai",
  "contact-uploading",
  "verified",
  "roadmap",
  "directory",
] as const;
