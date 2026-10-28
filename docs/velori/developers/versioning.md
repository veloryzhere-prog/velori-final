# VELORI Developers — Versioning

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current release

The current site code is deployed independently of database migrations and CMS publications. CMS pages have draft state, published version numbers and recoverable source history; repository commits identify application source. These are separate version streams and must not be conflated.

## Proposed integration API

Reserve /v1 for the reviewed integration contract. Publish a changelog for each actual addition or behavioral change, compare schema compatibility and give migration instructions before retiring supported behavior. Do not advertise invented deprecation dates. Webhook envelopes require their own payload version and stable event identifiers.

Application approval and access scopes must be checked at request time; a version header must never enable an unpublished endpoint or bypass current privacy controls.
