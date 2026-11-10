# VELORI Platform — Jobs System

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

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
