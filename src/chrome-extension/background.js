// background.js — MV3 service worker
// Responsibilities:
// - Store seed + vaults (mocked) in chrome.storage
// - Handle messages from popup/content scripts
// - Return credentials for a given hostname

const STORAGE_KEYS = {
    SEED: 'gk_seed',
    VAULTS: 'gk_vaults',
    SELECTED_VAULT_ID: 'gk_selected_vault_id'
};

// —— Mocked Web3/ICP calls ——
async function mockFetchVaultsFromSeed(seedPhrase) {
// In real impl: derive keys client-side, auth with your canisters, fetch encrypted vaults, decrypt locally.
// Here we return two demo vaults with sample credentials.
    const demoVaults = [
        {
            id: 'vault_personal',
            name: 'Personal',
            entries: [
                { domain: 'accounts.google.com', username: 'nick.personal@gmail.com', password: 'DemoPass-1' },
                { domain: 'github.com', username: 'nick-personal', password: 'DemoPass-2' },
                { domain: 'github.com', username: 'nick-personal2', password: 'DemoPass-22' },
                { domain: 'signin.aws.amazon.com', username: 'nick.personal', password: 'DemoPass-3' },
                { domain: 'kissmyacid.art', username: 'nick.personal', password: 'DemoPass-3' },
                { domain: 'kissmyacid.art', username: 'nick.personal2', password: 'DemoPass-32' },
                { domain: 'dropbox.com', username: 'nick.personal@pm.me', password: 'DemoPass-4' },
                { domain: 'facebook.com', username: 'nick.personal', password: 'DemoPass-5' },
                { domain: 'x.com', username: 'nick_on_x', password: 'DemoPass-6' }
            ]
        },
        {
            id: 'vault_work',
            name: 'Work',
            entries: [
                { domain: 'accounts.google.com', username: 'nick@company.com', password: 'WorkPass-1' },
                { domain: 'github.com', username: 'nick-company', password: 'WorkPass-2' },
                { domain: 'signin.aws.amazon.com', username: 'nick.company', password: 'WorkPass-3' },
                { domain: 'dropbox.com', username: 'nick.company@org', password: 'WorkPass-4' }
            ]
        }
    ];
    await sleep(150); // simulate latency
    return demoVaults;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// —— Storage helpers ——
async function setStorage(obj) { return chrome.storage.local.set(obj); }
async function getStorage(keys) { return chrome.storage.local.get(keys); }

async function getSelectedVault() {
    const { [STORAGE_KEYS.SELECTED_VAULT_ID]: id, [STORAGE_KEYS.VAULTS]: vaults = [] } = await getStorage([STORAGE_KEYS.SELECTED_VAULT_ID, STORAGE_KEYS.VAULTS]);
    return vaults.find(v => v.id === id) || null;
}

function domainMatches(entryDomain, host, href) {
// Basic domain match: exact host or host endsWith entryDomain (to allow subdomains),
// plus a fallback that checks the full href for rare flows.
    const ed = (entryDomain || '').toLowerCase();
    const h = (host || '').toLowerCase();
    const u = (href || '').toLowerCase();
    if (!ed) return false;
    return h === ed || h.endsWith('.' + ed) || u.includes(ed);
}

async function getCredentialsForHost(host, href) {
    const vault = await getSelectedVault();
    if (!vault) return [];
    const creds = (vault.entries || []).filter(e => domainMatches(e.domain, host, href));
    // Optional: stable sort by username length to keep deterministic order
    creds.sort((a, b) => a.username.localeCompare(b.username));
    return creds;
}

// —— Message router ——
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        try {
            switch (msg?.type) {
                case 'gk-import-seed': {
                    const seed = (msg.seedPhrase || '').trim();
                    if (!seed) throw new Error('Empty seed phrase');
                    await setStorage({ [STORAGE_KEYS.SEED]: seed });
                    const vaults = await mockFetchVaultsFromSeed(seed);
                    await setStorage({ [STORAGE_KEYS.VAULTS]: vaults });
                    sendResponse({ ok: true, vaults });
                    break;
                }
                case 'gk-list-vaults': {
                    const { [STORAGE_KEYS.VAULTS]: vaults = [] } = await getStorage([STORAGE_KEYS.VAULTS]);
                    const { [STORAGE_KEYS.SELECTED_VAULT_ID]: selectedId = null } = await getStorage([STORAGE_KEYS.SELECTED_VAULT_ID]);
                    sendResponse({ ok: true, vaults, selectedId });
                    break;
                }
                case 'gk-select-vault': {
                    const id = msg.vaultId;
                    await setStorage({ [STORAGE_KEYS.SELECTED_VAULT_ID]: id });
                    sendResponse({ ok: true });
                    break;
                }
                case 'gk-get-creds-for-host': {
                    const creds = await getCredentialsForHost(msg.host, msg.href);
                    sendResponse({ ok: true, creds });
                    break;
                }
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
            sendResponse({ ok: false, error: String(e?.message || e) });
        }
    })();
    return true; // keep the message channel open for async
});

chrome.runtime.onInstalled.addListener(() => {
// Reserved for future migrations / context setup
    console.log('[GhostKeys] background installed');
});