# Contact Uploading

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current implementation

The current CMS page is `/contact-uploading`, with HTML, CSS and JavaScript preserved in Page Studio and exported in `docs/cms-pages/velori-pages.json`. Its currently authored content follows.

How people discovery works
Search a profile name or username, explore the People directory and open eligible shared-following lists. These are not matches against your private phone address book.

If you do not use VELORI
Someone may mention your name or include your information in content. For a concern, use the official contact channel and describe the relevant page or post without sending unnecessary private information.

Before you share another person’s details
Ask permission before posting private contact information, an address or a conversation. Use audience controls thoughtfully.

If importing is introduced later
The feature would need clear information about consent, data use, access and removal. It will be documented before being offered.

## Expanded authored requirements and content

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
