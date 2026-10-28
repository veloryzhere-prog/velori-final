# Accessibility acceptance record

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

# 17. ACCESSIBILITY AND RESPONSIVENESS

Target WCAG 2.2 AA design and engineering practices, subject to actual testing.

Test:
- Keyboard navigation.
- Focus visibility.
- Color contrast.
- Screen reader semantics.
- Heading hierarchy.
- Form labels.
- Error announcements.
- Reduced motion.
- Touch target usability.
- Mobile layout.
- High zoom.
- Document sidebar behavior.
- Dialog focus management.
- Language selection.
- Long article reading.
- Code examples on small screens.

Document unresolved issues rather than falsely reporting full compliance.

---

## Existing observed checks

The Help search announces result counts, FAQ expansion is keyboard-native details/summary, controls are labelled, focus styles are present, and global motion changes affect documents. Isolated mobile and tablet document measurements found no horizontal overflow. This is targeted QA, not a WCAG 2.2 certification.

## Open acceptance

Independent screen-reader and contrast audits, high zoom, physical mobile keyboard handling, all dialogs across new workflow views, legal translation review and supported-browser coverage remain open. Preserve visible focus and do not place continuously moving decoration next to long reading text.
