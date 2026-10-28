# VELORI Developers — Security

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

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
