# UI Changelog — Aug–Sep 2025

> **Cut date:** 2025-09-20 (Europe/London)
> **Scope:** ~35 UI-heavy commits across partner embeds, browser extension, SDK data surfaces, profile tooling, and vault polish.
> **Summary:** Partner iframe now ships a responsive identity popup, the Chrome extension lands its first interactive credential flow, the SDK/vault provider stack exposes stable schemas for plug-ins, and the in-app profile/settings surfaces received a full UX pass.

---

## 🖥️ Highlights
- Partner iframe handshake with secure `IdpPopup` windowing, origin validation, and themed embed demo.
- Chrome extension MVP: popup shell, credential suggestion banner, runtime messaging, and iconography.
- Vault SDK adapters rebuilt to expose serialized spreadsheets/logins/notes for plug-in consumption.
- Multi-profile settings overlay with guarded switching, seed reveal modal, and unsynced vault prompts.
- Quality-of-life polish: spreadsheet cell fixes, login separators for special characters, cleaner navigation.

---

## Partner IFrame Experience
- Added `src/zero-proof-vault-frontend/src/utility/identity/IdpPopup.tsx` to drive partner sign-in with identity selection, seed import, window resizing, and strict referrer/origin enforcement.
- Updated `src/zero-proof-partner-iframe/src/bridge.ts` and theme styles to broadcast vault state to embeds, handle responsive sizing, and route postMessage responses back to the opener.
- Delivered a runnable demo in `examples/partner-iframe-demo/` plus hosted assets (`public/sdk/gk-embed-v1.js`) so partners can test drop-in authentication.
- Hardened environment management (`dfx.json`, iframe Vite configs) ensuring local vs prod iframe origins resolve correctly for secure postMessage flows.

## Chrome Extension UI
- Introduced the popup shell (`src/chrome-extension/src/popup.js`, `popup.html`, `popup.css`) with welcome state, identity controls, vault selector, and a manage-in-app CTA.
- Built background/content messaging (`background.js`, `content.js`) to surface a "Save to GhostKeys" toast overlay and persist selected vaults.
- Added credential suggestion banner logic that reacts to detected forms, offering quick-save actions without leaving the current tab.
- Shipped branded icons and manifest wiring, plus fallback backups to preserve early prototypes.

## SDK & Plug-in Data Surfaces
- Refactored vault provider modules (`utility/vault-provider/index.tsx`, `logins.ts`, `secure_notes.ts`, `spreadsheet.ts`, `types.ts`) to serialize data per-template for partner/extension consumption.
- Implemented encrypt-and-serialize helpers for spreadsheets, logins, and notes so plug-ins receive stable payloads while the UI stays fully encrypted at rest.
- Synced spreadsheet column schema with new decryption pipeline, preventing data loss when add/remove operations fire through the SDK.
- Ensured settings-driven sync (`syncCurrentVaultWithBackend`) commits identities before iframe/extension callbacks consume them.

## Profile Management & Settings
- Rebuilt the profile menu (`components/profile-menu/ProfileMenu.tsx`) with active state badges, switch prompts, logout handling, and contextual modals for adding identities.
- Enhanced `ProfileModal` and `NewSidebar` to coordinate profile creation, unsynced warnings, and action buttons for reveal/remove flows.
- Added a persistent `SettingsOverlay` route featuring tabbed navigation (General, Profiles, Security), toast-driven feedback, and disabled states when vault sync is pending.
- Implemented guarded profile switching that blocks transitions while a vault has unsynced edits, prompting users to confirm the action.

## UI Polish & Fixes
- Stabilized spreadsheet cell rendering and ensured new rows/columns hydrate correctly after partner syncs.
- Added user/pass separators that respect special characters inside login entries, preventing layout breakage.
- Tweaked iframe popup theming, gradients, and focus states for higher contrast and accessibility.
- Simplified modal navigation paths, eliminating stale routes after profile sign-out.

## QA Focus
- Verify IdP popup respects origin checks, resizes for large profile lists, and posts `gk:idp:*` messages back to the partner iframe.
- Exercise Chrome extension flows: install, sign in, trigger credential capture banner, switch vaults, and launch the full app hand-off.
- Confirm serialized payloads for spreadsheets/logins/notes round-trip through both the iframe demo and extension without schema mismatches.
- Test profile switching while edits are pending to ensure the guard rails (toasts + confirmation modals) fire reliably.

---

_This changelog intentionally scopes to UI-visible work landed after 2025-08-01. Backend, crypto, and build system changes are tracked separately._
