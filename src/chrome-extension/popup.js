// popup.js — simple UI plumbing to import seed, fetch vaults (mock), and select active vault

const els = {
    seed: document.getElementById('seed'),
    importBtn: document.getElementById('import'),
    clearBtn: document.getElementById('clear'),
    seedStatus: document.getElementById('seedStatus'),
    vaults: document.getElementById('vaults'),
    useVault: document.getElementById('useVault'),
    vaultStatus: document.getElementById('vaultStatus')
};

let selectedVaultId = null;

init();

function sendMsg(type, payload = {}) {
    return new Promise(resolve => chrome.runtime.sendMessage({ type, ...payload }, resolve));
}

async function init() {
    await refreshVaults();
    wire();
}

function wire() {
    els.importBtn.addEventListener('click', onImport);
    els.clearBtn.addEventListener('click', onClear);
    els.useVault.addEventListener('click', onUseVault);
}

async function onImport() {
    els.seedStatus.textContent = '';
    const seedPhrase = (els.seed.value || '').trim();
    if (!seedPhrase) { els.seedStatus.textContent = 'Seed phrase is empty.'; return; }
    const res = await sendMsg('gk-import-seed', { seedPhrase });
    if (!res?.ok) { els.seedStatus.textContent = 'Error: ' + (res?.error || 'Unknown'); return; }
    els.seedStatus.textContent = `Imported. Found ${res.vaults?.length || 0} vault(s).`;
    await refreshVaults();
}

async function onClear() {
    await sendMsg('gk-clear-all');
    els.seed.value = '';
    selectedVaultId = null;
    els.vaults.innerHTML = '';
    els.useVault.disabled = true;
    els.vaultStatus.textContent = 'Cleared.';
}

async function onUseVault() {
    if (!selectedVaultId) return;
    const res = await sendMsg('gk-select-vault', { vaultId: selectedVaultId });
    if (!res?.ok) { els.vaultStatus.textContent = 'Error: ' + (res?.error || 'Unknown'); return; }
    els.vaultStatus.textContent = 'Vault selected.';
}

async function refreshVaults() {
    const res = await sendMsg('gk-list-vaults');
    const vaults = res?.vaults || [];
    const selectedId = res?.selectedId || null;
    els.vaults.innerHTML = '';


    vaults.forEach(v => {
        const row = document.createElement('label');
        row.className = 'vault';
        row.innerHTML = `
<input type="radio" name="vault" value="${escapeHtml(v.id)}" ${v.id === selectedId ? 'checked' : ''} />
<div class="vaultName">${escapeHtml(v.name)}</div>
`;
        const radio = row.querySelector('input');
        radio.addEventListener('change', () => {
            selectedVaultId = v.id;
            els.useVault.disabled = !selectedVaultId;
        });
        els.vaults.appendChild(row);
    });


    selectedVaultId = selectedId;
    els.useVault.disabled = !selectedVaultId;
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }