# Contact

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current implementation

The current CMS page is `/contact`, with HTML, CSS and JavaScript preserved in Page Studio and exported in `docs/cms-pages/velori-pages.json`. Its currently authored content follows.

Product support
Tell us the page, the action you tried, what happened and the approximate time. Include an error reference if one is shown. Never send a password, access code or verification link.

Collaboration and careers
Introduce your work, your area of interest and the kind of collaboration you have in mind. See Careers for the current opportunities policy.

Privacy and safety questions
Use in-app reporting for a specific message or content item when possible. For a wider concern, describe the issue and share only the information needed to understand it.

What happens when you contact us
The contact form prepares an email in your own email application. You review and send it there. It does not silently submit a support ticket or promise a response time.

The current form prepares a user-reviewed email draft to the contact address configured in Site settings. It does not save a ticket or claim staff delivery. The proposed ticket/outbox foundation is required before replacing this behavior with persisted requests.

## Expanded authored requirements and content

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
