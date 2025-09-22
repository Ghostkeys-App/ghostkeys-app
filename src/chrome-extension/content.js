// content.js — autofill surface + save/update suggestion UI
// - Shows mini key button on focused auth fields when creds exist
// - Offers "Save credentials" after successful login/redirect
// - Offers "Update password" when same username has a different password

'use strict';

/* ────────────────────────────────────────────────────────────────────────────
 * Constants & state
 * ──────────────────────────────────────────────────────────────────────────── */

const GK = {
    ATTRS: {
        filled: 'data-gk-filled',
        overlayHost: 'data-gk-overlay-host',
    },
};

let credsCache = null;                 // last fetched creds for current host
let overlayRoot = null;                // chooser overlay host
let anchorEl = null;                   // focused input anchoring mini button / chooser
let repositionHandlersBound = false;   // guards scroll/resize attachment
let miniRoot = null;                   // inline key button host
let saveBarRoot = null;                // save/update suggestion bar host

/* ────────────────────────────────────────────────────────────────────────────
 * Boot
 * ──────────────────────────────────────────────────────────────────────────── */

init().catch(console.error);

async function init() {
    const host = location.host;
    const { ok, creds } = await sendMsg('gk-get-creds-for-host', { host, href: location.href });
    if (!ok) return;
    credsCache = creds || [];

    // Show chooser on focus (only) + catch initial autofocus/hydration
    attachFocusHandlers();
    ensureInitialFocusTrigger();

    // Capture submits / Enter to stage a candidate; then propose Save/Update
    attachSaveCaptureHandlers();
    checkPendingSaveSuggestion();

    // Keep in sync with background changes (vault switch, add/update, auth)
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'gk-app-state-updated') refreshCredsForHost();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && Object.keys(changes).some((k) => k.startsWith('gk_'))) {
            refreshCredsForHost();
        }
    });
}

async function refreshCredsForHost() {
    const host = location.host;
    const { ok, creds } = await sendMsg('gk-get-creds-for-host', { host, href: location.href });
    if (!ok) return;

    const hadNone = !credsCache || credsCache.length === 0;
    credsCache = Array.isArray(creds) ? creds : [];

    // If we just acquired creds and a field is focused, surface the mini trigger
    if (hadNone && credsCache.length) {
        const el = getDeepActiveElement();
        if (el && (isUserField(el) || isPassField(el)) && isVisibleEnabled(el)) {
            anchorEl = el;
            showMiniTrigger(el);
        }
    }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Messaging helper
 * ──────────────────────────────────────────────────────────────────────────── */

function sendMsg(type, payload = {}) {
    return new Promise((resolve) => chrome.runtime.sendMessage({ type, ...payload }, resolve));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Field detection & fill helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Follow activeElement through shadow roots. */
function getDeepActiveElement(root = document) {
    let a = root.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
}

function isUserField(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.type || '').toLowerCase();
    const name = (el.name || '').toLowerCase();
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (type === 'email') return true;
    if (ac.includes('username') || ac.includes('email')) return true;
    if (type === 'text' && /user|login|email/i.test(name)) return true;
    return false;
}

function isPassField(el) {
    return el instanceof HTMLInputElement && (el.type || '').toLowerCase() === 'password';
}

function isVisibleEnabled(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || el.disabled) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function markFilled() {
    document.documentElement.setAttribute(GK.ATTRS.filled, '1');
}

function fill(input, value) {
    if (!input) return;
    if (input.isContentEditable) {
        input.textContent = value;
    } else {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function findPasswordInput(root = document) {
    const candidates = Array.from(root.querySelectorAll('input[type="password"]')).filter(
        isVisibleEnabled
    );
    return candidates[0] || null;
}

function findAnyUsernameInput(root = document) {
    const selectors = [
        'input[autocomplete="username"]',
        'input[type="email"]',
        'input[name*="user" i]',
        'input[name*="login" i]',
        'input[name*="email" i]',
        'input[type="text"]',
    ];
    for (const sel of selectors) {
        const node = Array.from(root.querySelectorAll(sel)).find(isVisibleEnabled);
        if (node) return node;
    }
    return null;
}

function getInputValue(el) {
    if (!el) return '';
    return el.isContentEditable ? (el.textContent || '').trim() : (el.value || '').trim();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>\"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[c]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Focus/initial trigger
 * ──────────────────────────────────────────────────────────────────────────── */

function attachFocusHandlers() {
    // Capture phase to catch focus even through shadow hosts
    document.addEventListener('focusin', onFocusIn, true);
}

function onFocusIn(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!isUserField(t) && !isPassField(t)) return;
    if (!credsCache || credsCache.length === 0) return;

    // If trigger already shown for this field, just reposition
    if (miniRoot && anchorEl === t) {
        positionMiniNear(t);
        return;
    }

    anchorEl = t;
    showMiniTrigger(anchorEl);
}

function ensureInitialFocusTrigger() {
    const hasCreds = !!(credsCache && credsCache.length);

    // Try immediately…
    const first = getDeepActiveElement();
    if (first && (isUserField(first) || isPassField(first)) && isVisibleEnabled(first)) {
        if (hasCreds) {
            anchorEl = first;
            showMiniTrigger(first);
            return;
        }
    }

    // …then poll briefly to catch late autofocus/hydration
    const maxMs = 1500;
    const stepMs = 50;
    const deadline = Date.now() + maxMs;

    const timer = setInterval(() => {
        const el = getDeepActiveElement();
        if (el && (isUserField(el) || isPassField(el)) && isVisibleEnabled(el)) {
            clearInterval(timer);
            if (hasCreds) {
                anchorEl = el;
                showMiniTrigger(el);
            }
        } else if (Date.now() > deadline) {
            clearInterval(timer);
        }
    }, stepMs);

    // BFCache back/forward restores where focus returns silently
    window.addEventListener(
        'pageshow',
        () => {
            const el2 = getDeepActiveElement();
            if (el2 && (isUserField(el2) || isPassField(el2)) && isVisibleEnabled(el2)) {
                if (hasCreds) {
                    anchorEl = el2;
                    showMiniTrigger(el2);
                }
            }
        },
        { once: true }
    );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Chooser overlay (Shadow DOM)
 * ──────────────────────────────────────────────────────────────────────────── */

function showChooser(creds, onPick, { anchor } = {}) {
    if (!Array.isArray(creds) || creds.length === 0) return;
    destroyChooser();

    const host = document.createElement('div');
    host.setAttribute(GK.ATTRS.overlayHost, '');
    Object.assign(host.style, { position: 'fixed', zIndex: 2147483647, top: '0px', left: '0px' });

    const shadow = host.attachShadow({ mode: 'open' });
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <style>
      .card { font: 13px/1.4 system-ui,-apple-system, Segoe UI, Roboto, sans-serif; background:#0b1320; color:#e5e7eb; border:1px solid #334155; border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,.35); min-width: 260px; max-width: 360px; }
      .hdr { padding:10px 12px; border-bottom:1px solid #1f2937; font-weight:600; }
      .list { max-height: 260px; overflow:auto; }
      .row { padding: 10px 12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; }
      .row:hover { background:#111827; }
      .user { font-weight:500; }
      .dom { opacity:.7; font-size:12px; margin-left:12px; }
    </style>
    <div class="card">
      <div class="hdr">GhostKeys — Choose account</div>
      <div class="list"></div>
    </div>
  `;
    const list = wrap.querySelector('.list');
    creds.forEach((c) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<span class="user">${escapeHtml(c.username)}</span><span class="dom">${escapeHtml(c.domain)}</span>`;
        row.addEventListener('click', () => {
            onPick(c);
            destroyChooser();
        });
        list.appendChild(row);
    });
    shadow.appendChild(wrap);

    document.documentElement.appendChild(host);
    overlayRoot = host;

    // Position after render
    requestAnimationFrame(() => positionOverlayNear(anchor));

    bindRepositionHandlers();
    bindDismissHandlers();
}

function positionOverlayNear(anchor) {
    if (!overlayRoot || !overlayRoot.isConnected || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const pad = 6;
    const top = Math.round(rect.bottom + pad);
    let left = Math.round(rect.left);

    // Clamp horizontally using measured card width
    const shadow = overlayRoot.shadowRoot;
    const card = shadow && shadow.querySelector('.card');
    const vw = window.innerWidth;
    const cardW = Math.min(card ? card.getBoundingClientRect().width : 280, 380);
    if (left + cardW + 8 > vw) left = Math.max(8, vw - cardW - 8);
    if (left < 8) left = 8;

    overlayRoot.style.top = `${top}px`;
    overlayRoot.style.left = `${left}px`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mini key trigger
 * ──────────────────────────────────────────────────────────────────────────── */

function showMiniTrigger(anchor) {
    destroyMiniTrigger();

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.top = '0px';
    host.style.left = '0px';
    host.style.pointerEvents = 'none'; // host ignores events; button handles them
    const shadow = host.attachShadow({ mode: 'open' });

    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <style>
      .btn {
        pointer-events: auto;
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px; border-radius: 14px;
        background: #0f172a; color: #e5e7eb; border: 1px solid #334155;
        box-shadow: 0 2px 10px rgba(0,0,0,.25);
        cursor: pointer; user-select: none;
      }
      .btn:hover { background: #111827; }
      .icon { width: 16px; height: 16px; display: block; }
    </style>
    <button class="btn" title="GhostKeys (click to fill)">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 14a5 5 0 1 1 3.9 4.9l-.4-.1-.7.7H8v-1.8l1.1-1.1-.1-.4A4.99 4.99 0 0 1 7 14zm5-3a3 3 0 1 0 0 6
        3 3 0 0 0 0-6zM20 7h-3V5h3a1 1 0 1 1 0 2zM16 5h-1V4a1 1 0 1 1 2 0v1h-1z"/>
      </svg>
    </button>
  `;
    shadow.appendChild(wrap);

    document.documentElement.appendChild(host);
    miniRoot = host;

    // Position after render
    requestAnimationFrame(() => positionMiniNear(anchor));

    // Clicking the key opens the chooser anchored to this field
    const btn = shadow.querySelector('.btn');
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (!credsCache || credsCache.length === 0) return;

        showChooser(
            credsCache,
            (chosen) => {
                if (!chosen) return;
                const scope = anchorEl?.form || anchorEl?.closest('form') || document;
                const user = isUserField(anchorEl) ? anchorEl : findAnyUsernameInput(scope);
                const pass = isPassField(anchorEl) ? anchorEl : findPasswordInput(scope);
                if (user && chosen.username != null) fill(user, chosen.username);
                if (pass && chosen.password != null) fill(pass, chosen.password);
            },
            { anchor: anchorEl }
        );
    });

    bindRepositionHandlers();
    bindMiniDismissHandlers();
}

function positionMiniNear(anchor) {
    if (!miniRoot || !miniRoot.isConnected || !anchor) return;

    const rect = anchor.getBoundingClientRect();
    const size = 28;
    const top = Math.round(rect.top + (rect.height - size) / 2);
    let left = Math.round(rect.right - size - 4); // slight inset

    // keep within viewport
    const vw = window.innerWidth;
    if (left + size + 8 > vw) left = Math.max(8, vw - size - 8);
    if (left < 8) left = 8;

    miniRoot.style.top = `${Math.max(8, top)}px`;
    miniRoot.style.left = `${left}px`;
}

function destroyMiniTrigger() {
    if (miniRoot && miniRoot.isConnected) miniRoot.remove();
    miniRoot = null;
}

function bindMiniDismissHandlers() {
    const onDocClick = (e) => {
        if (!miniRoot) return;
        const path = e.composedPath ? e.composedPath() : [];
        if (path.includes(miniRoot)) return; // click on button → ignore
        if (anchorEl && path.includes(anchorEl)) return; // click in field → keep
        destroyMiniTrigger();
    };
    const onKey = (e) => {
        if (e.key === 'Escape') destroyMiniTrigger();
    };
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('touchstart', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Save staging (submit/Enter) and pending suggestion handling
 * ──────────────────────────────────────────────────────────────────────────── */

function attachSaveCaptureHandlers() {
    // Capture native form submits early
    document.addEventListener(
        'submit',
        (e) => {
            tryStageCandidateFromScope(e.target);
        },
        true
    );

    // Fallback: Enter pressed in a password input (many sites login via JS)
    document.addEventListener(
        'keydown',
        (e) => {
            if (e.key !== 'Enter') return;
            const t = e.target;
            if (!(t instanceof Element)) return;
            if (!isPassField(t)) return;
            const scope = t.form || t.closest('form') || document;
            tryStageCandidateFromScope(scope);
        },
        true
    );
}

function tryStageCandidateFromScope(scope) {
    const user = findAnyUsernameInput(scope || document);
    const pass = findPasswordInput(scope || document);
    const username = getInputValue(user);
    const password = getInputValue(pass);
    if (!username || !password) return;

    // Avoid staging if this exact domain+username already exists in cache
    const exists = !!(credsCache || []).find(
        (c) =>
            (c.domain || '').toLowerCase() === location.hostname.toLowerCase() &&
            (c.username || '').toLowerCase() === username.toLowerCase()
    );
    if (exists) return;

    sendMsg('gk-propose-save', {
        domain: location.hostname,
        username,
        password,
    });
}

async function checkPendingSaveSuggestion() {
    const res = await sendMsg('gk-get-pending-candidate');
    const cand = res?.cand;
    if (!cand) return;

    const candDomainLc = (cand.domain || '').toLowerCase();
    const hereHostLc = (location.hostname || '').toLowerCase();

    // Show on same host or if we arrived from that host (redirect case)
    const sameHost = hereHostLc === candDomainLc;
    const fromHost =
        document.referrer && document.referrer.toLowerCase().includes(candDomainLc);
    if (!sameHost && !fromHost) {
        await sendMsg('gk-clear-pending');
        return;
    }

    // Always fetch fresh creds for the candidate domain
    let credsForCand = [];
    const lookup = await sendMsg('gk-get-creds-for-host', {
        host: cand.domain,
        href: `https://${cand.domain}/`,
    });
    if (lookup?.ok) credsForCand = Array.isArray(lookup.creds) ? lookup.creds : [];

    const candUserLc = (cand.username || '').toLowerCase();
    const domainEntries = credsForCand.filter(
        (c) => (c.domain || '').toLowerCase() === candDomainLc
    );
    const exact = domainEntries.find(
        (c) => (c.username || '').toLowerCase() === candUserLc
    );

    if (exact) {
        // same username; show Update if password changed
        if (String(exact.password || '') !== String(cand.password || '')) {
            showUpdateBarPassword(exact, cand);
            return;
        }
        // identical → nothing to do
        await sendMsg('gk-clear-pending');
        return;
    }

    // no username match → show existing Save-new bar
    showSaveBar(cand);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Suggestion bars (Save new / Update password)
 * ──────────────────────────────────────────────────────────────────────────── */

function showSaveBar(cand) {
    destroySaveBar();

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.right = '12px';
    container.style.top = '12px';
    container.style.zIndex = '2147483647';

    const shadow = container.attachShadow({ mode: 'open' });
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <style>
      .bar {
        font: 13px/1.45 system-ui,-apple-system, Segoe UI, Roboto, sans-serif;
        background:#0f172a; color:#e5e7eb; border:1px solid #334155;
        border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,.35);
        padding:10px; min-width:260px; max-width:340px;
      }
      .row { display:flex; gap:8px; align-items:center; justify-content:space-between; }
      .txt { margin-right:8px; }
      .dom { opacity:.75; }
      .btn { background:#2563eb; color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; font-weight:700; }
      .ghost { background:#111827; color:#cbd5e1; margin-right:6px; }
    </style>
    <div class="bar">
      <div class="row">
        <div class="txt">
          Save credentials for <span class="dom">${escapeHtml(cand.domain)}</span>?
          <div style="opacity:.8;font-size:12px;margin-top:2px;">${escapeHtml(cand.username)}</div>
        </div>
        <div>
          <button class="btn ghost" id="dismiss">Not now</button>
          <button class="btn" id="save">Save</button>
        </div>
      </div>
    </div>
  `;
    shadow.appendChild(wrap);
    document.documentElement.appendChild(container);
    saveBarRoot = container;

    shadow.getElementById('save').addEventListener('click', async () => {
        const res = await sendMsg('gk-add-credential', {
            domain: cand.domain,
            username: cand.username,
            password: cand.password,
        });
        await sendMsg('gk-clear-pending');

        if (res?.ok) {
            // update in-memory cache so chooser works immediately
            credsCache = Array.isArray(credsCache) ? credsCache : [];
            if (!credsCache.some((c) => c.domain === cand.domain && c.username === cand.username)) {
                credsCache.push({
                    domain: cand.domain,
                    username: cand.username,
                    password: cand.password,
                });
            }
        }
        destroySaveBar();
    });

    shadow.getElementById('dismiss').addEventListener('click', async () => {
        await sendMsg('gk-clear-pending');
        destroySaveBar();
    });
}

function showUpdateBarPassword(oldEntry, cand) {
    destroySaveBar();

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.right = '12px';
    container.style.top = '12px';
    container.style.zIndex = '2147483647';

    const shadow = container.attachShadow({ mode: 'open' });
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <style>
      .bar {
        font: 13px/1.45 system-ui,-apple-system, Segoe UI, Roboto, sans-serif;
        background:#0f172a; color:#e5e7eb; border:1px solid #334155;
        border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,.35);
        padding:10px; min-width:260px; max-width:340px;
      }
      .row { display:flex; gap:8px; align-items:center; justify-content:space-between; }
      .txt { margin-right:8px; }
      .dom { opacity:.75; }
      .btn { background:#2563eb; color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; font-weight:700; }
      .ghost { background:#111827; color:#cbd5e1; margin-right:6px; }
    </style>
    <div class="bar">
      <div class="row">
        <div class="txt">
          Update password for <span class="dom">${escapeHtml(cand.domain)}</span>?
          <div style="opacity:.8;font-size:12px;margin-top:2px;">${escapeHtml(cand.username)}</div>
        </div>
        <div>
          <button class="btn ghost" id="dismiss">Not now</button>
          <button class="btn" id="update">Update</button>
        </div>
      </div>
    </div>
  `;
    shadow.appendChild(wrap);
    document.documentElement.appendChild(container);
    saveBarRoot = container;

    shadow.getElementById('update').addEventListener('click', async () => {
        const res = await sendMsg('gk-update-credential', {
            domain: cand.domain,
            username: oldEntry.username, // entry to update
            password: cand.password,     // new password
        });
        await sendMsg('gk-clear-pending');

        if (res?.ok) {
            // update local cache immediately for chooser/autofill
            const idx = (credsCache || []).findIndex(
                (c) =>
                    (c.domain || '').toLowerCase() === (cand.domain || '').toLowerCase() &&
                    (c.username || '').toLowerCase() === (oldEntry.username || '').toLowerCase()
            );
            if (idx >= 0) credsCache[idx].password = cand.password;
        }
        destroySaveBar();
    });

    shadow.getElementById('dismiss').addEventListener('click', async () => {
        await sendMsg('gk-clear-pending');
        destroySaveBar();
    });
}

function destroySaveBar() {
    if (saveBarRoot && saveBarRoot.isConnected) saveBarRoot.remove();
    saveBarRoot = null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Positioning & dismissal plumbing
 * ──────────────────────────────────────────────────────────────────────────── */

function throttle(fn, delay = 200) {
    let last = 0,
        timer = null,
        lastArgs = null;
    return (...args) => {
        const now = Date.now();
        lastArgs = args;
        if (!last || now - last >= delay) {
            last = now;
            fn(...args);
        } else if (!timer) {
            timer = setTimeout(() => {
                timer = null;
                last = Date.now();
                fn(...lastArgs);
            }, delay - (now - last));
        }
    };
}

function bindRepositionHandlers() {
    if (repositionHandlersBound) return;
    const throttled = throttle(() => {
        positionOverlayNear(anchorEl);
        positionMiniNear(anchorEl);
    }, 100);
    window.addEventListener('scroll', throttled, true);
    window.addEventListener('resize', throttled, true);
    repositionHandlersBound = true;
}

function bindDismissHandlers() {
    const onDocClick = (e) => {
        if (!overlayRoot) return;
        const path = e.composedPath ? e.composedPath() : [];
        if (path.includes(overlayRoot)) return; // click inside overlay
        if (anchorEl && path.includes(anchorEl)) return; // clicking the field — keep open
        destroyChooser();
    };
    const onKey = (e) => {
        if (e.key === 'Escape') destroyChooser();
    };
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('touchstart', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
}

function destroyChooser() {
    if (overlayRoot && overlayRoot.isConnected) overlayRoot.remove();
    overlayRoot = null;
}
