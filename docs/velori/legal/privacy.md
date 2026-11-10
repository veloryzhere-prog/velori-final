# Privacy

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current implementation

The current CMS page is `/privacy`, with HTML, CSS and JavaScript preserved in Page Studio and exported in `docs/cms-pages/velori-pages.json`. Its currently authored content follows.

Account and profile data
VELORI uses authentication and profile information to provide your account. Your posts, reels, stories, messages, follows and interactions support the features you choose to use.

Audience and visibility
Choose an audience before publishing and review your profile and connection-list settings. Private content is governed by the service’s access policies. Mutual lists respect relevant visibility and blocking controls.

Conversations and attachments
Message attachments use private storage and time-limited access links. Recipients may copy content they can access. VELORI does not claim that its direct messages are end-to-end encrypted.

Personal preferences
Appearance, motion, recovery drafts and pending changes may be kept on your device. Chat preferences and hidden messages can synchronize to your account. Wait for pending work to save before clearing browser data.

Your controls and questions
Use Privacy settings for available controls. For a privacy question or removal concern, contact the team through the official channel. Retention, legal basis and jurisdiction-specific rights belong in the operator’s reviewed notice.

## Expanded authored requirements and content

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
