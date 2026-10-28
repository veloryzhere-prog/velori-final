# PHASE 6 AI PROVIDER SECURITY

## Policy
Provider credentials, secrets and model configuration are not directly exposed through browser state or public configuration tables. The codebase maintains the safe separation between browser UI and server-managed provider configuration.

## Required controls
- Secret values remain server-side only
- Runtime consent remains separate from local model behavior
- Remote provider fallback must respect explicit consent and quota rules
- Browser state must not be treated as the source of truth for provider health

## Current repository status
The project includes a secure admin shell and feature flag surfaces, but the actual live provider configuration for Gemini or local runtimes is environment-specific and must be configured in the deployed server environment.
