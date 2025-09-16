// src/popup.js — minimal popup UI
// - Auth: create/import identity, reveal seed, sign out
// - Vaults: selection only (no create/edit here)
// - Manage: opens main GhostKeys app in a trusted environment

'use strict';

/* ────────────────────────────────────────────────────────────────────────────
 * DOM refs & constants
 * ──────────────────────────────────────────────────────────────────────────── */

function qs(id) { return document.getElementById(id); }

const el = {
    principalPill: qs('principalPill'),
    authSec: qs('authSec'),
    vaultSec: qs('vaultSec'),
    sepVault: qs('sepVault'),
    manageSec: qs('manageSec'),
    cardRoot: qs('cardRoot'),
};

const MANAGE_URL = 'https://ghostkeys.com';

/** In-memory app snapshot reflected by render() */
let app = { principal: null, vaults: [], selectedId: null };

/* ────────────────────────────────────────────────────────────────────────────
 * Messaging
 * ──────────────────────────────────────────────────────────────────────────── */

/** Safe runtime messaging with lastError capture */
function sendMsg(type, payload = {}) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type, ...payload }, (resp) => {
            const err = chrome.runtime.lastError;
            if (err) {
                console.error('[GK] sendMessage error:', err);
                resolve({ ok: false, error: err.message });
            } else {
                resolve(resp);
            }
        });
    });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Render cycle
 * ──────────────────────────────────────────────────────────────────────────── */

async function refresh() {
    const s = await sendMsg('gk-get-app-state');
    if (s?.ok) app = s.state;
    render();
}

function render() {
    const authed = !!app.principal;

    // Card + layout state
    el.cardRoot.classList.toggle('unauth', !authed);
    el.authSec.classList.toggle('auth-center', !authed);

    // Header pill
    el.principalPill.textContent = authed ? trimMid(app.principal, 40) : 'Not signed in';
    el.principalPill.className = 'pill ' + (authed ? 'ok' : '');

    // Auth section
    el.authSec.innerHTML = '';
    el.authSec.appendChild(renderAuthSection());

    // Vaults section (auth only)
    el.vaultSec.style.display = authed ? '' : 'none';
    el.sepVault.style.display = authed ? '' : 'none';
    el.vaultSec.innerHTML = '';
    if (authed) el.vaultSec.appendChild(renderVaultsSection());

    // Manage section (auth only)
    el.manageSec.style.display = authed ? '' : 'none';
    el.manageSec.innerHTML = '';
    if (authed) el.manageSec.appendChild(renderManageSection());
}

/* ────────────────────────────────────────────────────────────────────────────
 * Section renderers
 * ──────────────────────────────────────────────────────────────────────────── */

function renderWelcome() {
    const root = div('welcome');

    const ghost = document.createElement('div');
    ghost.className = 'ghostWrap';
    ghost.innerHTML = `
    <svg class="ghostSVG" viewBox="0 0 160 160" aria-hidden="true" role="img">
      <defs>
        <linearGradient id="gGlow" x1="0" x2="1">
          <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#a78bfa" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <path d="M80 18c-26 0-46 19-46 46v38c0 7 6 10 11 7 7-4 12-4 19 0 6 4 13 4 19 0 7-4 12-4 19 0 6 4 12 4 19 0 5-3 11 0 11-7V64c0-27-20-46-46-46z" fill="url(#gGlow)" opacity="0.22"/>
      <path d="M80 24c-23 0-41 17-41 40v35c0 3 3 5 6 3 8-5 15-5 23 0 7 4 16 4 23 0 8-5 15-5 23 0 3 2 6 0 6-3V64c0-23-18-40-40-40z" fill="#e5e7eb"/>
      <circle cx="62" cy="68" r="5" fill="#0b1320"/>
      <circle cx="98" cy="68" r="5" fill="#0b1320"/>
      <path d="M68 86c8 6 16 6 24 0" stroke="#0b1320" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>
    <div class="halo"></div>
  `;

    const title = document.createElement('div');
    title.className = 'welcomeTitle';
    title.textContent = 'Welcome to GhostKeys';

    const sub = document.createElement('div');
    sub.className = 'welcomeSub';
    sub.textContent = 'Secure your logins. Sync to ICP when ready.';

    root.append(ghost, title, sub);
    return root;
}

function renderAuthSection() {
    const root = div();

    if (!app.principal) {
        const buttons = divRow(
            btn('Create Identity', onCreateIdentity),
            btnGhost('Import Seed', showImportSeedModal)
        );
        buttons.classList.add('mt8', 'auth-actions');

        root.append(renderWelcome(), buttons);
        return root;
    }

    // Authenticated
    const left = document.createElement('div');
    left.className = 'title-sec';
    left.textContent = 'Account';

    const actions = divRow(
        btnGhost('Reveal Seed', onRevealSeed),
        btn('Sign out', onSignOut, 'danger')
    );

    const head = div('between');
    head.append(left, actions);

    root.append(head, p('You are signed in as:'), codeRow(app.principal));
    return root;
}

function renderVaultsSection() {
    const root = div();
    root.append(h2('Vaults'));

    if (!app.principal) {
        root.append(pMuted('Sign in to manage vaults.'));
        return root;
    }

    // Selector only (no create here)
    const row = divRow();
    row.classList.add('vault-row');

    const select = document.createElement('select');
    select.className = 'input';

    app.vaults.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        if (v.id === app.selectedId) opt.selected = true;
        select.appendChild(opt);
    });

    select.addEventListener('change', async () => {
        const res = await sendMsg('gk-set-selected-vault', { id: select.value });
        if (res?.ok) await refresh();
    });

    row.append(select);
    root.append(row);
    return root;
}

function renderManageSection() {
    const root = div();

    const btnOpen = btn('Manage data in a trusted environment', async () => {
        try {
            await chrome.tabs.create({ url: MANAGE_URL });
        } catch {
            window.open(MANAGE_URL, '_blank');
        }
    });
    btnOpen.style.width = '100%';

    const note = pMuted('Opens the GhostKeys app to manage vaults and credentials.');
    note.classList.add('mt8', 'center');

    root.append(btnOpen, note);
    return root;
}

/* ────────────────────────────────────────────────────────────────────────────
 * UI helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function div(cls = '') { const d = document.createElement('div'); if (cls) d.className = cls; return d; }
function h2(t) { const d = div('title'); d.textContent = t; return d; }
function p(t) { const d = document.createElement('div'); d.textContent = t; return d; }
function pMuted(t) { const d = p(t); d.className = 'muted'; return d; }
function sep() { const s = document.createElement('div'); s.className = 'sep'; return s; }
function divRow(...children) { const r = div('row'); children.forEach((c) => r.append(c)); return r; }
function divBetween(...children) { const r = div('between'); children.forEach((c) => r.append(c)); return r; }
function btn(text, onClick, extra = '') { const b = document.createElement('button'); b.className = 'btn' + (extra ? ' ' + extra : ''); b.textContent = text; b.addEventListener('click', onClick); return b; }
function btnGhost(text, onClick, extra = '') { const b = btn(text, onClick, 'ghost'); if (extra) b.className += ' ' + extra; return b; }
function codeRow(text) { const d = document.createElement('div'); d.className = 'muted'; d.style.userSelect = 'text'; d.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'; d.textContent = text; return d; }
function trimMid(s, n = 16) { if (!s) return ''; if (s.length <= n) return s; const k = Math.floor((n - 3) / 2); return `${s.slice(0, k)}…${s.slice(-k)}`; }

/* ────────────────────────────────────────────────────────────────────────────
 * Modals
 * ──────────────────────────────────────────────────────────────────────────── */

function showModal(title, contentEl, actions = []) {
    const back = div('modal-backdrop');
    const modal = div('modal');
    const head = divBetween(h2(title), btnGhost('Close', close));
    const body = div(); body.style.marginTop = '6px'; body.append(contentEl);
    const foot = div('right'); foot.style.marginTop = '10px';
    actions.forEach((a) => foot.append(a));
    modal.append(head, body, foot);
    back.append(modal);
    document.body.append(back);
    function close() { back.remove(); }
    return { close, root: back };
}

function showImportSeedModal() {
    const ta = document.createElement('textarea');
    ta.className = 'input';
    ta.rows = 4;
    ta.placeholder = 'Enter your seed phrase';

    const warning = p('The seed will be processed locally to derive your identity. It is never shown unless you explicitly reveal it.');
    warning.className = 'muted';

    const c = div();
    c.append(ta, sep(), warning);

    const importBtn = btn('Import', async () => {
        try {
            importBtn.disabled = true;
            const seedPhrase = (ta.value || '').trim();

            const res = await sendMsg('gk-import-seed', { seedPhrase });
            if (!res || !res.ok) {
                alert('Error: ' + (res?.error || 'No response from background'));
                return;
            }
            m.close();
            await refresh();
        } catch (e) {
            console.error('[GK] import error:', e);
            alert('Error: ' + (e?.message || e));
        } finally {
            importBtn.disabled = false;
        }
    });

    const m = showModal('Import seed', c, [importBtn]);
}

function onRevealSeed() {
    const info = div();
    info.innerHTML = `
    <div class="danger-text" style="font-weight:700;margin-bottom:6px;">Warning</div>
    Revealing your seed exposes full account control. Do this only in a private, trusted environment.
    <div class="muted" style="margin-top:6px;">Type <b>REVEAL</b> to confirm.</div>
  `;

    const input = document.createElement('input');
    input.className = 'input';
    input.placeholder = 'REVEAL';

    const out = codeRow('');
    out.style.marginTop = '8px';

    const ok = btn('Reveal', async () => {
        if (input.value.trim() !== 'REVEAL') return alert('Please type REVEAL');
        const res = await sendMsg('gk-reveal-seed');
        out.textContent = (res?.ok && res.seed) ? res.seed : 'Unavailable';
    }, 'danger');

    const c = div();
    c.append(info, sep(), input, out);
    showModal('Reveal seed', c, [ok]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Actions
 * ──────────────────────────────────────────────────────────────────────────── */

async function onCreateIdentity() {
    const res = await sendMsg('gk-generate-identity');
    if (!res?.ok) return alert('Error: ' + (res?.error || 'Unknown'));
    await refresh();
}

async function onSignOut() {
    const ok = confirm('Sign out and clear local identity?');
    if (!ok) return;
    const res = await sendMsg('gk-signout');
    if (res?.ok) await refresh();
}

/* ────────────────────────────────────────────────────────────────────────────
 * Background change listeners
 * ──────────────────────────────────────────────────────────────────────────── */

function debounce(fn, wait = 120) {
    let t = 0;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
const debouncedRefresh = debounce(refresh, 100);

// Broadcasts from background
chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'gk-app-state-updated') debouncedRefresh();
});

// Fallback: storage changes (e.g., SW sleep/wake)
chrome.storage.onChanged.addEventListener?.call
    ? chrome.storage.onChanged.addEventListener((changes, area) => {
        if (area !== 'local') return;
        if (Object.keys(changes).some((k) => k.startsWith('gk_'))) debouncedRefresh();
    })
    : chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (Object.keys(changes).some((k) => k.startsWith('gk_'))) debouncedRefresh();
    });

/* ────────────────────────────────────────────────────────────────────────────
 * Initial paint
 * ──────────────────────────────────────────────────────────────────────────── */

refresh();
