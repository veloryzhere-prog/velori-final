# Help

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current implementation

The current CMS page is `/help`, with HTML, CSS and JavaScript preserved in Page Studio and exported in `docs/cms-pages/velori-pages.json`. Its currently authored content follows.

Your account
Sign in with your account email. Use Forgot password for recovery, and follow the verification link when email confirmation is required.

Create and share
Start from Create and choose Post, Reel or Story. Review the preview and audience before publishing. Keep drafts open until their save completes.

Messages and media
Open a conversation name for its settings and shared content. The expression picker adds emoji to your draft and lets you choose an animated GIF from your device. Sending follows the same private attachment workflow.

Privacy and safety
Review who can message you, profile visibility and connection lists. Block and report controls are available in relevant content and conversation menus.

Need a person?
Contact the team with the page address, the action you tried and what happened. Never send passwords or verification codes.

## Expanded authored requirements and content

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
