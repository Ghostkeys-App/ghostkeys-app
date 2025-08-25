# Changelog

> **Cut date:** 2025‑08‑25 (Europe/London)
> **Scope:** \~45 commits touching \~60+ files across UI, state, crypto, IC integration, build, and policies.
> **Summary:** Large UI/UX refactor (Website Logins, Profile/Seed flows), reworked Vault state (IndexedDB + IC sync), crypto plumbing (vetKD + SLIP‑0010), factory‑first actor bootstrapping, and CSP/Permissions‑Policy fixes.

---

## 🚀 Highlights

* **New Website Logins module** with full CRUD, modals, and client‑side encryption.
* **Profile & Seed UX**: import / export / copy, validation for 12‑word phrases.
* **Vault state rework**: unified context, IndexedDB persistence, on‑demand sync with IC, and safe bootstrapping on seed import.
* **Factory‑first bootstrapping**: frontend initializes the Factory actor first, then resolves other canister IDs.
* **Crypto stack**: vetKD‑backed key derivation + SLIP‑0010; clean AES encrypt/decrypt mapper utilities.
* **Security headers**: fixed Clipboard API via `Permissions-Policy`; CSP widened for local/dev IC endpoints.
* **Spreadsheet & Secure Notes**: refactors and MVPs aligned to new design system.

---

## 🔄 Breaking / Behavior Changes

* **Navigation default** now lands users in **Website Logins** instead of a generic home.
* **Vault reload button** added in sidebar; **disabled** when `currentVault.existsOnIc === false` (no on‑chain copy to pull from).
* **Seed import** now **bootstraps vault state** immediately (initial vault selection, IDB write, and UI hydration).
* **Actor initialization order** is now **factory‑first**; code relying on direct per‑canister IDs must adapt.

Migration checklist:

1. Replace any direct actor creation with the **factory→discover→create actor** flow.
2. Ensure UI events expecting an immediate vault are tolerant to a **hydration step** after seed import.
3. Confirm sidebar **Reload** respects disabled state until a vault exists on IC.

---

## 🧭 UI/UX Changes

### Website Logins

* **Routes & Layout**: adds a dedicated page with a two‑pane or table‑first layout (depending on viewport).
* **Modals**: standard modals for `AddSite`, `AddEntry`, and now also `RenameSite`, `EditEntry`, and `Delete` confirmations.
* **Validation**: fields validated before enabling primary action; Delete confirmations use clear danger styling.
* **Danger palette**: standardized **danger RGBA** utility to increase contrast and communicate irreversible actions.
* **Toasts**: top‑center stacked toasts, with a high‑salience variant for destructive actions ("are you sure" confirmations still in the modal itself).

### Sidebar & Profile

* **Current vault control**: next to the current vault label/button (`gk-vault-toggle`), a **kebab (vertical dots)** affordance reveals **Pencil (rename)** and **Trash (delete)** with a short slide animation.
* **Reload from IC** button: subtle, near the Profile block, full width, low‑chromatic contrast ("utility" look).

  * **Enabled** only when an IC copy exists; otherwise **disabled** with a helpful tooltip.
* **Profile modal**: seed export/copy moved here; clearer warning language and spacing.

### Spreadsheet & Secure Notes

* **Spreadsheet**: refactored component boundaries (Header, Cell, ColumnHeader) with add/remove column affordances and an optional secret/plain toggle.
* **Secure Notes**: MVP with title/content pairs, using the same encryption pipeline as logins.

---

## 🗃️ State, Storage, and Sync

### VaultContext Rework

* Introduces a more explicit **action set** (`setActiveVault`, `upsertVault`, `loadFromIdb`, `saveToIdb`, `syncFromIc`, etc.).
* **Default/Active vault** is derived deterministically (seed → userId → vault namespace).
* **IDB persistence**: serialized, versioned records; write‑behind on edits and explicit saves after bulk ops.
* **Seed import bootstrap**: upon valid seed, initializes identity, derives user scope, selects/creates a local vault, and persists to IDB.

### Sync Semantics

* **Reload from IC**: pulls authoritative `VaultData` and **merges** into local state using a conflict‑aware strategy (timestamp/version precedence; new cells/notes appended, deletions respected).
* **Disable logic**: `existsOnIc` gate to prevent no‑op pulls.

### Race‑Condition Hardening

* **Shared HTTP Agent** and **Identity**: lazy init patterns to prevent `undefined` agent/identity during early renders; context getters return **promises** and callers `await` before actor use.
* `useEffect` guards ensure identity is set **before** vetKD/actor calls.

---

## 🔐 Crypto & Security

### Key Derivation

* **vetKD** integration: derivation scoped per user/org/canister (we default to **PerUser** for vault materials).
* **SLIP‑0010**: deterministic HD keys from seed; used to produce intermediate keys consumed by the final AES key derivation.
* **Final key**: `deriveFinalKey(seed|vetkd) → AESKey` (Uint8Array) with stable encoding for storage.

### Encryption Utilities

* **Mapper utilities** wrap AES‑GCM encrypt/decrypt with typed inputs/outputs for:

  * Website credentials (site→entries)
  * Secure notes
  * Spreadsheet cells/columns where `secret` type is enabled

### Clipboard & CSP

* **Clipboard API unblocked** by adding a `Permissions-Policy` header:

  ```http
  Permissions-Policy: clipboard-read=(self), clipboard-write=(self)
  ```

* **CSP** widened for local and IC hosts to avoid `connect-src` blocks during actor calls. Example baseline:

  ```http
  Content-Security-Policy: default-src 'self';
  connect-src 'self' https://icp0.io https://ic0.app http://localhost:* https://localhost:*;
  img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self';
  ```

> **Note:** IC asset certification disallows dynamic nonces; prefer stable hashes or the documented strict‑dynamic pattern for static bundles.

---

## 🧩 IC Integration & Build

### Factory‑First Bootstrapping

* **Frontend** now creates a **Factory canister actor** first.
* Retrieves other canister IDs (vault/shared/encryption) via factory methods, then instantiates those actors.
* This removes hard‑coded IDs and simplifies **environment switching**.

### `dfx.json` & Releases

* Pinned **release URLs** for factory/vault/shared `.wasm` and `.did` artifacts updated.
* Frontend canister declaration now relies on **remote declarations** + `post_install` `dfx generate` for TypeScript bindings.
* Environment export: `CANISTER_ID_FACTORY_CANISTER_BACKEND` exposed for the frontend runtime.

### Deploy/Dev Quality of Life

* Fixed an issue where playground deploys would **default to stale/frontdoor IDs**. Actor creation now always respects the exported env var.
* Added `connect-src` for `localhost` and common IC gateways to avoid **CORS/CSP** failures.

---

## 🛠️ Refactors & Internal APIs

* **Context/API**: `APIContext` exposes async getters:

  ```ts
  type API = {
    getFactoryCanisterAPI(): Promise<FactoryCanisterAPI>
    getSharedVaultCanisterAPI(): Promise<SharedCanisterAPI>
    getVetKDDerivedKey(): Promise<Uint8Array>
    userExistsWithVetKD(userId: string): Promise<boolean>
  }
  ```

* **Website Logins**: normalized types `Site`, `SiteEntry` with mappers from encrypted → view model.

* **Spreadsheet**: extracted `ColumnHeader`/`Cell` components; add‑column affordance near the right edge; hover‑to‑reveal delete icon.

* **Notes**: simple tuple `[title, body]` with encrypted storage and searchable plaintext indices (local only).

---

## 🐞 Fixes

* **Clipboard API blocked** → fixed by `Permissions-Policy` and minor CSP tweak.
* **sharedHTTPAgent undefined** → fixed with lazy init + `await`ed getters.
* **Deploy to playground** used wrong canister ID → fixed via env‑driven actor bootstrap.
* **Seed path derivation mismatch** (bytes vs hex string) → standardized hex inputs for SLIP‑0010; added guards for invalid paths.
* **UI affordances visibility** (Pencil/Trash) → ensured SVGs render in dark mode and respect CSS `fill`.

---

## ✅ Validation & Tests (what to verify)

* **Seed import (12 words)**

  * Rejects non‑12 lengths; every word must exist in the **BIP‑39 English** list.
  * On success, identity is created, vault is bootstrapped, and IDB persisted.
* **Website Logins**

  * Add/Rename/Delete site; Add/Edit/Delete entry; ensure data round‑trips via encryption mappers.
  * Danger modal shows; toast confirms.
* **Reload from IC**

  * Disabled until `existsOnIc` flips true; on enabled pull, merges without duplications or lost deletions.
* **Spreadsheet**

  * Add column (secret/plain), delete rows with hover affordance, maintain N filled + 5 empty rows policy.
* **Secure Notes**

  * Create/edit/delete; verify AES round‑trip and local search index works.
* **Network policies**

  * Clipboard read/write works on supported browsers.
  * No CSP violations when calling IC actors (dev + ic gateways).

---

## 🧭 Developer Notes

* On IC, **auth is caller‑principal based**; client must create `HttpAgent` only after identity is ready.
* Avoid keeping **plaintext secrets** in React state longer than necessary; encrypt at boundaries and keep only view models in memory.
* For asset canisters, keep headers **static** and use **hash‑based CSP** where possible.
