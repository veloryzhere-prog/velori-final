# VELORI Platform — Localization

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

# 10. MULTILINGUAL PLATFORM

Build a proper internationalization architecture.

## Languages

Initial proposed supported locales:
- English — `en`
- Hindi — `hi`

Additional locales must be supported by the architecture and may be published when high-quality translations and review are available.

Potential expansion:
- Bengali — `bn`
- Tamil — `ta`
- Telugu — `te`
- Marathi — `mr`
- Spanish — `es`
- French — `fr`

Do not label incomplete or machine-generated drafts as fully supported translations.

## Language selector

Support:
- Language name.
- Native-language label.
- Search.
- Current selection.
- Preview of available translated UI.
- Immediate language updates.
- Saved account preference.
- Browser language fallback.
- Default language fallback.

## Translation coverage

Translate:
- Navigation.
- Buttons.
- Forms.
- Errors.
- Help articles.
- Static documentation.
- Legal notices, with reviewed legal translations.
- Accessibility labels.
- Notification templates.
- SEO metadata.
- System messages.

Do not automatically translate user-generated posts or messages without an explicit feature and appropriate disclosure.

## Technical design

Use a maintainable translation library compatible with the project.

Store translation keys in version-controlled locale files or an approved CMS localization table.

Support interpolation, pluralization, locale-specific formatting and translation fallback.

Never use machine translation as a substitute for legal translation review.

---
