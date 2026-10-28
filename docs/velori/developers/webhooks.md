# VELORI Developers — Webhooks

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

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
