// // content.js — lean observer (observes less + throttles smarter)
// // - Debounce: 500ms
// // - Only reacts to auth-relevant DOM changes (forms/inputs/attrs)
// // - No dismissal / no extra guards
//
// const GK = {
//     ATTRS: {
//         filled: 'data-gk-filled',
//         overlayHost: 'data-gk-overlay-host'
//     }
// };
//
// let lastTriedHost = null;
// let credsCache = null;
// let overlayRoot = null;
// let mo = null; // MutationObserver ref
// let anchorEl = null;
// let repositionHandlersBound = false;
//
// init().catch(console.error);
//
// async function init() {
//     const host = location.host;
//     lastTriedHost = host;
//     const { ok, creds } = await sendMsg('gk-get-creds-for-host', { host, href: location.href });
//     if (!ok) return;
//     credsCache = creds || [];
//     if (!credsCache.length) return; // nothing to do
//
//     // ⬇️ ONLY show chooser on focus now
//     attachFocusHandlers();
// }
//
// function attachFocusHandlers() {
//     // Capture phase to catch focus even through shadow hosts
//     document.addEventListener('focusin', onFocusIn, true);
// }
//
// function onFocusIn(e) {
//     const t = e.target;
//     if (!(t instanceof Element)) return;
//     if (!isUserField(t) && !isPassField(t)) return;
//     if (!credsCache || credsCache.length === 0) return;
//
//     // If chooser already open for same anchor, just reposition
//     if (overlayRoot && anchorEl === t) {
//         positionOverlayNear(t);
//         return;
//     }
//
//     anchorEl = t;
//
//     showChooser(credsCache, (chosen) => {
//         if (!chosen) return;
//         // Fill relative to focused field
//         const scope = anchorEl.form || anchorEl.closest('form') || document;
//         const user = isUserField(anchorEl) ? anchorEl : (findAnyUsernameInput(scope));
//         const pass = isPassField(anchorEl) ? anchorEl : findPasswordInput(scope);
//
//         if (user && chosen.username != null) fill(user, chosen.username);
//         if (pass && chosen.password != null) fill(pass, chosen.password);
//     }, { anchor: t });
// }
//
// function isUserField(el) {
//     if (!(el instanceof HTMLInputElement)) return false;
//     const type = (el.type || '').toLowerCase();
//     const name = (el.name || '').toLowerCase();
//     const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
//     if (type === 'email') return true;
//     if (ac.includes('username') || ac.includes('email')) return true;
//     if (type === 'text' && (/user|login|email/i).test(name)) return true;
//     return false;
// }
//
// function isPassField(el) {
//     return el instanceof HTMLInputElement && (el.type || '').toLowerCase() === 'password';
// }
//
// function sendMsg(type, payload = {}) {
//     return new Promise(resolve => chrome.runtime.sendMessage({ type, ...payload }, resolve));
// }
//
// // ---------- NEW/CHANGED: narrow observer + smarter debounce ----------
//
// function observeRelevantMutations(effect) {
//     stopObserving();
//
//     let scheduled = false;
//     const run = () => {
//         if (scheduled) return;
//         scheduled = true;
//         // Slightly longer debounce to avoid UI thrash
//         setTimeout(() => {
//             scheduled = false;
//             effect();
//         }, 500);
//     };
//
//     mo = new MutationObserver((mutations) => {
//         for (const m of mutations) {
//             if (m.type === 'childList') {
//                 if (hasAuthishNodes(m.addedNodes)) { run(); return; }
//             } else if (m.type === 'attributes') {
//                 const t = m.target;
//                 if (!t || !(t instanceof Element)) continue;
//                 // Attributes that commonly affect auth inputs
//                 if (t.tagName === 'INPUT' || t.tagName === 'FORM') { run(); return; }
//             }
//         }
//     });
//
//     mo.observe(document, {
//         subtree: true,
//         childList: true,
//         attributes: true,
//         // Only attributes that likely affect visibility/role/value detection
//         attributeFilter: ['type', 'name', 'autocomplete', 'style', 'class']
//     });
// }
//
// function hasAuthishNodes(nodeList) {
//     for (const n of nodeList) {
//         if (!(n instanceof Element)) continue;
//         const tag = n.tagName;
//         if (tag === 'INPUT' || tag === 'FORM') return true;
//         // cheap subtree probe
//         if (n.querySelector && n.querySelector('input[type="password"], form, input[type="email"]')) return true;
//     }
//     return false;
// }
//
// function stopObserving() {
//     if (mo) { try { mo.disconnect(); } catch {} }
//     mo = null;
// }
//
// // ---------- Generic autofill & helpers (unchanged) ----------
//
// function tryGenericFill(creds) {
//     // Only fill once per page for safety
//     if (document.documentElement.hasAttribute(GK.ATTRS.filled)) return false;
//
//     const password = findPasswordInput();
//     if (!password) return false;
//
//     const username = findUsernameInputNear(password) || findAnyUsernameInput();
//     const form = password.form || username?.form || password.closest('form') || document;
//
//     if (!username) {
//         // Two-stage flows (email first), let overrides handle them
//         return false;
//     }
//
//     if (creds.length === 1) {
//         fill(username, creds[0].username);
//         fill(password, creds[0].password);
//         markFilled();
//         return true;
//     } else {
//         showChooser(creds, (chosen) => {
//             fill(username, chosen.username);
//             fill(password, chosen.password);
//             markFilled();
//         }, { anchor: username || password || form });
//         return true;
//     }
// }
//
// function markFilled() {
//     document.documentElement.setAttribute(GK.ATTRS.filled, '1');
// }
//
// function fill(input, value) {
//     if (!input) return;
//     if (input.isContentEditable) {
//         input.textContent = value;
//     } else {
//         const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
//         nativeInputValueSetter.call(input, value);
//         input.dispatchEvent(new Event('input', { bubbles: true }));
//         input.dispatchEvent(new Event('change', { bubbles: true }));
//     }
// }
//
// function findPasswordInput(root = document) {
//     const candidates = Array.from(root.querySelectorAll('input[type="password"]'))
//         .filter(isVisibleEnabled);
//     return candidates[0] || null;
// }
//
// function findUsernameInputNear(password) {
//     if (!password) return null;
//     const form = password.form || password.closest('form');
//     const scope = form || document;
//     const selectors = [
//         'input[autocomplete="username"]',
//         'input[type="email"]',
//         'input[name*="user" i]',
//         'input[name*="login" i]',
//         'input[name*="email" i]',
//         'input[type="text"]'
//     ];
//     for (const sel of selectors) {
//         const node = Array.from(scope.querySelectorAll(sel)).find(isVisibleEnabled);
//         if (node) return node;
//     }
//     return null;
// }
//
// function findAnyUsernameInput(root = document) {
//     const selectors = [
//         'input[autocomplete="username"]',
//         'input[type="email"]',
//         'input[name*="user" i]',
//         'input[name*="login" i]',
//         'input[name*="email" i]',
//         'input[type="text"]'
//     ];
//     for (const sel of selectors) {
//         const node = Array.from(root.querySelectorAll(sel)).find(isVisibleEnabled);
//         if (node) return node;
//     }
//     return null;
// }
//
// function isVisibleEnabled(el) {
//     if (!el) return false;
//     const s = getComputedStyle(el);
//     if (s.visibility === 'hidden' || s.display === 'none' || el.disabled) return false;
//     const rect = el.getBoundingClientRect();
//     return rect.width > 0 && rect.height > 0;
// }
//
// // —— Small chooser overlay (Shadow DOM to avoid CSS collisions) ——
// function showChooser(creds, onPick, { anchor } = {}) {
//     destroyChooser();
//
//     const host = document.createElement('div');
//     host.setAttribute(GK.ATTRS.overlayHost, '');
//     Object.assign(host.style, { position: 'fixed', zIndex: 2147483647, top: '0px', left: '0px' });
//
//     const shadow = host.attachShadow({ mode: 'open' });
//     const wrap = document.createElement('div');
//     wrap.innerHTML = `
//     <style>
//       .card { font: 13px/1.4 system-ui,-apple-system, Segoe UI, Roboto, sans-serif; background:#0b1320; color:#e5e7eb; border:1px solid #334155; border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,.35); min-width: 260px; max-width: 360px; }
//       .hdr { padding:10px 12px; border-bottom:1px solid #1f2937; font-weight:600; }
//       .list { max-height: 260px; overflow:auto; }
//       .row { padding: 10px 12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; }
//       .row:hover { background:#111827; }
//       .user { font-weight:500; }
//       .dom { opacity:.7; font-size:12px; margin-left:12px; }
//     </style>
//     <div class="card">
//       <div class="hdr">GhostKeys — Choose account</div>
//       <div class="list"></div>
//     </div>
//   `;
//     const list = wrap.querySelector('.list');
//     creds.forEach(c => {
//         const row = document.createElement('div');
//         row.className = 'row';
//         row.innerHTML = `<span class="user">${escapeHtml(c.username)}</span><span class="dom">${escapeHtml(c.domain)}</span>`;
//         row.addEventListener('click', () => { onPick(c); destroyChooser(); });
//         list.appendChild(row);
//     });
//     shadow.appendChild(wrap);
//
//     document.documentElement.appendChild(host);
//     overlayRoot = host;
//
//     // Position after render
//     requestAnimationFrame(() => positionOverlayNear(anchor));
//
//     bindRepositionHandlers();
//     bindDismissHandlers();
// }
//
// function positionOverlayNear(anchor) {
//     if (!overlayRoot || !overlayRoot.isConnected || !anchor) return;
//     const rect = anchor.getBoundingClientRect();
//     const pad = 6;
//     const top = Math.round(rect.bottom + pad);
//     let left = Math.round(rect.left);
//
//     // Clamp horizontally using measured card width
//     const shadow = overlayRoot.shadowRoot;
//     const card = shadow && shadow.querySelector('.card');
//     const vw = window.innerWidth;
//     const cardW = Math.min(card ? card.getBoundingClientRect().width : 280, 380);
//     if (left + cardW + 8 > vw) left = Math.max(8, vw - cardW - 8);
//     if (left < 8) left = 8;
//
//     overlayRoot.style.top = `${top}px`;
//     overlayRoot.style.left = `${left}px`;
// }
//
// function throttle(fn, delay = 200) {
//     let last = 0, timer = null, lastArgs = null;
//     return (...args) => {
//         const now = Date.now();
//         lastArgs = args;
//         if (!last || now - last >= delay) {
//             last = now;
//             fn(...args);
//         } else if (!timer) {
//             timer = setTimeout(() => {
//                 timer = null;
//                 last = Date.now();
//                 fn(...lastArgs);
//             }, delay - (now - last));
//         }
//     };
// }
//
// function bindRepositionHandlers() {
//     if (repositionHandlersBound) return;
//     const throttled = throttle(() => positionOverlayNear(anchorEl), 100);
//     window.addEventListener('scroll', throttled, true);
//     window.addEventListener('resize', throttled, true);
//     repositionHandlersBound = true;
// }
//
// function bindDismissHandlers() {
//     const onDocClick = (e) => {
//         if (!overlayRoot) return;
//         const path = e.composedPath ? e.composedPath() : [];
//         if (path.includes(overlayRoot)) return; // click inside overlay
//         if (anchorEl && path.includes(anchorEl)) return; // clicking the field — keep open
//         destroyChooser();
//     };
//     const onKey = (e) => { if (e.key === 'Escape') destroyChooser(); };
//     document.addEventListener('mousedown', onDocClick, true);
//     document.addEventListener('touchstart', onDocClick, true);
//     document.addEventListener('keydown', onKey, true);
// }
//
// function destroyChooser() {
//     if (overlayRoot && overlayRoot.isConnected) overlayRoot.remove();
//     overlayRoot = null;
// }
//
// function escapeHtml(s) {
//     return String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
// }
//
// // —— Site-specific overrides (lightweight) ——
// async function trySiteOverrides(creds) {
//     const h = location.hostname;
//     const table = [
//         { test: host => host.endsWith('accounts.google.com'), fn: overrideGoogle },
//         { test: host => host.includes('signin.aws.amazon.com'), fn: overrideAws },
//     ];
//     for (const { test, fn } of table) {
//         if (test(h)) {
//             const ok = await fn(creds).catch(() => false);
//             if (ok) return true;
//         }
//     }
//     return false;
// }
//
// async function overrideGoogle(creds) {
//     const emailField = document.querySelector('input[type="email"], #identifierId');
//     if (!emailField) return false;
//
//     const chosen = await pickIfMany(creds);
//     if (!chosen) return false;
//
//     if (!emailField.value) {
//         fill(emailField, chosen.username);
//     }
//     const next1 = document.querySelector('#identifierNext button, #identifierNext');
//     if (next1) next1.click();
//
//     const pass = await waitFor(() => document.querySelector('input[type="password"]'), 8000);
//     if (!pass) return true;
//     if (!pass.value) fill(pass, chosen.password);
//     markFilled();
//     return true;
// }
//
// async function overrideAws(creds) {
//     const chosen = await pickIfMany(creds);
//     if (!chosen) return false;
//
//     const userSel = 'input#username, input[name="username"], input[name="account"], input[type="email"]';
//     const passSel = 'input#password, input[name="password"], input[type="password"]';
//     const user = document.querySelector(userSel);
//     const pass = document.querySelector(passSel);
//     if (user) fill(user, chosen.username);
//     if (pass) fill(pass, chosen.password);
//
//     if (user || pass) { markFilled(); return true; }
//     return false;
// }
//
// function pickIfMany(creds) {
//     return new Promise(resolve => {
//         if (creds.length === 1) return resolve(creds[0]);
//         showChooser(creds, c => resolve(c));
//         setTimeout(() => resolve(null), 15000); // avoid hanging forever
//     });
// }
//
// function waitFor(fn, timeoutMs = 5000, interval = 100) {
//     return new Promise(resolve => {
//         const t0 = Date.now();
//         const timer = setInterval(() => {
//             const v = fn();
//             if (v) { clearInterval(timer); resolve(v); }
//             else if (Date.now() - t0 > timeoutMs) { clearInterval(timer); resolve(null); }
//         }, interval);
//     });
// }
