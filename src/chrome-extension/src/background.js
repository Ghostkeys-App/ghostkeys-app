// background.js — MV3 service worker
// Responsibilities:
// - Store seed + vaults in chrome.storage
// - Handle messages from popup/content scripts
// - Return credentials for a given hostname

'use strict';

import {
    derivePrincipalAndIdentityFromSeed,
    generateSeedAndIdentityPrincipal,
} from './crypto.js';

/** Storage key constants (single source of truth). */
const STORAGE_KEYS = {
    SEED_PHRASE: 'gk_seed_phrase',
    PRINCIPAL_TEXT: 'gk_principal_text',
    VAULTS: 'gk_vaults',
    SELECTED_VAULT_ID: 'gk_selected_vault_id',
    DIRTY: 'gk_dirty',
    LAST_SYNCED_AT: 'gk_last_synced_at',
    PENDING_CANDIDATE: 'gk_pending_candidate',
};

/** Broadcast state changes to any open UIs (popup, etc.). */
function notifyStateChanged(topic = 'state-changed', extra = {}) {
    try {
        chrome.runtime.sendMessage(
            { type: 'gk-app-state-updated', topic, ...extra },
            () => {
                // Swallow "Could not establish connection. Receiving end does not exist."
                void chrome.runtime.lastError;
            }
        );
    } catch (_) {
        /* no-op */
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ──────────────────────────────────────────────────────────────────────────────

/** @param {Record<string, any>} obj */
async function setStorage(obj) {
    return chrome.storage.local.set(obj);
}

/** @param {string[]|string} keys */
async function getStorage(keys) {
    return chrome.storage.local.get(keys);
}

/** @returns {Promise<object|null>} currently selected vault or null */
async function getSelectedVault() {
    const obj = await getStorage([STORAGE_KEYS.SELECTED_VAULT_ID, STORAGE_KEYS.VAULTS]);
    const id = obj[STORAGE_KEYS.SELECTED_VAULT_ID];
    const vaults = obj[STORAGE_KEYS.VAULTS] || [];
    return vaults.find((v) => v.id === id) || null;
}

// ──────────────────────────────────────────────────────────────────────────────
/** URL / domain helpers */
// ──────────────────────────────────────────────────────────────────────────────

/** @param {string} u */
function toHostname(u) {
    try {
        return new URL(u).hostname.toLowerCase();
    } catch {
        return (u || '').toLowerCase();
    }
}

/**
 * Domain match strategy:
 * - exact host or host endsWith entryDomain (allow subdomains)
 * @param {string} entryDomain
 * @param {string} host
 * @param {string} href
 */
function domainMatches(entryDomain, host, href) {
    const ed = (entryDomain || '').toLowerCase();
    if (!ed) return false;
    const h = (host || toHostname(href) || '').toLowerCase();
    if (!h) return false;
    return h === ed || h.endsWith('.' + ed);
}

/**
 * @param {string} host
 * @param {string} href
 * @returns {Promise<Array<{domain:string, username:string, password:string}>>}
 */
async function getCredentialsForHost(host, href) {
    const vault = await getSelectedVault();
    if (!vault) return [];
    const creds = (vault.entries || []).filter((e) => domainMatches(e.domain, host, href));
    creds.sort((a, b) => a.username.localeCompare(b.username)); // stable deterministic order
    return creds;
}

// ──────────────────────────────────────────────────────────────────────────────
// Message router
// ──────────────────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        try {
            switch (msg?.type) {
                // ─────────────── AUTH ───────────────
                case 'gk-generate-identity': {
                    try {
                        const { seed, identity, principal } = await generateSeedAndIdentityPrincipal();

                        // Bootstrap a default Personal vault (empty) and select it
                        const personalVault = {
                            id: `vault_personal_${Math.random().toString(36).slice(2, 8)}`,
                            name: 'Personal',
                            entries: [],
                        };
                        const vaults = [personalVault];

                        await setStorage({
                            [STORAGE_KEYS.SEED_PHRASE]: seed, // plaintext in demo; encrypt in prod
                            [STORAGE_KEYS.VAULTS]: vaults,
                            [STORAGE_KEYS.SELECTED_VAULT_ID]: personalVault.id,
                            [STORAGE_KEYS.PRINCIPAL_TEXT]: principal.toText(),
                        });

                        notifyStateChanged('auth-generated', { selectedId: personalVault.id });

                        sendResponse({
                            ok: true,
                            seedPhrase: seed,
                            principal: principal.toText(),
                            selectedId: personalVault.id,
                            vaults,
                        });
                    } catch (e) {
                        console.error(e);
                        sendResponse({ ok: false, error: String(e?.message || e) });
                    }
                    break;
                }

                case 'gk-import-seed': {
                    const seedPhrase = String(msg.seedPhrase || '').trim();
                    if (!seedPhrase) throw new Error('Seed phrase is empty');

                    const { principal } = await derivePrincipalAndIdentityFromSeed(seedPhrase);

                    const obj = await getStorage(STORAGE_KEYS.VAULTS);
                    const existingVaults = obj[STORAGE_KEYS.VAULTS] || [];
                    const vaults =
                        Array.isArray(existingVaults) && existingVaults.length
                            ? existingVaults
                            : [
                                {
                                    id: `vault_personal_${Math.random().toString(36).slice(2, 8)}`,
                                    name: 'Personal',
                                    entries: [],
                                },
                            ];

                    await setStorage({
                        [STORAGE_KEYS.SEED_PHRASE]: seedPhrase, // dev only; encrypt in prod
                        [STORAGE_KEYS.PRINCIPAL_TEXT]: principal.toText(),
                        [STORAGE_KEYS.VAULTS]: vaults,
                        [STORAGE_KEYS.SELECTED_VAULT_ID]: vaults[0].id,
                        [STORAGE_KEYS.DIRTY]: true,
                    });

                    notifyStateChanged('auth-imported', { selectedId: vaults[0].id });

                    sendResponse({
                        ok: true,
                        principal: principal.toText(),
                        selectedId: vaults[0].id,
                        vaults,
                    });
                    break;
                }

                case 'gk-reveal-seed': {
                    // Dev-only: in production, decrypt under user consent instead of plaintext
                    const bag = await getStorage(STORAGE_KEYS.SEED_PHRASE);
                    const nullSeed = bag[STORAGE_KEYS.SEED_PHRASE];
                    if (!nullSeed) {
                        sendResponse({ ok: false, error: 'No seed stored' });
                        break;
                    }
                    sendResponse({ ok: true, seed: nullSeed });
                    break;
                }

                case 'gk-signout': {
                    await chrome.storage.local.remove(Object.values(STORAGE_KEYS));
                    notifyStateChanged('signed-out');
                    sendResponse({ ok: true });
                    break;
                }

                // ─────────────── APP STATE / VAULT SELECTION ───────────────
                case 'gk-get-app-state': {
                    const state = await getAppState();
                    sendResponse({ ok: true, state });
                    break;
                }

                case 'gk-list-vaults': {
                    const bag = await getStorage([STORAGE_KEYS.VAULTS, STORAGE_KEYS.SELECTED_VAULT_ID]);
                    const vaults = bag[STORAGE_KEYS.VAULTS] || [];
                    const selectedId = bag[STORAGE_KEYS.SELECTED_VAULT_ID] || null;
                    sendResponse({ ok: true, vaults, selectedId });
                    break;
                }

                case 'gk-select-vault': {
                    const id = msg.vaultId;
                    await setStorage({ [STORAGE_KEYS.SELECTED_VAULT_ID]: id });
                    notifyStateChanged('vault-selected', { selectedId: id });
                    sendResponse({ ok: true });
                    break;
                }

                case 'gk-set-selected-vault': {
                    const { id } = msg;
                    const bag = await getStorage(STORAGE_KEYS.VAULTS);
                    const vaults = bag[STORAGE_KEYS.VAULTS] || [];
                    const exists = Array.isArray(vaults) && vaults.find((v) => v.id === id);
                    if (!exists) {
                        sendResponse({ ok: false, error: 'Vault not found' });
                        break;
                    }
                    await setStorage({ [STORAGE_KEYS.SELECTED_VAULT_ID]: id });
                    sendResponse({ ok: true });
                    break;
                }

                // ─────────────── CREDS LOOKUP / MUTATION ───────────────
                case 'gk-get-creds-for-host': {
                    const creds = await getCredentialsForHost(msg.host, msg.href);
                    sendResponse({ ok: true, creds });
                    break;
                }

                case 'gk-add-credential': {
                    const { domain, username, password } = msg;
                    if (!domain || !username || !password) {
                        sendResponse({ ok: false, error: 'Missing domain/username/password' });
                        break;
                    }

                    const bag = await getStorage([STORAGE_KEYS.VAULTS, STORAGE_KEYS.SELECTED_VAULT_ID]);
                    const vaults = bag[STORAGE_KEYS.VAULTS] || [];
                    const id = bag[STORAGE_KEYS.SELECTED_VAULT_ID] || null;

                    if (!id) {
                        sendResponse({ ok: false, error: 'No vault selected' });
                        break;
                    }
                    const i = vaults.findIndex((v) => v.id === id);
                    if (i < 0) {
                        sendResponse({ ok: false, error: 'Selected vault not found' });
                        break;
                    }

                    const v = vaults[i];
                    v.entries = Array.isArray(v.entries) ? v.entries : [];
                    const dup = v.entries.find(
                        (e) =>
                            (e.domain || '').toLowerCase() === String(domain).toLowerCase() &&
                            (e.username || '').toLowerCase() === String(username).toLowerCase()
                    );

                    if (!dup) {
                        v.entries.push({ domain, username, password });
                        vaults[i] = v;
                        await setStorage({ [STORAGE_KEYS.VAULTS]: vaults });
                        notifyStateChanged('entry-added', { vaultId: id });
                    }

                    sendResponse({ ok: true, added: !dup, entry: { domain, username } });
                    break;
                }

                case 'gk-update-credential': {
                    const { domain, username, password } = msg;
                    if (!domain || !username || password == null) {
                        sendResponse({ ok: false, error: 'Missing domain/username/password' });
                        break;
                    }

                    const bag = await getStorage([STORAGE_KEYS.VAULTS, STORAGE_KEYS.SELECTED_VAULT_ID]);
                    const vaults = bag[STORAGE_KEYS.VAULTS] || [];
                    const id = bag[STORAGE_KEYS.SELECTED_VAULT_ID] || null;

                    if (!id) {
                        sendResponse({ ok: false, error: 'No vault selected' });
                        break;
                    }
                    const v = vaults.find((x) => x.id === id);
                    if (!v) {
                        sendResponse({ ok: false, error: 'Selected vault not found' });
                        break;
                    }

                    const domainLc = String(domain).toLowerCase();
                    const userLc = String(username).toLowerCase();
                    const e = (v.entries || []).find(
                        (en) =>
                            String(en.domain || '').toLowerCase() === domainLc &&
                            String(en.username || '').toLowerCase() === userLc
                    );
                    if (!e) {
                        sendResponse({ ok: false, error: 'Entry not found' });
                        break;
                    }

                    e.password = String(password);
                    await setStorage({ [STORAGE_KEYS.VAULTS]: vaults });
                    await setDirty(true); // future auto-sync can use this flag
                    notifyStateChanged('entry-updated', { vaultId: id });
                    sendResponse({ ok: true });
                    break;
                }

                // ─────────────── SAVE STAGING (content.js) ───────────────
                case 'gk-propose-save': {
                    const { domain, username, password } = msg;
                    const ts = Date.now();
                    const store = chrome.storage.session ?? chrome.storage.local; // session if available
                    await store.set({ [STORAGE_KEYS.PENDING_CANDIDATE]: { domain, username, password, ts } });
                    sendResponse({ ok: true });
                    break;
                }

                case 'gk-get-pending-candidate': {
                    const store = chrome.storage.session ?? chrome.storage.local;
                    const bag = await store.get(STORAGE_KEYS.PENDING_CANDIDATE);
                    const cand = bag[STORAGE_KEYS.PENDING_CANDIDATE] || null;
                    const fresh = cand && Date.now() - (cand.ts || 0) < 5 * 60 * 1000 ? cand : null; // 5-min TTL
                    sendResponse({ ok: true, cand: fresh });
                    break;
                }

                case 'gk-clear-pending': {
                    const store = chrome.storage.session ?? chrome.storage.local;
                    await store.remove(STORAGE_KEYS.PENDING_CANDIDATE);
                    sendResponse({ ok: true });
                    break;
                }

                // ─────────────── UTIL / HOUSEKEEPING ───────────────
                case 'gk-clear-all': {
                    await chrome.storage.local.clear();
                    sendResponse({ ok: true });
                    break;
                }

                case 'gk-ping': {
                    sendResponse({ ok: true, now: Date.now() });
                    break;
                }

                default:
                    sendResponse({ ok: false, error: 'Unknown message type' });
            }
        } catch (e) {
            console.error('[GK] background error:', e);
            sendResponse({ ok: false, error: String(e?.message || e) });
        }
    })();
    return true; // keep the message channel open for async
});

// ──────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks
// ──────────────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
    // Reserved for future migrations / context setup
    console.log('[GhostKeys] background installed');
});

// ──────────────────────────────────────────────────────────────────────────────
// App-state helpers
// ──────────────────────────────────────────────────────────────────────────────

/** @returns {Promise<{principal:string|null, vaults:Array, selectedId:string|null, dirty:boolean, lastSyncedAt:number|null, maxVaults:number}>} */
async function getAppState() {
    const obj = await getStorage(Object.values(STORAGE_KEYS));
    const gk_principal_text = obj[STORAGE_KEYS.PRINCIPAL_TEXT];
    const gk_vaults = obj[STORAGE_KEYS.VAULTS];
    const gk_selected_vault_id = obj[STORAGE_KEYS.SELECTED_VAULT_ID];
    const gk_dirty = obj[STORAGE_KEYS.DIRTY];
    const gk_last_synced_at = obj[STORAGE_KEYS.LAST_SYNCED_AT];

    const vaults = Array.isArray(gk_vaults) ? gk_vaults : [];
    const selectedId =
        vaults.find((v) => v.id === gk_selected_vault_id)?.id || vaults[0]?.id || null;

    if (selectedId && gk_selected_vault_id !== selectedId) {
        await setStorage({ [STORAGE_KEYS.SELECTED_VAULT_ID]: selectedId });
    }

    return {
        principal: gk_principal_text || null,
        vaults,
        selectedId,
        dirty: !!gk_dirty,
        lastSyncedAt: gk_last_synced_at || null,
        maxVaults: 3,
    };
}

/** @param {boolean} flag */
async function setDirty(flag = true) {
    await setStorage({ [STORAGE_KEYS.DIRTY]: !!flag });
}