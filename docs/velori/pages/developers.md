# Developers

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current implementation

The current CMS page is `/developers`, with HTML, CSS and JavaScript preserved in Page Studio and exported in `docs/cms-pages/velori-pages.json`. Its currently authored content follows.

The current platform
The app uses React, TypeScript, Vite and React Router. Supabase provides authentication, PostgreSQL, private media storage, realtime events and server functions. The admin console manages content, communication and platform settings.

Public API availability
No public API keys, app registration or stable third-party API contract are offered here yet. Internal database tables and administrative endpoints must not be treated as public integration APIs.

Media in the product
Posts, reels, stories and messages have their own validation and audience rules. Messaging supports JPEG, PNG, WebP, GIF, MP4, PDF and supported audio formats with a 25 MB attachment limit.

Running the source project
Follow START_HERE.md in your project download. Use the included lockfile, configure your own environment where needed, then run the project’s development and verification commands. Hosted records and uploaded private media are separate from source.

Integration principles
Keep user permissions and service boundaries explicit.

Have an integration proposal?
Describe the user problem, the data you need and how the user would authorize access. Send the proposal through our official contact channel.

The deployed first-party administrator API is under the configured Supabase server function. It is not a public delegated developer API. The requested /v1 interface remains proposed and no third-party credentials are issued.

## Expanded authored requirements and content

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
