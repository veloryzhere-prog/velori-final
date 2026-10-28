# MASTER PROJECT PROMPT
# VELORI — Complete Documentation, CMS, Developer Platform & Website Ecosystem
**Project:** Existing VELORI Social Media Platform  
**Parent Brand:** VELORYZ  
**Technology:** React + Vite + TypeScript + Supabase  
**Implementation Target:** Existing project in Create Valory Work  
**Scope:** Complete development, content authoring, database integration, UI redesign, verification and production preparation.

---

# 0. YOUR ROLE AND MANDATORY EXECUTION RULES

You are the principal software architect, senior full-stack developer, senior interface designer, technical documentation writer, security engineer, accessibility engineer and QA lead for VELORI.

Your responsibility is to develop a complete professional website information ecosystem inside the **existing VELORI project**.

You must not simply generate example pages, mockups, screenshots, empty routes, temporary components or placeholder documentation.

You must implement the actual systems.

## Project discovery

Before changing code:

1. Read all available project instructions, especially `AGENTS.md`.
2. Inspect `package.json`, existing routes, application shell, components, styles, Supabase integration and authentication.
3. Identify the existing footer component and information pages.
4. Inspect existing CMS tables, admin permissions and policies.
5. Identify existing blog, creator, user, messaging, AI, verification and notification features.
6. Create an audit report classifying features as existing, partially implemented, missing or broken.
7. Preserve all existing working functionality.
8. Reuse the existing design system where appropriate, while improving the actual interface.
9. Never introduce an alternative authentication system when existing Supabase Auth can safely provide the required functionality.
10. Never modify an unrelated social feed, story, reel, post, profile or messaging feature without a documented integration reason.

Do not claim functionality exists until it has been implemented and tested.

## Strict authenticity requirements

- Do not invent published jobs, company locations, personnel, completed products, customer statistics, security certifications or official contact addresses.
- Do not make up VELORI AI development percentages.
- Never pretend that developer APIs are publicly available before deployment.
- Unimplemented features must be marked **In Development**, **Preview** or **Coming Soon**.
- Never present sample API keys as real credentials.
- Do not use references to Meta products as claims of affiliation.
- Legal templates must be reviewed before publication.
- Always keep the exact product name VELORI and parent brand VELORYZ.
- Use the real configured production domain from environment settings or deployment configuration; do not assume a domain belongs to the project merely because it was mentioned.

---

# 1. GLOBAL DESIGN SYSTEM

## Visual identity

Build a premium, editorial, modern social-media design system.

**Primary appearance:**
- Background: warm off-white `#FAF9F6`
- Surface: pure white `#FFFFFF`
- Primary typography: near-black `#171717`
- Secondary typography: `#666666`
- Primary accent: restrained warm gold `#E7B94C`
- Borders: subtle neutral `#E7E5E1`
- Error: accessible dark red
- Success: accessible dark green

Avoid excessive colorful glassmorphism, oversized shadows, generic gradients and unrelated decorative elements.

Use clean spacing, clear typography, excellent contrast, carefully designed icons and smooth interaction.

## Shared page shell

Every information page must have:

- Consistent VELORI header.
- Contextual breadcrumbs.
- Individual page hero.
- Substantial relevant original content.
- Appropriate animated illustrations.
- Sticky document navigation where relevant.
- Responsive content layout.
- Related articles or relevant links.
- Version or last-updated information where meaningful.
- Functional footer.
- Loading, empty and error states.
- Accessible keyboard navigation.

Do not use identical hero layouts on all pages.

## Animated document engine

Create reusable components:

- `DocumentShell`
- `DocumentCover`
- `DocumentReveal`
- `ReadingProgress`
- `DocumentSidebar`
- `TableOfContents`
- `DocumentationAccordion`
- `ArticleCard`
- `VersionHistory`
- `RelatedResources`
- `CalloutPanel`
- `CopyCodeButton`
- `AnimatedDiagram`
- `DocumentSearch`
- `FeedbackWidget`

### Document-opening animation

When a user clicks a document card:

1. The selected card expands or transitions into the document viewer.
2. A document cover unfolds or reveals the page.
3. The title and metadata appear with restrained motion.
4. The table of contents enters progressively.
5. The document content becomes readable immediately.
6. The browser URL changes to the actual destination.
7. Browser history, deep links and accessibility remain functional.

Use a shared-element-style transition when technically appropriate, with a graceful fallback.

Recommended animation timings:
- Hover: 120–180 ms.
- Panel reveal: 200–350 ms.
- Document transition: 350–550 ms.
- Page transition: 200–350 ms.
- Loop animations: 4–12 seconds, slow and non-distracting.

Respect `prefers-reduced-motion`.

Never delay navigation merely for animation.

---

# 2. COMPLETE INFORMATION ARCHITECTURE

Implement these original footer routes:

| Route | Public page |
|---|---|
| `/veloryz` | VELORYZ — Parent Brand |
| `/about` | About VELORI |
| `/blog` | VELORI Journal |
| `/jobs` | VELORI Careers |
| `/help` | VELORI Help Center |
| `/developers` | VELORI Developers |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |
| `/locations` | VELORI Locations |
| `/popular` | Popular on VELORI |
| `/lite` | VELORI Lite |
| `/meta-ai` | VELORI AI |
| `/muse` | VELORI Muse |
| `/threads` | VELORI Conversations |
| `/contact-uploading` | Contact Uploading & Non-Users |
| `/verified` | VELORI Verified |
| `/contact` | Contact VELORI |

Retain `/meta-ai` for backward compatibility but display only **VELORI AI**. Add an appropriate canonical URL such as `/ai` and redirect the old URL when route compatibility permits.

Retain `/threads` but use independent VELORI branding.

Create additional route families:

**Legal:** `/legal`, `/legal/cookies`, `/legal/community-guidelines`, `/legal/acceptable-use`, `/legal/data-policy`, `/legal/child-safety`, `/legal/copyright`, `/legal/accessibility`, `/legal/account-deletion`, `/legal/grievances`.

**Support:** `/help/articles/:slug`, `/help/category/:slug`, `/help/tickets`, `/help/contact`.

**Careers:** `/jobs/:slug`, `/jobs/applications`, `/jobs/employers`, `/jobs/employer/dashboard`.

**Developers:** `/developers/docs`, `/developers/api`, `/developers/authentication`, `/developers/security`, `/developers/apply`, `/developers/console`, `/developers/keys`, `/developers/webhooks`, `/developers/changelog`, `/developers/status`.

**Other:** `/blog/:slug`, `/blog/category/:slug`, `/verified/apply`, `/verified/status`, `/settings/language`, `/settings/data`, `/ai/roadmap`, `/ai/waitlist`.

Implement route guards based on actual permissions. Add missing pages to the footer only where appropriate; administrative and private dashboards must not appear as public links.

---

# 3. INDIVIDUAL PAGE DOCUMENTATION AND CONTENT

The following copy is the minimum authored content. Expand every section into polished, useful, properly structured CMS documents. Do not replace these sections with filler text.

## 3.1 VELORYZ — `/veloryz`

**Page title:** VELORYZ — The Studio Behind VELORI  
**Hero:** We Build What Comes Next.  
**Subtitle:** Creative technology, thoughtful engineering and ambitious digital products.

### Opening document

"VELORYZ is the creative and technology brand behind VELORI. Our focus is building useful digital experiences that combine expressive design, reliable engineering and straightforward interactions.

We believe technology should be understandable, creative tools should feel accessible and ambitious digital ideas should be developed with attention to people who use them.

VELORI represents that direction: a social platform designed around connection, creativity and personal expression."

### Document sections

**Our philosophy:** Explain practical creativity, responsible product development, performance, accessibility and transparency.

**What we build:** Showcase confirmed VELORYZ products and services from existing verified project content, including websites, interfaces, software experiences and digital products where applicable.

**Our approach:** Discovery, research, design, prototyping, development, testing, deployment and continuous improvement.

**VELORI as a product:** Explain how VELORI fits into the broader VELORYZ ecosystem.

**Collaborate with us:** A working contact form routing to authorized team members.

**Transparency:** No invented client testimonials, awards or project statistics.

### Interface

Use an editorial black-and-white split-screen hero, animated product diagrams, subtle moving grid lines, illustrated project cards, connected nodes and a premium footer.

A company timeline must contain only actual approved milestones.

---

## 3.2 About VELORI — `/about`

**Hero:** A Place for Your World.  
**Tagline:** Your World. Your People. Your VELORI.

### Main content

"VELORI is a social platform created to help people share moments, discover ideas, express themselves and build meaningful connections.

From photos and short videos to stories, conversations and communities, VELORI brings different forms of expression together in one experience.

Our goal is to make sharing intuitive, discovery relevant, communication respectful and creative expression accessible."

### Sections

**Share your moments:** Describe posts, captions, supported media and audience settings according to implemented functionality.

**Create your stories:** Explain temporary visual stories, editing tools, mentions and available interactions.

**Discover short videos:** Explain VELORI Reels, vertical playback, recommendations and user controls.

**Connect with people:** Explain profiles, followers, direct conversations, groups and privacy settings.

**Build your identity:** Explain profile customization and account ownership.

**Your experience, your controls:** Explain visibility, reporting, blocking, notifications and personal data controls.

**Our principles:** Safety, creativity, transparency, accessibility, respect and continuous improvement.

**Future of VELORI:** Link to an authentic development roadmap.

### Interface

Animated vertical product showcase, illustration of connected profile cards, scrolling feature storytelling, transitions between real feature previews and animated feature diagrams.

Use accurate screenshots or UI previews generated from actual application components.

---

## 3.3 VELORI Journal — `/blog`

**Hero:** Ideas, Updates & Stories From VELORI.

### Introductory content

"The VELORI Journal brings together product announcements, development updates, creator guides, design stories and insights into how the platform is evolving.

Explore what is changing, understand how features work and learn more about the decisions behind the VELORI experience."

### Blog categories

- Product Announcements
- Development Updates
- Creator Guides
- Platform Safety
- Engineering
- Design Stories
- Community
- Tutorials
- Behind the Scenes

### Required functionality

Build a real database-driven publishing system.

Each article must support title, summary, slug, author, publication date, modified date, hero image, body blocks, category, tags, SEO description, status, scheduled publication and related articles.

Add full-text search, category filters, pagination, reading progress, article sharing, article feedback and SEO metadata.

Create article draft, preview, publish, unpublish, archive and revision workflows for authorized CMS editors.

Do not invent published historical announcements. Seed only verified articles or clearly labeled example content in development environments.

### UI

Magazine-style typography, staggered editorial article cards, subtle image reveals, animated category navigation and a clean full-width reading experience.

---

## 3.4 VELORI Careers — `/jobs`

**Hero:** Find Your Next Opportunity.  
**Subtitle:** Explore opportunities, build your career and connect with organizations looking for talent.

### Introductory document

"VELORI Careers is designed to make exploring opportunities more straightforward. Discover relevant openings, review requirements and understand application steps before deciding where to apply.

Job information should be clear, accurate and useful. Listings must identify the organization, responsibilities, qualifications, working arrangement and application method.

Applicants should remain in control of their applications and personal information."

### Important distinction

Create two career areas:

**Careers at VELORI:** Genuine recruitment opportunities directly associated with the VELORI or VELORYZ team.

**Explore Jobs:** Third-party opportunities submitted by reviewed employers, if that marketplace functionality is implemented.

Never fabricate thousands of opportunities to create the appearance of a large marketplace.

### Job search

Implement search by title, skill, company, location and keyword.

Filters:
- Remote, hybrid, onsite.
- Full-time, part-time, contract, internship.
- Experience level.
- Industry.
- Posted date.
- Salary range where disclosed.
- Verified employer.
- Applications open.

Use cursor-based pagination and infinite scrolling with an accessible Load More alternative.

### Job details content structure

Every listing contains:
- Exact job title.
- Employer identity.
- Location and work mode.
- Salary when supplied.
- Job type.
- Responsibilities.
- Required qualifications.
- Optional qualifications.
- Working arrangements.
- Application process.
- Closing date when available.
- Employer contact or approved application channel.
- Listing verification status.
- Reporting option.

### Applicant system

Create applicant profiles, saved jobs, application history, email preferences, application status and withdrawal where supported.

Application states:
Draft, Submitted, Under Review, Shortlisted, Interview, Offered, Rejected, Withdrawn, Closed.

Allow uploaded documents with access controls, file validation, scanning where available and reasonable retention periods.

Email messages must use a real configured mail provider and be triggered through server-side workflows.

### Employer system

Create verified employer onboarding, organization profiles, job creation, moderation, candidate review and status updates.

Prevent misleading listings, impersonation, application-fee scams and unauthorized disclosure of applicant information.

### UI

Premium recruitment dashboard, animated search hero, professional listing cards, advanced filters, job details drawer, application stepper and recruiter workspace.

---

## 3.5 VELORI Help Center — `/help`

**Hero:** How Can We Help?  
**Subtitle:** Answers, guides and support for your VELORI experience.

### Welcome copy

"Find clear explanations of VELORI features, manage your account, troubleshoot common problems and learn how to stay safe.

Browse help topics or search for a specific question. If an article does not resolve your issue, use the available support options to contact the team."

### Help categories and actual article content

**Account & Login**

"Your account gives you access to your profile, content and interactions. Keep your sign-in information private, maintain access to your registered email address and review security settings regularly."

Articles:
- Creating an account.
- Confirming your email address.
- Signing in.
- Resetting a password.
- Updating an email address.
- Recovering account access.
- Securing an account.

**Posts, Reels & Stories**

"VELORI supports creative sharing through different publishing formats. Use the appropriate creation studio, review your content before publishing and select available audience settings."

Articles:
- Publishing a post.
- Creating a reel.
- Creating a story.
- Editing a caption.
- Mentioning a user.
- Managing published content.
- Troubleshooting media uploads.

**Privacy & Safety**

"You can use available account controls to manage who sees your content and who can interact with you. If you encounter concerning content or behavior, use the reporting tools available on the platform."

Articles:
- Private profiles.
- Blocking accounts.
- Reporting content.
- Reporting impersonation.
- Managing followers.
- Understanding mentions.
- Account security.

**Messaging & Notifications**

"Notifications help you find important activity. Messaging tools allow communication according to account settings and platform policies."

Articles:
- Sending messages.
- Managing conversations.
- Group messaging.
- Notification preferences.
- Message requests.
- Read receipts, if implemented.

**Technical Support**

Articles:
- Website not loading.
- Upload failed.
- Media playback issues.
- Unsupported browsers.
- Network troubleshooting.
- Submitting a bug report.

### Support ticket system

Support tickets require category, subject, description, priority, authenticated account or verified contact method, supporting attachment and ticket status.

Statuses: Open, Awaiting User, In Progress, Resolved, Closed.

Show confirmation receipts, updates, ticket history and escalation pathways.

Do not promise support availability or turnaround times that the organization cannot meet.

### UI

Large intelligent search, friendly animated illustrations, organized help categories, searchable documentation cards and a functional support ticket experience.

---

## 3.6 VELORI Developers — `/developers`

**Hero:** Build With VELORI.  
**Subtitle:** Explore the platform, understand integrations and build secure connected experiences.

### Opening copy

"The VELORI Developer Platform is intended to provide structured interfaces for approved integrations with VELORI services.

Developers should be able to understand authentication requirements, API resources, permission boundaries, request formats, errors, versioning and integration responsibilities before building applications.

An integration must respect user permissions, platform security, privacy requirements and published developer policies."

### Developer documentation chapters

1. Introduction to VELORI APIs.
2. Getting Started.
3. Developer Registration.
4. Creating an Application.
5. Authentication.
6. Authorization and Scopes.
7. API Keys and Credentials.
8. Users and Profiles API.
9. Posts API.
10. Reels API.
11. Stories API.
12. Comments and Interactions API.
13. Search API.
14. Notifications API.
15. Media Uploads API.
16. Webhooks.
17. Pagination.
18. Rate Limits.
19. Errors and Troubleshooting.
20. API Versions.
21. Testing and Sandbox.
22. Security Requirements.
23. Application Review.
24. Data Access and Privacy.
25. Changelog.
26. Migration Guides.
27. Support and Reporting Vulnerabilities.

The API must be documented based on actual implemented routes. Any additional endpoints specified later in this prompt are a **proposed target API**, not evidence that those endpoints already exist.

### UI

Developer-specific design with a left documentation sidebar, central article, right table of contents and interactive code panel.

Use monospaced examples, copy buttons, language tabs, collapsible response examples, API status labels and interactive endpoint exploration.

---

## 3.7 Privacy Policy — `/privacy`

**Document status:** Legal draft requiring professional review.

**Heading:** VELORI Privacy Policy

### Introduction

"VELORI is designed to help people create, discover and communicate. Operating these services may require processing information associated with accounts, content and platform interactions.

This policy explains the categories of information processed, the purposes of processing, the choices available to people and how privacy-related requests can be submitted.

The organization responsible for processing must be identified in the final published policy."

### Categories of information

**Account information:** Registered email address, username, display name, account identifiers, authentication metadata and profile preferences.

**User-provided content:** Posts, captions, stories, reels, messages, comments, uploaded media and other information submitted through the service.

**Activity information:** Content interactions, follows, saves, reporting events and relevant service activity.

**Technical information:** IP address, device and browser characteristics, application versions, security logs and error reports where collected.

**Contact information:** Information submitted through contact forms, career applications, support channels and optional address-book features.

### Why information is processed

Explain clearly:
- Providing requested platform services.
- Authenticating and securing accounts.
- Enabling communication.
- Displaying requested content.
- Enforcing community and security policies.
- Responding to support and legal requests.
- Measuring performance and fixing errors.
- Providing recommendations, only where implemented.
- Sending optional communications according to user choices.

### Additional mandatory clauses

Write complete sections covering:
- Applicable lawful grounds and consent where required.
- Data sharing with legitimate processors.
- Public versus private content.
- Retention and deletion criteria.
- International data handling.
- Security safeguards.
- User rights and request procedures.
- Children's privacy and applicable consent requirements.
- Cookie and analytics choices.
- Changes to the policy.
- Contact and grievance handling.

Do not assert encryption of all data, end-to-end encryption of messages or specific retention durations unless these are actually implemented and verified.

Every privacy statement must correspond to actual product behavior.

---

## 3.8 Terms of Service — `/terms`

**Document status:** Legal draft requiring professional review.

**Heading:** VELORI Terms of Service

### Introduction

"These Terms explain the conditions for accessing and using VELORI. By accessing the service, users agree to the applicable published terms, subject to governing law.

The Terms address account responsibilities, permitted use, user content, platform features, safety rules, intellectual property and available remedies."

### Sections

**Eligibility:** State actual age and consent requirements after legal review, including jurisdiction-specific requirements. Do not falsely claim universal eligibility.

**Accounts:** Users must provide appropriate account information, maintain credential confidentiality and avoid impersonation.

**User content:** Creators retain applicable rights in their original content. Define the limited license necessary for storing, displaying, processing and distributing content through chosen platform features.

**Permissions:** No unauthorized copying, scraping, harassment, spam, unlawful activity or attempts to compromise platform security.

**Moderation:** Explain reporting, review, possible restrictions, removals and appeal mechanisms.

**Intellectual property:** Protect platform branding while respecting third-party copyrights.

**Availability:** Explain that products evolve and temporary interruptions may occur.

**Account suspension and termination:** State permissible reasons, notification practices, review and appeal procedures where applicable.

**Limitation of liability:** Provide a legally reviewed, jurisdiction-appropriate clause, without attempting to exclude non-excludable rights.

**Disputes:** Insert the verified contracting entity, governing law and appropriate dispute-resolution framework only after review.

**Changes:** Describe how material updates will be communicated.

Avoid publishing legally binding assumptions without authorized review.

---

## 3.9 VELORI Locations — `/locations`

**Hero:** VELORI Across Communities.

### Introductory copy

"VELORI is a digital platform designed for people to connect across places and communities. This page helps users understand regional availability, supported languages and verified contact locations."

### Content

Show:
- Supported regions based on actual service availability.
- Localized language availability.
- Service accessibility and availability notices.
- Official office locations only when verified.
- Contact options.
- Regional policy links when needed.

Never invent company offices.

### UI

An animated globe or regional illustration, region selectors, language controls and regional information cards.

Any physical map must reflect actual verified addresses or coverage data.

---

## 3.10 Popular on VELORI — `/popular`

**Hero:** Discover What's Happening.

### Main copy

"Explore content, conversations and creators gaining attention across the VELORI community.

Discovery should help users find relevant ideas while respecting privacy, content visibility and platform safety rules."

### Features

Trending content, creator discovery, hashtags, categories, topic search and relevant recommendation explanations.

Only use actual engagement data.

Exclude private content from public discovery without proper access.

Do not display artificial metrics or fabricated trending creators.

### UI

Animated discovery grid, trending topics, relevant category filters and smooth content previews.

---

## 3.11 VELORI Lite — `/lite`

**Hero:** The VELORI Experience, Made Lighter.

### Main copy

"VELORI Lite is intended to provide a more efficient experience for devices and network conditions where performance and data use matter.

The goal is to prioritize essential features, reduce unnecessary downloads and make core interactions responsive."

### Document sections

**Purpose:** Explain a simpler, faster-loading experience.

**Potential capabilities:** Reduced animations, optimized images, lightweight navigation, limited autoplay, economical media loading and simplified interaction surfaces.

**Device support:** Document actual supported browsers and devices.

**Accessibility:** Explain keyboard, text scaling and reduced-motion support.

**Availability:** Clearly identify whether Lite is shipped, experimental or planned.

### UI

A lightweight interface with minimal scripting and reduced visual effects.

No fake performance benchmarks.

---

## 3.12 VELORI AI — `/meta-ai` and `/ai`

**Hero:** Intelligence for Your Creative World.  
**Status:** In Development, unless verified otherwise.

### Main copy

"VELORI AI is an emerging part of the VELORI ecosystem focused on exploring helpful, responsible artificial-intelligence experiences.

The vision is to assist users with creative ideas, contextual guidance, content planning and other appropriate tools that make digital expression easier.

Capabilities are being developed and evaluated. Any features shown on this page must accurately reflect their current availability."

### AI development roadmap

Create stages:

1. Research and Requirements.
2. Experience Design.
3. Core Architecture.
4. Prototype Development.
5. Controlled Testing.
6. Safety and Quality Review.
7. Limited Release.
8. General Availability.

The visual progress system must read real administrator-maintained milestone states.

Do not display an arbitrary 87%, 99% or countdown that has no factual basis.

### Potential AI features

Clearly mark each as Planned, Building, Testing or Available:
- Creative writing assistance.
- Caption suggestions.
- Content discovery assistance.
- Help center question answering.
- Language assistance.
- Creator workflow guidance.
- Accessibility assistance.
- Content organization.

Do not automatically train models on private messages or private user content. Any AI data use requires its own reviewed privacy and consent framework.

### AI waitlist

Allow optional, verified email registration, unsubscribe and preference management.

### UI

Animated abstract intelligence nodes, flowing signal lines, a staged roadmap, milestone details, feature preview cards and clear status indicators.

Provide transparent capability disclaimers.

---

## 3.13 VELORI Muse — `/muse`

**Hero:** Create Beyond the Ordinary.

### Main copy

"VELORI Muse is the creative-tools concept within the VELORI ecosystem, exploring ways to make visual storytelling, editing and creative expression more accessible.

Muse may bring together creation tools, templates, visual assets and intelligent assistance as these capabilities become available."

### Sections

- Post Studio.
- Story Studio.
- Reel Studio.
- Templates.
- Text and typography.
- Stickers and visual elements.
- Music and audio, subject to licensing.
- Creator inspiration.
- Future creative assistance.

Connect to existing creator studios rather than building duplicate editors.

Show only genuinely implemented capabilities as available.

### UI

Animated creative canvas, movable preview layers, tool demonstration cards and polished transitions into existing studios.

---

## 3.14 VELORI Conversations — `/threads`

**Hero:** Conversations Worth Having.

### Main copy

"VELORI Conversations explores ways for people to share thoughts, participate in discussions and connect through text-led interactions.

Whether discussing a creative idea, responding to a community topic or participating in a conversation, the experience should remain clear, respectful and easy to follow."

### Features

Short text discussions, responses, mentions, user discovery, topic following and conversation notifications, subject to implementation.

Avoid copying third-party branding or proprietary interfaces.

Maintain moderation, privacy and anti-spam controls.

### UI

Minimal, typography-focused conversation cards, expanding reply trees, context drawers and subtle connection animations.

---

## 3.15 Contact Uploading & Non-Users — `/contact-uploading`

**Hero:** Your Contacts. Your Choice.

### Main copy

"VELORI may offer optional features that help users connect with people they know. Any contact-based discovery feature must explain what information is requested, why it is needed and what choices are available.

People who do not have VELORI accounts should also be able to understand how their information may be handled and how they can raise privacy concerns."

### Required documentation

**What contact uploading means:** Explain contact permissions and any actual matching workflow.

**Optional participation:** Access to contacts should not be mandatory for ordinary platform use unless an essential and justified feature specifically requires it.

**Non-user data:** Explain how information about people without accounts could be received and handled, if applicable.

**Retention:** Define actual retention and deletion procedures.

**Controls:** Include disable synchronization, deletion request and privacy inquiry procedures where applicable.

**No hidden uploading:** Contact access must not begin without the appropriate authorization and lawful basis.

Do not build contact uploading unless legitimate privacy and security requirements are satisfied.

### UI

Privacy-focused illustrated document, permission-state diagrams, interactive explanations and clear privacy-control links.

---

## 3.16 VELORI Verified — `/verified`

**Hero:** Authenticity Matters.

### Main copy

"VELORI Verified is intended to help users understand account authenticity and platform verification.

Verification must have clear eligibility criteria, a documented review process and understandable decisions. A verification indicator should communicate only what the platform has actually verified."

### Verification categories

- Individual identity or authenticity.
- Organization authenticity.
- Creator authenticity.
- Special account categories, if supported.

Do not confuse identity confirmation with endorsement, importance or guaranteed trustworthiness.

### Application steps

1. Choose account category.
2. Review requirements.
3. Submit the permitted verification information.
4. Confirm submission.
5. Track status.
6. Receive a decision.
7. Request review or appeal where supported.

### Verification states

Not Applied, Draft, Submitted, Under Review, More Information Required, Approved, Rejected, Revoked.

Sensitive identity documentation must not become publicly accessible.

Verification must not be automatically awarded merely because a user submits information.

### UI

Premium verification illustration, step-by-step eligibility guide, secure application interface and transparent status timeline.

---

## 3.17 Contact VELORI — `/contact`

**Hero:** Get in Touch.

### Main copy

"Questions, feedback and ideas help us understand what matters to the people using VELORI.

Choose the appropriate contact category and provide enough information for the team to understand your request. Please avoid sending passwords, access tokens or unnecessary sensitive information."

### Contact categories

General Inquiry, Technical Support, Business Inquiry, Media, Careers, Developer Support, Privacy, Copyright, Safety, Security Vulnerability and Legal Request.

Each form submission must:
- Validate fields.
- Provide a reference ID.
- Store the message securely.
- Route it to an authorized category.
- Prevent spam and excessive requests.
- Display truthful delivery status.
- Notify staff through a configured provider.
- Respect retention and privacy requirements.

Do not invent an email address, phone number or physical office.

### UI

Interactive contact category cards, clean animated forms, submission confirmations and category-specific guidance.

---

# 4. ADDITIONAL LEGAL DOCUMENTATION

Build `/legal` as a complete Legal & Trust Center.

The legal landing page must say:

"VELORI's Legal & Trust Center brings together the policies, explanations and procedures that define how the platform is operated, how accounts and content are governed and how people can exercise applicable rights."

Create the following independently editable policies.

## Cookies Policy

Explain essential cookies, session and security cookies, analytics cookies if used, optional functionality cookies and any advertising cookies if implemented.

Identify actual cookie names and providers where possible.

Provide meaningful consent preferences where legally required.

Include controls for changing choices and explain how browser settings interact with service functionality.

Do not claim optional cookies are disabled unless the implementation enforces it.

## Community Guidelines

**Opening statement:**

"VELORI is intended to be a space where people can create, communicate and participate with respect for others.

Our Community Guidelines explain expectations for content and conduct. They apply to public interactions and, where appropriate and legally permissible, other uses of the service."

Write separate rules for:
- Harassment and bullying.
- Threats and violent content.
- Hate and discrimination.
- Sexual exploitation and child safety.
- Privacy violations.
- Impersonation.
- Scams and deceptive behavior.
- Spam and manipulation.
- Intellectual property.
- Harmful misinformation where covered by policy.
- Unauthorized automation.
- Reporting and enforcement.

Describe proportional enforcement, contextual review and appeals.

## Acceptable Use Policy

Prohibit unauthorized access, attacks, credential theft, malicious automation, abusive scraping, spamming, manipulation of engagement systems and misuse of platform APIs.

Define approved automated access through the developer program.

## Data Policy

Document the actual data lifecycle:
Collection, Storage, Access, Processing, Sharing, Retention, Export, Deletion and Audit.

Include public/private data boundaries and data subject request procedures.

## Child Safety Policy

Explain age eligibility, safeguards for young users, reporting, age-appropriate experiences, privacy controls, exploitation prevention and moderation.

Do not publish assumptions that conflict with applicable Indian law.

## Copyright & Intellectual Property Policy

Define ownership principles, infringement reporting, necessary evidence, review, responses, repeat misuse handling and contesting inaccurate reports.

## Accessibility Statement

Explain VELORI's accessibility goals, supported interaction methods, current limitations and methods for reporting an accessibility problem.

Do not claim full WCAG compliance until independently evaluated.

## Account Deletion & Data Rights

Explain how users may request account deletion, export data where supported, review applicable rights and track relevant requests.

Disclose necessary limitations relating to legal retention, security and backup deletion.

## Grievance Redressal

Provide the verified responsible organization, required officer/contact information, complaint submission procedures, applicable statutory timelines and escalation rights after legal review.

Review the Digital Personal Data Protection Act, applicable DPDP Rules, IT Rules and relevant amendments.

Do not invent compliance statuses or assume every statutory obligation applies identically to every entity.

---

# 5. COMPLETE DEVELOPER APPLICATION SYSTEM

Build `/developers/apply`.

## Application requirements

Fields:
- Developer or organization name.
- Verified email.
- Organization website, if applicable.
- Application name.
- Application description.
- Intended integration purpose.
- Requested permission scopes.
- Redirect URIs.
- Privacy policy URL where required.
- Data handling explanation.
- Expected API traffic.
- Security contact.
- Agreement to current developer terms.

## Approval workflow

Draft → Submitted → Under Review → Changes Requested → Approved / Rejected → Suspended / Revoked.

Applicants must be able to view decisions and requests for additional information.

Administrators must record decisions, dates, reviewers and the reason for material permission changes.

Approval cannot be represented as automatic when review is required.

## Developer console

Build:
- Application overview.
- Credentials.
- Redirect URI management.
- Scope management.
- Webhook subscriptions.
- Request usage.
- Rate-limit information.
- Error diagnostics.
- Audit activity.
- Security notices.
- Developer support.

Never expose secrets in client-side code.

---

# 6. COMPLETE PROPOSED VELORI REST API

## API specification requirements

Create a real OpenAPI 3.1.1 specification using the implemented backend as the source of truth.

Use:

`/v1` as the proposed version prefix.

The actual API hostname must come from deployed configuration rather than an invented public endpoint.

All documented operations must include:
- Summary.
- Description.
- Security requirements.
- Permissions.
- Parameters.
- JSON request schema.
- JSON response schema.
- Validation.
- Possible error responses.
- Pagination where needed.
- Rate-limit details when configured.
- Working examples.
- Relevant privacy implications.

Do not create an unrestricted public interface directly to Supabase tables.

## 6.1 Authentication and identity

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/me` | Retrieve authorized account |
| PATCH | `/v1/me` | Update permitted profile fields |
| GET | `/v1/users/{username}` | Retrieve visible public profile |
| GET | `/v1/users/{id}/followers` | Retrieve permitted followers |
| GET | `/v1/users/{id}/following` | Retrieve permitted following |
| POST | `/v1/users/{id}/follow` | Follow account |
| DELETE | `/v1/users/{id}/follow` | Unfollow account |

Authentication must use a standards-based flow appropriate to the client.

Use Authorization Code with PKCE for delegated public-client OAuth integrations if a secure OAuth authorization server is implemented.

Existing first-party Supabase authentication must not be mistaken for a complete third-party OAuth authorization service.

Require bearer tokens for applicable requests.

Never issue platform-level unrestricted credentials to third-party clients.

## 6.2 Posts API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/posts` | List accessible posts |
| POST | `/v1/posts` | Create a post |
| GET | `/v1/posts/{id}` | Retrieve a permitted post |
| PATCH | `/v1/posts/{id}` | Update an owned post |
| DELETE | `/v1/posts/{id}` | Delete an owned post |
| POST | `/v1/posts/{id}/like` | Like a post |
| DELETE | `/v1/posts/{id}/like` | Remove like |
| POST | `/v1/posts/{id}/save` | Save a post |
| DELETE | `/v1/posts/{id}/save` | Remove saved post |

Document post visibility, media associations, captions, mentions, creation time, edit time, ownership, moderation and access restrictions.

### Example post creation request

POST `/v1/posts`

Authorization: Bearer ACCESS_TOKEN  
Content-Type: application/json

Request:

    {
      "caption": "A new creative moment.",
      "media_ids": ["media_example_01"],
      "visibility": "public",
      "mentions": ["samplecreator"]
    }

Successful response example:

    {
      "data": {
        "id": "post_example_01",
        "caption": "A new creative moment.",
        "visibility": "public",
        "status": "published",
        "created_at": "2026-10-24T10:00:00Z"
      },
      "request_id": "req_example_01"
    }

These identifiers and timestamps are illustrative.

Actual responses must match the implemented database and API schemas.

Require `posts:write` permission and confirm authenticated ownership.

Prevent clients from assigning arbitrary owners or bypassing post visibility rules.

## 6.3 Comments API

- GET `/v1/posts/{id}/comments`
- POST `/v1/posts/{id}/comments`
- PATCH `/v1/comments/{id}`
- DELETE `/v1/comments/{id}`
- POST `/v1/comments/{id}/like`
- DELETE `/v1/comments/{id}/like`

Document reply threading, maximum length, moderation, visibility, rate limits and ownership.

## 6.4 Reels API

- GET `/v1/reels`
- POST `/v1/reels`
- GET `/v1/reels/{id}`
- PATCH `/v1/reels/{id}`
- DELETE `/v1/reels/{id}`
- GET `/v1/reels/{id}/comments`
- POST `/v1/reels/{id}/comments`

Document upload requirements, media processing, captions, music licensing, aspect ratio, visibility, published status and playback authorization.

Do not guarantee full streaming/transcoding capability without supporting infrastructure.

## 6.5 Stories API

- GET `/v1/stories`
- POST `/v1/stories`
- GET `/v1/stories/{id}`
- DELETE `/v1/stories/{id}`
- POST `/v1/stories/{id}/reactions`

Document visibility, actual expiration policy, owner access, mentions, media assets and expiration handling.

Never expose private story viewers or viewer lists through an unauthorized API.

## 6.6 Media API

- POST `/v1/media/uploads`
- GET `/v1/media/{id}`
- DELETE `/v1/media/{id}`

For uploads, use backend-authorized, short-lived upload URLs or authenticated streaming according to the existing architecture.

Document media type, maximum size, processing state, ownership, retention and permitted access.

Reject unsupported media and unsafe uploads.

## 6.7 Search and discovery

- GET `/v1/search/users`
- GET `/v1/search/posts`
- GET `/v1/search/tags`
- GET `/v1/discover/trending`

Support query, pagination and permitted filters.

Enforce privacy boundaries.

No third-party application should retrieve hidden profile information merely through search.

## 6.8 Notifications

- GET `/v1/notifications`
- PATCH `/v1/notifications/{id}/read`
- GET `/v1/me/notification-preferences`
- PATCH `/v1/me/notification-preferences`

Document notification categories, ordering, unread state, delivery semantics and access restrictions.

## 6.9 Mentions

- GET `/v1/mentions`
- GET `/v1/mentions/suggestions`
- POST `/v1/mentions/{id}/acknowledge`

Mention autocomplete must respect privacy and blocking rules.

Notifications and mention relationships must be generated through trusted backend processes.

## 6.10 Jobs API

- GET `/v1/jobs`
- GET `/v1/jobs/{id}`
- POST `/v1/jobs/{id}/applications`
- GET `/v1/me/job-applications`
- GET `/v1/me/saved-jobs`
- POST `/v1/me/saved-jobs`
- DELETE `/v1/me/saved-jobs/{id}`

Employer-only operations require dedicated authorization.

No public endpoint should expose applicant resumes or personal information without valid authorization.

## 6.11 Support API

- GET `/v1/help/articles`
- GET `/v1/help/articles/{slug}`
- POST `/v1/support/tickets`
- GET `/v1/support/tickets/{id}`
- POST `/v1/support/tickets/{id}/messages`

An unauthenticated ticket lookup must use a suitably secure verified-access mechanism.

## 6.12 Developer API

- GET `/v1/developer/apps`
- POST `/v1/developer/apps`
- GET `/v1/developer/apps/{id}`
- PATCH `/v1/developer/apps/{id}`
- GET `/v1/developer/apps/{id}/usage`
- POST `/v1/developer/apps/{id}/credentials/rotate`
- GET `/v1/developer/apps/{id}/webhooks`

These are management operations accessible only to appropriately authenticated developers.

Ensure developers cannot manage another developer's applications.

## 6.13 Verification API

- GET `/v1/me/verification`
- POST `/v1/me/verification/applications`
- GET `/v1/me/verification/applications/{id}`

Identity documentation must use private storage and limited internal access.

## 6.14 Localization API

- GET `/v1/locales`
- GET `/v1/locales/{locale}/messages`
- PATCH `/v1/me/preferences/locale`

Provide versioned translations with efficient caching.

## 6.15 Content reporting

- POST `/v1/reports`
- GET `/v1/me/reports/{id}`

Limit disclosure about investigations, reporters and other users as appropriate.

Add secure moderation tools for authorized staff separately.

## 6.16 Required common conventions

**Pagination:**

    {
      "data": [],
      "pagination": {
        "next_cursor": null,
        "has_more": false
      },
      "request_id": "req_example"
    }

**Standard error:**

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "The submitted request is invalid.",
        "details": [
          {
            "field": "caption",
            "reason": "Maximum length exceeded."
          }
        ]
      },
      "request_id": "req_example"
    }

Document at least:
`400`, `401`, `403`, `404`, `409`, `413`, `415`, `422`, `429` and `500` where applicable.

Do not expose internal database errors, secrets or stack traces to public clients.

---

# 7. DEVELOPER SECURITY DOCUMENTATION

Create an independent `/developers/security` documentation system.

## Security chapters

**Authentication Security:** OAuth integration design where applicable, token expiry, refresh handling, secure sessions and revocation.

**Authorization:** Server-side permission checks, resource ownership, role boundaries and least privilege.

**API Key Security:** Generate secrets securely, display them only when appropriate, store hashed verification material where supported, implement rotation and revocation, and never include privileged secrets in frontend bundles.

**Supabase Security:** Keep service-role keys server-side, use RLS, review policies and limit public table exposure.

**Request Validation:** Validate all parameters, payloads, resource identifiers and uploaded content.

**Rate Limiting:** Apply actual limits based on endpoint risk, authenticated identity and infrastructure capacity. Document real values rather than arbitrary promises.

**Webhooks:** Require authenticated registration, event allowlists, HTTPS delivery and HMAC signatures with timestamp and replay protection. Include retry, deduplication, rotation and failure-handling documentation.

**Incident Response:** Define detection, assessment, containment, remediation, recovery and authorized disclosure procedures.

**Audit Logs:** Record privileged changes, developer approvals, credential rotation and relevant account-security events without exposing sensitive secrets.

**Security Reporting:** Provide a verified vulnerability reporting channel and responsible disclosure instructions.

Create dedicated documentation for threat models, privacy controls, data retention and access reviews.

---

# 8. API PERMISSION SCOPES

Design a scope system:

- `profile:read`
- `profile:write`
- `posts:read`
- `posts:write`
- `comments:read`
- `comments:write`
- `reels:read`
- `reels:write`
- `stories:read`
- `stories:write`
- `notifications:read`
- `media:write`
- `jobs:read`
- `applications:write`

Not all scopes should automatically be made available to third-party integrations.

Sensitive permissions need additional approval.

Separate first-party internal permissions from third-party delegated scopes.

Any messages-related developer scope must receive a dedicated security and privacy assessment before implementation.

Use default-deny rules, short-lived authorization and revocation support.

---

# 9. WEBHOOK DOCUMENTATION

Create `/developers/webhooks`.

Potential events:

- `post.created`
- `post.updated`
- `post.deleted`
- `reel.published`
- `story.published`
- `comment.created`
- `mention.created`
- `job.application.created`
- `verification.status_changed`

Only expose events the approved integration is entitled to receive.

An example envelope:

    {
      "id": "evt_example_01",
      "type": "post.created",
      "created_at": "2026-10-24T10:00:00Z",
      "api_version": "v1",
      "data": {
        "object_id": "post_example_01"
      }
    }

Document payload versioning, signatures, delivery attempts, retries, ordering limitations, failures and duplicate delivery.

Do not fire webhooks from insecure browser code.

---

# 10. MULTILINGUAL PLATFORM

Build a proper internationalization architecture.

## Languages

Initial proposed supported locales:
- English — `en`
- Hindi — `hi`

Additional locales must be supported by the architecture and may be published when high-quality translations and review are available.

Potential expansion:
- Bengali — `bn`
- Tamil — `ta`
- Telugu — `te`
- Marathi — `mr`
- Spanish — `es`
- French — `fr`

Do not label incomplete or machine-generated drafts as fully supported translations.

## Language selector

Support:
- Language name.
- Native-language label.
- Search.
- Current selection.
- Preview of available translated UI.
- Immediate language updates.
- Saved account preference.
- Browser language fallback.
- Default language fallback.

## Translation coverage

Translate:
- Navigation.
- Buttons.
- Forms.
- Errors.
- Help articles.
- Static documentation.
- Legal notices, with reviewed legal translations.
- Accessibility labels.
- Notification templates.
- SEO metadata.
- System messages.

Do not automatically translate user-generated posts or messages without an explicit feature and appropriate disclosure.

## Technical design

Use a maintainable translation library compatible with the project.

Store translation keys in version-controlled locale files or an approved CMS localization table.

Support interpolation, pluralization, locale-specific formatting and translation fallback.

Never use machine translation as a substitute for legal translation review.

---

# 11. CMS DATABASE DESIGN

Inspect existing Supabase schemas before creating anything.

Reuse appropriate tables and avoid duplicates.

Proposed entities include:

**cms_pages**
- id
- slug
- title
- description
- section
- status
- template
- seo_title
- seo_description
- canonical_path
- created_at
- updated_at
- published_at

**cms_page_revisions**
- id
- page_id
- locale
- content_blocks
- version
- editor_id
- created_at
- change_note

**cms_navigation**
- id
- label_key
- route
- group
- order_index
- visible
- audience

**help_articles**
- id
- category_id
- slug
- locale
- title
- body
- status
- published_at

**support_tickets**
- id
- user_id
- verified_contact
- category
- subject
- description
- status
- assigned_to
- created_at
- updated_at

**blog_posts**
- id
- slug
- title
- excerpt
- content
- author_id
- category_id
- tags
- status
- published_at

**organizations**
- id
- name
- description
- verified_status
- website
- owner_id

**job_listings**
- id
- organization_id
- title
- description
- work_mode
- employment_type
- location
- compensation_details
- status
- application_deadline
- created_at

**job_applications**
- id
- job_id
- applicant_id
- resume_asset_id
- cover_letter
- status
- created_at

**developer_applications**
- id
- owner_id
- app_name
- description
- requested_scopes
- review_status
- created_at

**developer_credentials**
- id
- application_id
- credential_identifier
- secret_hash
- scopes
- expires_at
- revoked_at
- created_at

**developer_webhooks**
- id
- application_id
- endpoint
- event_types
- signing_secret_reference
- enabled

**verification_applications**
- id
- user_id
- category
- status
- encrypted_evidence_reference
- reviewed_at

**locales**
- code
- display_name
- native_name
- enabled
- completeness

**translations**
- locale
- namespace
- translation_key
- translated_value
- status
- version

**ai_roadmap_items**
- id
- title
- description
- phase
- status
- completion_evidence
- updated_at

**legal_documents**
- id
- slug
- jurisdiction
- locale
- version
- status
- effective_date
- approved_by
- approved_at

Add appropriate indexes, foreign keys, uniqueness constraints and timestamps.

Implement Supabase Row Level Security for all private resources.

Never allow regular visitors to alter published CMS documentation, application statuses, job moderation state or developer credentials.

---

# 12. ADMIN CMS — COMPLETE MANAGEMENT SYSTEM

Extend the existing VELORI admin dashboard.

Do not build a disconnected second dashboard.

Add these sections:

**Documentation Manager**
- All documents.
- New document.
- Edit document.
- Categorize.
- Preview.
- Publish.
- Unpublish.
- Revisions.
- SEO settings.
- Translation management.

**Legal Manager**
- Draft policy.
- Review status.
- Authorized approval.
- Version history.
- Effective dates.
- Change notices.
- Public policy archive.

**Blog Manager**
- Article drafts.
- Categories.
- Authors.
- Media.
- Scheduled publishing.
- Featured posts.

**Careers Manager**
- Organization verification.
- Job approval.
- Listings.
- Applications.
- Employer accounts.
- Abuse reports.

**Developer Manager**
- Application submissions.
- Approvals.
- Requested scopes.
- Active credentials.
- API usage.
- Security events.
- Webhooks.
- Revocations.

**Support Manager**
- Ticket inbox.
- Categories.
- Assignments.
- Internal notes.
- Response templates.
- Escalations.

**VELORI AI Manager**
- Roadmap milestones.
- Phase status.
- Feature descriptions.
- Waitlist management.
- Public availability indicators.

**Navigation Manager**
- Footer links.
- Header links.
- Route targets.
- Visibility rules.
- Ordering.
- Localization.

Implement draft/published separation, authorization checks, audit logs and rollback where practical.

---

# 13. ANIMATION AND INTERACTION SYSTEM

Implement an intentional animation language rather than random effects.

## Legal pages

Animated document covers, subtle paper unfolding, reading progress and section navigation.

## About pages

Connected social nodes, moving feature cards and animated storytelling diagrams.

## VELORYZ

Editorial timeline, animated technical schematics and controlled motion typography.

## Careers

Expanding job cards, live filter transitions, application stepper and status timeline.

## Developers

Terminal-style examples, animated API request flow, response panels and interactive code examples.

## VELORI AI

Flowing network visualization, phased roadmap, milestone reveals and controlled ambient motion.

## Muse

Animated canvas layers, movable editor illustrations and feature previews.

## Support

Search transitions, accordion opening, responsive documentation panels and ticket status visualization.

## Multilingual interface

Smooth language change without flashing, broken layout or navigation reset.

## Motion quality requirements

- No perpetual high-intensity movement around reading text.
- No unnecessary animation libraries.
- No remote animation assets unless approved.
- Prevent layout shifts.
- Use performant transform and opacity transitions where possible.
- Ensure animations work in actual Chrome, Firefox, Edge and supported mobile browsers.
- Do not claim success solely from an integrated preview.

---

# 14. FOOTER STRUCTURE

Build a structured footer with clear groups.

### VELORI
About, Popular, VELORI Lite, VELORI AI, VELORI Muse, VELORI Conversations, VELORI Verified.

### Company
VELORYZ, Blog, Careers, Locations, Contact.

### Support
Help Center, Account Help, Safety, Contact Uploading & Non-Users, Report a Problem.

### Developers
Developer Home, Documentation, API Reference, Developer Applications, Authentication, Security, Changelog.

### Legal
Privacy, Terms, Cookies, Community Guidelines, Acceptable Use, Data Policy, Copyright, Child Safety, Accessibility, Account Deletion, Grievances.

### Preferences
Interface Language.

Footer copyright:

**© 2026 VELORI. A VELORYZ Product.**

Use the current year dynamically for future years where appropriate.

All footer destinations must resolve to meaningful routes.

No dead links, fake buttons or silent redirects.

---

# 15. REQUIRED DOCUMENT FILES

Create an organized source-of-truth documentation tree in the existing repository, adapting paths where necessary.

    docs/
      velori/
        README.md
        PRODUCT_OVERVIEW.md
        DESIGN_SYSTEM.md
        ROUTE_REGISTRY.md
        UI_ANIMATIONS.md
        CONTENT_GUIDELINES.md

        pages/
          veloryz.md
          about.md
          blog.md
          careers.md
          help.md
          developers.md
          locations.md
          popular.md
          lite.md
          ai.md
          muse.md
          conversations.md
          contact-uploading.md
          verified.md
          contact.md

        legal/
          privacy.md
          terms.md
          cookies.md
          community-guidelines.md
          acceptable-use.md
          data-policy.md
          child-safety.md
          copyright.md
          accessibility.md
          account-deletion.md
          grievances.md

        developers/
          overview.md
          quickstart.md
          applications.md
          authentication.md
          authorization.md
          api-keys.md
          security.md
          api-reference.md
          pagination.md
          rate-limits.md
          error-codes.md
          webhooks.md
          versioning.md
          sandbox.md
          changelog.md
          openapi.yaml

        platform/
          localization.md
          cms.md
          notifications.md
          jobs-system.md
          support-system.md
          verification-system.md
          ai-roadmap.md
          privacy-controls.md

        qa/
          audit.md
          testing.md
          accessibility.md
          implementation-status.md

Every file must contain meaningful original documentation.

Don't simply generate headings with TODO placeholders.

Connect public documents to the real CMS/rendering system while retaining these repository documents as maintainable specifications or approved source material.

---

# 16. SEARCH ENGINE OPTIMIZATION

Each public route requires:
- Unique title.
- Unique meta description.
- Canonical URL.
- Open Graph metadata.
- Appropriate social preview.
- Correct heading hierarchy.
- Structured data where applicable.
- Sitemap integration.
- Robots handling.
- Localized alternate URLs where supported.

Job pages may use appropriate JobPosting structured data only for real, eligible listings.

Article pages may use Article structured data reflecting actual authorship and publication dates.

Do not index private dashboards, application details, authentication tokens or unpublished legal drafts.

---

# 17. ACCESSIBILITY AND RESPONSIVENESS

Target WCAG 2.2 AA design and engineering practices, subject to actual testing.

Test:
- Keyboard navigation.
- Focus visibility.
- Color contrast.
- Screen reader semantics.
- Heading hierarchy.
- Form labels.
- Error announcements.
- Reduced motion.
- Touch target usability.
- Mobile layout.
- High zoom.
- Document sidebar behavior.
- Dialog focus management.
- Language selection.
- Long article reading.
- Code examples on small screens.

Document unresolved issues rather than falsely reporting full compliance.

---

# 18. DEVELOPMENT EXECUTION PHASES

Implement in controlled phases, but do not stop at the planning stage.

## Phase 0 — Repository Audit

Inspect current implementation, map existing routes, identify database capabilities and write the initial audit.

## Phase 1 — Shared Infrastructure

Build the information-page system, page shells, documentation engine, shared animations, footer route registry and CMS integration foundations.

## Phase 2 — Company & Product Pages

Complete VELORYZ, About, Locations, Popular, Lite, AI, Muse and Conversations.

## Phase 3 — Legal & Trust Center

Create the distinct legal pages, CMS drafts, revision management, privacy controls and compliant publication workflow.

## Phase 4 — Help & Contact

Build help categories, complete help articles, ticket management and functional contact routing.

## Phase 5 — Blog & Careers

Create CMS publishing, real listings, recruiter workflow, search, applications, secure attachments and notifications.

## Phase 6 — Developer Platform

Implement developer documentation, application reviews, security management and approved API functionality.

## Phase 7 — Multilingual Support

Integrate translation keys, language selection, persistence, content localization and reviewed legal translations.

## Phase 8 — UI & Animation Completion

Apply the final premium design, document interactions, responsive layouts and reduced-motion support.

## Phase 9 — Security & Quality Audit

Verify permissions, API behavior, privacy boundaries, routing, forms, accessibility, database policies and browser compatibility.

## Phase 10 — Production Review

Produce an implementation report and identify any blockers requiring credentials, legal approval, deployment configuration or external services.

---

# 19. TESTING AND VERIFICATION

Run tests appropriate to the existing project.

Test all 17 original footer routes.

Test every additional public route.

Test CMS draft and publish workflows.

Test legal document version histories.

Test developer applications, scope approvals, revoked credentials, expired tokens and unauthorized access.

Test job filtering, application submissions, employer access and applicant privacy.

Test support tickets and contact confirmation.

Test mobile and desktop language selection.

Test browser refresh on nested routes.

Test animation behavior in actual browsers.

Test route transitions without breaking existing VELORI authentication.

Test Supabase RLS with distinct authorized and unauthorized users.

Test search and pagination with both empty and populated data.

Test genuine error conditions rather than only successful responses.

Never bypass authentication or disable security controls to make a test pass.

Do not claim tests ran unless they actually executed.

---

# 20. FINAL ACCEPTANCE CRITERIA

The project is complete only when:

1. Every required footer route exists.
2. Each page has substantial original content.
3. Each page has an individual visual identity.
4. Documentation pages use the shared animated document engine.
5. Every relevant CMS document is editable by authorized staff.
6. Legal drafts have controlled review and publication status.
7. The blog has a working CMS.
8. Careers uses legitimate job data.
9. Job applications function securely.
10. Support requests are persisted and routed correctly.
11. Developer applications have an approval workflow.
12. All published API documentation reflects actual deployed functionality.
13. API permissions are verified.
14. Authentication and sensitive credentials are properly secured.
15. AI development status displays genuine records.
16. Language selection works and persists.
17. Footer links are correct.
18. Browser navigation works.
19. Mobile layouts are responsive.
20. Accessibility checks have been performed.
21. No unrelated social platform functionality is broken.
22. Console errors and relevant runtime failures have been addressed.
23. Database migrations are documented and tested.
24. A final implementation report exists.

**The final implementation report must explicitly identify:**

- Features completed.
- Routes created or updated.
- Database migrations.
- CMS documents created.
- API endpoints implemented.
- APIs intentionally left unavailable.
- Security tests performed.
- Accessibility results.
- Legal drafts awaiting review.
- External configuration needed.
- Remaining issues.

Do not report incomplete work as complete.

---

# 21. FIRST EXECUTION INSTRUCTION

Begin working on the existing VELORI repository immediately.

Start with the actual repository audit, not a redesign proposal.

Then establish the documentation files, content registry and shared document engine.

Write the real content specified above into the appropriate CMS seed files or documents.

Implement every route in the existing routing architecture.

Continue through the execution phases in dependency order.

Use the existing VELORI authentication, database, admin dashboard and social platform integrations wherever appropriate.

Avoid replacing working systems with simplified examples.

Maintain detailed, machine-readable implementation records so work can be continued across agent sessions without losing completed decisions.

**Final objective: Transform VELORI's basic footer into a professional, fully documented, multilingual, securely administered, animated and functional ecosystem worthy of a production social media platform.**

**This is an implementation assignment, not a brainstorming assignment.**
