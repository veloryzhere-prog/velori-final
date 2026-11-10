# VELORI Developers — Api Reference

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

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
