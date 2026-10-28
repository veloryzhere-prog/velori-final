# Careers

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current implementation

The current CMS page is `/jobs`, with HTML, CSS and JavaScript preserved in Page Studio and exported in `docs/cms-pages/velori-pages.json`. Its currently authored content follows.

Current opportunities
There are no active vacancies announced here today. Future openings will be published on this page with a role description, requirements and a clear application process.

The work behind VELORI
These are areas of future team growth, not advertised job openings.

Introduce yourself
If you would like to collaborate, send a short introduction, your area of interest and links to work you are comfortable sharing. Use the official email below; it opens your email application and does not create a tracked job application.

What to include
Give the team enough context to understand your work.

A simple application safety rule
VELORYZ does not ask for a VELORI password, sign-in code or payment to consider an introduction. Only trust opportunities confirmed through the official contact channel.

The current page states that no vacancies are announced. There is no employer marketplace, applicant database, resume handling or hiring workflow yet.

## Expanded authored requirements and content

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
