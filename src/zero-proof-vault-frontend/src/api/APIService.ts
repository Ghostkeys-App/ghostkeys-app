// src/api/mockGhostkeysApi.ts
// Mocked BE for Ghostkeys — persistent via localStorage with artificial latency.

/////////////////////////////
// Types (match your BE)
/////////////////////////////

export type FlexGridDataKey = { col: number; row: number };

export type VaultData = {
  flexible_grid_columns: Array<{ name: string; meta: { index: number; hidden: boolean } }>;
  secure_notes: Array<{ id: string; content: string }>;
  flexible_grid: Array<{ key: FlexGridDataKey; value: string }>;
  website_logins: Array<{ name: string; entries: Array<{ login: string; password: string }> }>;
};

export type ServerVault = { vault_id: string; data: VaultData };

/////////////////////////////
// Mock store persistence
/////////////////////////////

type MockDB = {
  users: Record<
      string, // userId
      Record<string, VaultData> // vaultId -> data
  >;
};

const LS_KEY = "ghostkeys:mock-server:v1";

function loadDB(): MockDB {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as MockDB;
  } catch {}
  return { users: {} };
}

function saveDB(db: MockDB) {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

function ensureUserVault(db: MockDB, userId: string, vaultId: string) {
  db.users[userId] ||= {};
  if (!db.users[userId][vaultId]) db.users[userId][vaultId] = makeSeedVault(vaultId);
}

/////////////////////////////
// Latency helpers
/////////////////////////////

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// configurable jittery latency (simulate network)
const NET_MIN = 120;
const NET_MAX = 420;
function netDelay() {
  const ms = Math.floor(NET_MIN + Math.random() * (NET_MAX - NET_MIN));
  return delay(ms);
}

/////////////////////////////
// Seed data (realistic)
/////////////////////////////

function makeSeedVault(vaultId = "default"): VaultData {
  const columns = [
    { name: "A", meta: { index: 0, hidden: true } },
    { name: "B", meta: { index: 1, hidden: false } },
    { name: "C", meta: { index: 2, hidden: false } },
    { name: "Secret", meta: { index: 3, hidden: true } },
    { name: "Secret2", meta: { index: 4, hidden: true } },
  ];
  const cells: Array<{ key: FlexGridDataKey; value: string }> = [];
  for (let r = 0; r < 8; r++) {
    cells.push({ key: { row: r, col: 0 }, value: String(r + 1) });
  }
  cells.push({ key: { row: 0, col: 1 }, value: "Ghostkeys" });
  cells.push({ key: { row: 1, col: 1 }, value: "Offline-first ✅" });
  cells.push({ key: { row: 2, col: 2 }, value: "Paste from Excel →" });
  cells.push({ key: { row: 0, col: 3 }, value: "p@ssw0rd!" });

  const logins = [
    {
      name: "Google",
      entries: [
        { login: "you@example.com", password: "p@55W0rd!" },
        { login: "you+work@example.com", password: "p@55W0rd!2" },
      ],
    },
    {
      name: "GitHub",
      entries: [{ login: "ghostkeys", password: "hunter2" }],
    },
  ];

  const notes = [
    {
      id: crypto.randomUUID(),
      content:
          "Welcome to Ghostkeys! 🔐\n\nThis is a demo secure note. Your data lives offline-first in IndexedDB.",
    },
    {
      id: crypto.randomUUID(),
      content:
          "Tip: Use Ctrl/Cmd+M to mask a spreadsheet column visually (our canvas grid).",
    },
  ];

  return {
    flexible_grid_columns: columns,
    flexible_grid: cells,
    website_logins: logins,
    secure_notes: notes,
  };
}

/////////////////////////////
// Mock API (matches your BE)
/////////////////////////////

export const mockApi = {
  // service.get_all_vaults_for_user : (text) -> (vec record { text; VaultData }) query;
  async get_all_vaults_for_user(userId: string): Promise<Array<{ vault_id: string; data: VaultData }>> {
    await netDelay();
    const db = loadDB();
    // auto-create a default vault if none
    if (!db.users[userId] || Object.keys(db.users[userId]).length === 0) {
      ensureUserVault(db, userId, "default");
      saveDB(db);
    }
    const vaults = db.users[userId] ?? {};
    return Object.entries(vaults).map(([vault_id, data]) => ({ vault_id, data }));
  },

  // service.get_vault : (text, text) -> (opt VaultData) query;
  async get_vault(userId: string, vaultId: string): Promise<VaultData | null> {
    await netDelay();
    const db = loadDB();
    if (!db.users[userId] || !db.users[userId][vaultId]) return null;
    return db.users[userId][vaultId];
  },

  // service.add_or_update_vault : (text, text, VaultData) -> ();
  async add_or_update_vault(userId: string, vaultId: string, data: VaultData): Promise<void> {
    await netDelay();
    const db = loadDB();
    db.users[userId] ||= {};
    db.users[userId][vaultId] = normalizeVaultData(data);
    saveDB(db);
  },

  // service.apply_config_changes : (vec record { text; text; VaultData }) -> ();
  // For the mock we just upsert each tuple (userId is implicit in your session state)
  async apply_config_changes(
      userId: string,
      changes: Array<{ vault_id: string; data: VaultData }>
  ): Promise<void> {
    await netDelay();
    const db = loadDB();
    db.users[userId] ||= {};
    for (const ch of changes) {
      db.users[userId][ch.vault_id] = normalizeVaultData(ch.data);
    }
    saveDB(db);
  },

  // service.delete_vault : (text, text) -> ();
  async delete_vault(userId: string, vaultId: string): Promise<void> {
    await netDelay();
    const db = loadDB();
    if (db.users[userId]) {
      delete db.users[userId][vaultId];
      saveDB(db);
    }
  },

  // service.clear_all_user_vaults : (text) -> ();
  async clear_all_user_vaults(userId: string): Promise<void> {
    await netDelay();
    const db = loadDB();
    delete db.users[userId];
    saveDB(db);
  },
};

/////////////////////////////
// Normalizer (schema guard)
/////////////////////////////

function normalizeVaultData(data: VaultData): VaultData {
  return {
    flexible_grid_columns:
        data.flexible_grid_columns?.map((c, i) => ({
          name: c?.name ?? `Col ${i + 1}`,
          meta: { index: typeof c?.meta?.index === "number" ? c.meta.index : i, hidden: !!c?.meta?.hidden },
        })) ?? [],
    secure_notes:
        data.secure_notes?.map((n) => ({
          id: n?.id ?? crypto.randomUUID(),
          content: n?.content ?? "",
        })) ?? [],
    flexible_grid:
        data.flexible_grid?.map((cell) => ({
          key: { col: cell?.key?.col >>> 0, row: cell?.key?.row >>> 0 },
          value: cell?.value ?? "",
        })) ?? [],
    website_logins:
        (data.website_logins ?? []).map((w) => ({
          name: (w?.name ?? "").toString(),
          entries: (w?.entries ?? []).map((e) => ({
            login: (e?.login ?? "").toString(),
            password: (e?.password ?? "").toString(),
          })),
        })),
  };
}
