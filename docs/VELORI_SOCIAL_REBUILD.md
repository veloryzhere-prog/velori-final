# VELORI social-first frontend

The user-facing presentation now lives in src/product. ProductFrame owns navigation and creation entry. WelcomeScreen, AuthScreen, FeedScreen, ProfileIdentity, PostReader and StudioHeader provide the new screen structures. Existing route controllers retain their established auth, Supabase, visibility, engagement and media operations. Shared route headings, contextual navigation, settings and confirmation views use the new product presentation. Administration source and backend contracts remain unchanged.

The current product direction is white, warm yellow and pink. product.css scopes styles to product/public surfaces, and standalone editor selectors require the product shell to be present. This keeps the admin route tree outside the new design system.

See VELORI_PROGRESS.md for verification evidence and known acceptance limits.
