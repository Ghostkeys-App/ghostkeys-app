import React, {useMemo} from "react";
import {useVaultProviderActions, useVaultProviderState} from "../../utility/vault-provider";
import {VaultData} from "../../utility/vault-provider/types.ts";
import {
  clamp,
  colName,
  drawEye,
  exportRange,
  fitCanvasToCSSPixels, isSingle,
  keyOf,
  parseKey,
  pointInRect,
  splitCsv
} from "./helpers.tsx";
import {
  SS_BENDING_BG,
  SS_BG,
  SS_CELL_BG, SS_CELL_FONT,
  SS_EYE_PD_R,
  SS_EYE_SIZE,
  SS_FONT, SS_GRID_LINE_COLOR,
  SS_ROW_BG, SS_SELECTION_BORDER_COLOR, SS_SELECTION_SHADOW_COLOR,
  SS_TEXT_BASELINE,
  SS_TEXT_COLOR
} from "./constants.tsx";
import {toast} from "../../utility/toast";

type CellKey = string; // "r,c"

// --- Tunables ---
const ROW_H = 30;
const COL_W = 120;
const HDR_H = 36;
const HDR_W = 60;
const PADDING_X = 8;
const OVERSCAN = 2;
const ROWS_DEFAULT_AMOUNT = 200;
const COLS_DEFAULT_AMOUNT = 50;

type ColumnMeta = { name: string; masked: boolean };

export default function SpreadsheetCanvas(): JSX.Element {
  const { currentVault, currentVaultId } = useVaultProviderState();
  const { saveCurrentVaultDataToIDB, syncCurrentVaultWithBackend } = useVaultProviderActions();

  const model = React.useRef({
    rows: ROWS_DEFAULT_AMOUNT,
    cols: COLS_DEFAULT_AMOUNT,
    data: new Map<CellKey, string>(),
    columns: [] as ColumnMeta[], // length === cols (lazily filled)
    committedKeys: new Set<string>(),
    colCommitted: new Set<number>(),
  });

  // View refs
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<{ r: number; c: number }>({ r: 0, c: 0 });
  const hdrIconRectsRef = React.useRef<Array<{ c: number; x: number; y: number; w: number; h: number }>>([]);
  const lastIconToggleAtRef = React.useRef(0);

  // UI-only states
  const [saving, setSaving] = React.useState(false);
  const [sel, setSel] = React.useState({ r0: 0, c0: 0, r1: 0, c1: 0 });
  const [editing, setEditing] = React.useState(false);
  const [editVal, setEditVal] = React.useState("");
  const [editRect, setEditRect] = React.useState<{ left: number; top: number; width: number; height: number }>({ left: 0, top: 0, width: 0, height: 0 });
  const [hdrEditing, setHdrEditing] = React.useState<null | { c: number; value: string; rect: { left: number; top: number; width: number; height: number } }>(null);

  // Scroll + viewport (in refs; we only redraw canvas, no re-render)
  const view = React.useRef({ left: 0, top: 0, w: 800, h: 600 });
  const rafId = React.useRef<number | 0>(0);
  const dragging = React.useRef<{ anchorR: number; anchorC: number } | null>(null);


  const synced = useMemo(
      () => currentVault?.synced,
      [currentVault]
  );

  React.useEffect(() => {
    (() => {
      if (!currentVault) return;
      applySpreadsheetFromVault(currentVault.data);
    })();
  }, [currentVault]);

  React.useEffect(() => {
    // Always show editor for a single-cell selection; hide it for ranges/headers
    if (!isSingle(sel)) {
      if (editing) setEditing(false);
      return;
    }

    // compute rect & value for the selected cell
    const { r0, c0 } = sel;
    const vi = visibleIndexOf(c0);
    if (vi === -1) { // hidden or offscreen
      if (editing) setEditing(false);
      return;
    }

    // keep overlay aligned to current scroll
    syncViewFromWrap();

    const val = model.current.data.get(keyOf(r0, c0)) ?? "";

    setEditVal(val);
    setEditRect({
      left: HDR_W + vi * COL_W,
      top:   HDR_H + r0 * ROW_H,
      width: COL_W,
      height: ROW_H,
    });

    if (!editing) setEditing(true);

    // next paint
    scheduleDraw();
  }, [sel, editing]);


  // Main draw functions
  const scheduleDraw = () => {
    if (!rafId.current) rafId.current = requestAnimationFrame(() => { rafId.current = 0; drawNow(); });
  };

  const drawNow = React.useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const { rows, cols, data } = model.current;
    const { left, top, w, h } = view.current;

    const vis = getVisibleCols(); // logical indices of visible columns

    // Scale
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Visible window in VISIBLE column index space
    const rStart = Math.max(0, Math.floor((top - HDR_H) / ROW_H));
    const rVis = Math.ceil(h / ROW_H) + OVERSCAN;
    const rEnd = clamp(rStart + rVis, 0, rows);

    const visStart = Math.max(0, Math.floor((left - HDR_W) / COL_W));
    const visCount = Math.ceil(h > 0 ? w / COL_W : 0) + OVERSCAN;
    const visEnd = clamp(visStart + visCount, 0, vis.length);

    ctx.save();
    ctx.translate(-left, -top);

    // Headers background blocks
    ctx.fillStyle = SS_BG;
    hdrIconRectsRef.current = [];

    // Column headers
    for (let i = visStart; i < visEnd; i++) {
      const c = vis[i];
      const x = HDR_W + i * COL_W;
      ctx.fillRect(x, 0, COL_W, HDR_H);
      ctx.fillStyle = SS_TEXT_COLOR;
      ctx.font = SS_FONT;
      ctx.textBaseline = SS_TEXT_BASELINE;
      ctx.fillText(getColName(c), x + PADDING_X, HDR_H / 2);
      ctx.fillStyle = SS_BG;

      const iconSize = SS_EYE_SIZE;
      const padRight = SS_EYE_PD_R;
      const iconX = x + COL_W - padRight - iconSize / 2;
      const iconY = HDR_H / 2;

      drawEye(ctx, iconX, iconY, model.current.columns[c]?.masked === true);

      hdrIconRectsRef.current.push({
        c,
        x: x + COL_W - padRight - iconSize,
        y: (HDR_H - iconSize) / 2,
        w: iconSize,
        h: iconSize,
      });
    }

    // Row headers
    for (let r = rStart; r < rEnd; r++) {
      const y = HDR_H + r * ROW_H;
      ctx.fillStyle = SS_ROW_BG;
      ctx.fillRect(0, y, HDR_W, ROW_H);
      ctx.fillStyle = SS_TEXT_COLOR;
      ctx.font = SS_FONT;
      ctx.textBaseline = SS_TEXT_BASELINE;
      ctx.fillText(String(r + 1), HDR_W / 2 - 6, y + ROW_H / 2);
    }

    // Corner
    ctx.fillStyle = SS_ROW_BG;
    ctx.fillRect(0, 0, HDR_W, HDR_H);

    // Cells background
    ctx.fillStyle = SS_CELL_BG;
    ctx.fillRect(HDR_W, HDR_H, vis.length * COL_W, rows * ROW_H);

    // banding
    ctx.fillStyle = SS_BENDING_BG;
    for (let r = rStart; r < rEnd; r += 2) {
      const y = HDR_H + r * ROW_H;
      ctx.fillRect(HDR_W, y, vis.length * COL_W, ROW_H);
    }

    // grid lines
    ctx.strokeStyle = SS_GRID_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = visStart; i <= visEnd; i++) {
      const x = HDR_W + i * COL_W + 0.5;
      ctx.moveTo(x, HDR_H + rStart * ROW_H);
      ctx.lineTo(x, HDR_H + rEnd * ROW_H);
    }
    for (let r = rStart; r <= rEnd; r++) {
      const y = HDR_H + r * ROW_H + 0.5;
      ctx.moveTo(HDR_W + visStart * COL_W, y);
      ctx.lineTo(HDR_W + visEnd * COL_W, y);
    }
    ctx.stroke();

    // cell text
    ctx.fillStyle = "#ffffff";
    ctx.font = SS_CELL_FONT;
    ctx.textBaseline = SS_TEXT_BASELINE;
    for (let r = rStart; r < rEnd; r++) {
      for (let i = visStart; i < visEnd; i++) {
        const c = vis[i];
        const v = data.get(keyOf(r, c));
        if (!v) continue;
        const isMasked = model.current.columns[c]?.masked === true;
        const show = isMasked ? "•".repeat(Math.min(v.length || 1, 20)) : v;
        const x = HDR_W + i * COL_W + PADDING_X;
        const y = HDR_H + r * ROW_H + ROW_H / 2;
        ctx.fillText(show, x, y, COL_W - PADDING_X * 2);
      }
    }

    // selection rect (convert logical to visible)
    const R0 = Math.min(sel.r0, sel.r1), R1 = Math.max(sel.r0, sel.r1);
    const C0 = Math.min(sel.c0, sel.c1), C1 = Math.max(sel.c0, sel.c1);
    const visC0 = visibleIndexOf(C0);
    const visC1 = visibleIndexOf(C1);
    if (visC0 !== -1 && visC1 !== -1) {
      const sx = HDR_W + Math.min(visC0, visC1) * COL_W;
      const sw = (Math.abs(visC1 - visC0) + 1) * COL_W;
      const sy = HDR_H + R0 * ROW_H;
      const sh = (R1 - R0 + 1) * ROW_H;
      ctx.strokeStyle = SS_SELECTION_BORDER_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
      ctx.shadowColor = SS_SELECTION_SHADOW_COLOR;
      ctx.shadowBlur = 8;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }, [sel]);


  // Layout Effects
  React.useLayoutEffect(() => {
    const wrap = wrapRef.current!;
    const onMove = (e: MouseEvent) => {
      const col = hitMaskIcon(e.clientX, e.clientY);
      wrap.style.cursor = col != null ? "pointer" : "default";
    };
    const onLeave = () => { wrap.style.cursor = "default"; };
    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);
    return () => {
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Resize + scroll handling
  React.useLayoutEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const spacer = spacerRef.current!;

    const sizeSpacer = () => {
      const visCols = getVisibleCols().length;
      spacer.style.width = `${HDR_W + visCols * COL_W}px`;
      spacer.style.height = `${HDR_H + model.current.rows * ROW_H}px`;
    };
    sizeSpacer();

    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      view.current.w = r.width;
      view.current.h = r.height;
      fitCanvasToCSSPixels(canvas, r.width, r.height);
      // keep canvas pinned even if sticky misbehaves (Safari)
      canvas.style.transform = `translate3d(${wrap.scrollLeft}px, ${wrap.scrollTop}px, 0)`;
      scheduleDraw();
    });
    ro.observe(wrap);

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        view.current.left = wrap.scrollLeft;
        view.current.top = wrap.scrollTop;
        canvas.style.transform = `translate3d(${view.current.left}px, ${view.current.top}px, 0)`;

        // keep overlays aligned
        if (editing) {
          const { r0, c0 } = sel;
          const vi = visibleIndexOf(c0);
          if (vi !== -1) {
            setEditRect({
              left: HDR_W + vi * COL_W,
              top: HDR_H + r0 * ROW_H,
              width: COL_W,
              height: ROW_H,
            });
          }
        }
        if (hdrEditing) {
          const vi = visibleIndexOf(hdrEditing.c);
          if (vi !== -1) {
            const rect = {
              left: HDR_W + vi * COL_W,
              top: view.current.top,
              width: COL_W,
              height: HDR_H,
            };
            setHdrEditing({ c: hdrEditing.c, value: hdrEditing.value, rect });
          }
        }

        drawNow();
      });
    };
    wrap.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      wrap.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [editing, hdrEditing, sel, drawNow]);


  function applySpreadsheetFromVault(vaultData: VaultData) {
    const m = model.current;

    m.columns = [];
    m.cols = 0;

    // fixed 50 columns: start with defaults, then overlay only modified columns from IDB
    m.columns = [];
    m.cols = COLS_DEFAULT_AMOUNT;
    m.colCommitted.clear();

    for (let i = 0; i < COLS_DEFAULT_AMOUNT; i++) {
      m.columns[i] = { name: colName(i), masked: false };
    }
    if (Array.isArray(vaultData.flexible_grid_columns)) {
      for (const col of vaultData.flexible_grid_columns) {
        const idx = Number(col?.meta?.index ?? -1);
        if (idx >= 0 && idx < COLS_DEFAULT_AMOUNT) {
          if ((col as any).commited === true) m.colCommitted.add(idx);
          // If BE sends name: "" for "revert/delete", show default in UI
          const displayName = col?.name == null || col?.name === "" ? colName(idx) : col.name;
          m.columns[idx] = {
            name: displayName,
            masked: !!col?.meta?.hidden,
          };
        }
      }
    }

    // ----- Cells -----
    m.data.clear();
    m.committedKeys.clear();
    let maxRow = 0;

    for (const cell of vaultData.flexible_grid) {
      const r = cell.key.row;
      const c = cell.key.col;
      const v = cell.value ?? "";
      const k = keyOf(r, c);

      const committed = (cell as any).commited === true;
      if (committed) m.committedKeys.add(k);
      // keep empty-string in m.data if committed (tombstone), otherwise skip
      if (v !== null && v !== undefined) {
        if (v === "") {
          if (committed) m.data.set(k, "");
        } else {
          m.data.set(k, v);
        }
      }

      if (r > maxRow) {
        maxRow = r;
      }
    }

    // ----- Rows / spacer -----
    m.rows = Math.max(m.rows, maxRow + 1);

    if (spacerRef.current) {
      const visCols = getVisibleCols().length;
      spacerRef.current.style.width = `${HDR_W + visCols * COL_W}px`;
      spacerRef.current.style.height = `${HDR_H + m.rows * ROW_H}px`;
    }

    // reset selection to A1
    // setSel({ r0: 0, c0: 0, r1: 0, c1: 0 });

    // Redraw
    requestAnimationFrame(() => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (wrap && canvas) {
        canvas.style.transform = `translate3d(${wrap.scrollLeft}px, ${wrap.scrollTop}px, 0)`;
      }
    });

    // trigger a draw
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        drawNow();
      });
    }
  }

  async function saveSpreadsheetToIDB() {
    if (!currentVault) {return}
    const m = model.current;

    // Flatten cells. Include empty-string values for committed cells (IC deletion semantics).
    const flexible_grid: Array<{ key:{col:number;row:number}; value:string; commited?: boolean }> = [];
    const addedKeys = new Set<string>();
    for (const [k, v] of m.data.entries()) {
      const { r, c } = parseKey(k);
      const isCommitted = m.committedKeys.has(k);
      // Uncommitted empties should never live in the map (we delete them on clear),
      // but guard anyway: skip only if empty AND not committed
      if (v === "" && !isCommitted) continue;
      flexible_grid.push({ key: { col: c, row: r }, value: v, commited: isCommitted });
      addedKeys.add(k);
    }

    // Ensure tombstones for committed keys that aren't present in m.data
    for (const k of m.committedKeys) {
      if (!addedKeys.has(k)) {
        const { r, c } = parseKey(k);
        flexible_grid.push({ key: { col: c, row: r }, value: "", commited: true });
      }
    }

    // columns meta (DIFF-ONLY):
    // persist only columns that differ from defaults { name: colName(i), hidden: false, index: i }
    ensureCols(COLS_DEFAULT_AMOUNT);
    const modifiedCols: Array<{ name: string; meta: { index: number; hidden: boolean }, commited?: boolean }> = [];
    for (let index = 0; index < COLS_DEFAULT_AMOUNT; index++) {
      const col = m.columns[index] ?? { name: colName(index), masked: false };
      // treat empty string same as default (UI always displays default if falsy)
      const isDefaultName = !col.name || col.name === colName(index);
      const isDefaultMask = (col.masked ?? false) === false;
      const isCommitted = m.colCommitted.has(index);

      if (isCommitted && isDefaultName && isDefaultMask) {
        // committed but reverted to defaults -> send tombstone (name: "")
        modifiedCols.push({
          name: "",
          meta: { index, hidden: false },
          commited: true
        });
      } else if (!isDefaultName || !isDefaultMask) {
        // genuinely modified column -> persist actual state
        modifiedCols.push({
          name: col.name || colName(index),
          meta: { index, hidden: !!col.masked },
          commited: isCommitted || undefined
        });
      } // else: non-committed & default -> omit
    }

    const nextPayload: any = {
      ...currentVault.data,
      flexible_grid,
      // always present for consistency; empty when nothing is modified
      flexible_grid_columns: modifiedCols
    };

    await saveCurrentVaultDataToIDB(nextPayload);
  }

  function hitMaskIcon(clientX: number, clientY: number): number | null {
    const wrap = wrapRef.current!;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left + view.current.left;
    const y = clientY - rect.top + view.current.top;

    for (const r of hdrIconRectsRef.current) {
      if (pointInRect(x, y, r)) return r.c;
    }
    return null;
  }

  async function toggleMasked(c: number) {
    ensureCols(c + 1);
    model.current.columns[c].masked = !model.current.columns[c].masked;
    await saveSpreadsheetToIDB();
  }

  function setSingleSelection(r: number, c: number) {
    anchorRef.current = { r, c };
    setSel({ r0: r, c0: c, r1: r, c1: c });
  }

  // --- Column helpers (names + hidden) ---
  function ensureCols(n: number) {
    // fixed: always ensure exactly COLS_DEFAULT_AMOUNT columns,
    // ignore requests beyond 50 and backfill defaults if needed
    const m = model.current;
    const target = COLS_DEFAULT_AMOUNT;
    if (m.columns.length < target) {
      for (let i = m.columns.length; i < target; i++) {
        m.columns.push({ name: colName(i), masked: false });
      }
    } else if (m.columns.length > target) {
      m.columns.length = target;
    }
  }
  function getColName(c: number) {
    ensureCols(c + 1);
    return model.current.columns[c].name || colName(c);
  }
  function setColName(c: number, name: string) {
    ensureCols(c + 1);
    model.current.columns[c].name = name || colName(c);
  }
  function getVisibleCols(): number[] {
    ensureCols(COLS_DEFAULT_AMOUNT);
    return Array.from({ length: COLS_DEFAULT_AMOUNT }, (_, i) => i);
  }
  function visibleIndexOf(c: number): number {
    return (c >= 0 && c < COLS_DEFAULT_AMOUNT) ? c : -1;
  }
  function logicalFromVisibleIndex(vi: number): number {
    return (vi >= 0 && vi < COLS_DEFAULT_AMOUNT) ? vi : -1;
  }

  // Map mouse coords -> hit (header/cell) respecting hidden columns
  function hitTest(clientX: number, clientY: number):
    | { kind: "cell"; r: number; c: number; x: number; y: number }
    | { kind: "colhdr"; c: number; x: number }
    | { kind: "rowhdr"; r: number; y: number }
    | null {
    const wrap = wrapRef.current!;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left + view.current.left;
    const y = clientY - rect.top + view.current.top;

    // Corner cell
    if (x < HDR_W && y < HDR_H) return null;

    // Column header
    if (y < HDR_H && x >= HDR_W) {
      const vi = Math.floor((x - HDR_W) / COL_W);
      const c = logicalFromVisibleIndex(vi);
      if (c === -1) return null;
      return { kind: "colhdr", c, x };
    }

    // Row header
    if (x < HDR_W && y >= HDR_H) {
      const r = Math.floor((y - HDR_H) / ROW_H);
      return { kind: "rowhdr", r, y };
    }

    // Grid cell
    if (x < HDR_W || y < HDR_H) return null;
    const vi = Math.floor((x - HDR_W) / COL_W);
    const c = logicalFromVisibleIndex(vi);
    if (c === -1) return null;
    const r = Math.floor((y - HDR_H) / ROW_H);
    return { kind: "cell", r, c, x, y };
  }

  function focusHost() {
    const el = wrapRef.current;
    if (el) el.focus({ preventScroll: true });
  }

  // Mouse selection / header rename
  function onMouseDown(e: React.MouseEvent) {
    focusHost();
    if (hdrEditing) return;

    const maskCol = hitMaskIcon(e.clientX, e.clientY);
    if (maskCol != null) {
      toggleMasked(maskCol);
      lastIconToggleAtRef.current = performance.now();
      scheduleDraw();
      return;
    }

    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    // Clicking a column header
    if (hit.kind === "colhdr") {
      const c = hit.c;
      if (e.shiftKey) {
        // extend horizontally from anchor to this column (full rows span)
        const a = anchorRef.current;
        setSel(s => ({
          r0: 0,
          r1: model.current.rows - 1,
          c0: Math.min(a.c, c),
          c1: Math.max(a.c, c),
        }));
      } else {
        // select whole column and reset anchor to top cell in that col
        anchorRef.current = { r: 0, c };
        setSel({ r0: 0, r1: model.current.rows - 1, c0: c, c1: c });
      }
      scheduleDraw();
      return;
    }

    // Clicking a row header
    if (hit.kind === "rowhdr") {
      const r = hit.r;
      if (e.shiftKey) {
        // extend vertically from anchor to this row (full column span)
        const a = anchorRef.current;
        setSel(s => ({
          r0: Math.min(a.r, r),
          r1: Math.max(a.r, r),
          c0: 0,
          c1: Math.max(0, model.current.cols - 1),
        }));
      } else {
        // select whole row and reset anchor to leftmost cell
        anchorRef.current = { r, c: 0 };
        setSel({ r0: r, r1: r, c0: 0, c1: Math.max(0, model.current.cols - 1) });
      }
      scheduleDraw();
      return;
    }

    // Clicking a cell
    if (hit.kind === "cell") {
      if (e.shiftKey) {
        // extend from anchor to clicked cell
        const a = anchorRef.current;
        setSel({
          r0: Math.min(a.r, hit.r),
          r1: Math.max(a.r, hit.r),
          c0: Math.min(a.c, hit.c),
          c1: Math.max(a.c, hit.c),
        });
        scheduleDraw();
        return; // no drag when shift-clicking
      }

      // start a drag selection (resets anchor)
      anchorRef.current = { r: hit.r, c: hit.c };
      setSel({ r0: hit.r, c0: hit.c, r1: hit.r, c1: hit.c });
      dragging.current = { anchorR: hit.r, anchorC: hit.c };
      scheduleDraw();

      const onMove = (ev: MouseEvent) => {
        // bail early if drag is no longer active
        const anchor = dragging.current;
        if (!anchor) return;

        const h = hitTest(ev.clientX, ev.clientY);
        if (!h || h.kind !== "cell") return;

        setSel(() => ({
          r0: Math.min(anchor.anchorR, h.r),
          r1: Math.max(anchor.anchorR, h.r),
          c0: Math.min(anchor.anchorC, h.c),
          c1: Math.max(anchor.anchorC, h.c),
        }));
        scheduleDraw();
      };
      const onUp = () => {
        dragging.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
  }

  function onDoubleClick(e: React.MouseEvent) {
    // If the double-click landed on the eye icon, toggle mask and exit.
    const iconHitCol = hitMaskIcon(e.clientX, e.clientY);
    if (iconHitCol != null) {
      toggleMasked(iconHitCol);
      scheduleDraw();
      return;
    }

    // Also swallow a dblclick that happens immediately after an icon click
    if (performance.now() - lastIconToggleAtRef.current < 250) {
      // prevent a quick double-tap on the icon from opening rename
      return;
    }

    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    if (hit.kind === "colhdr") {
      syncViewFromWrap();
      const vi = visibleIndexOf(hit.c);
      if (vi === -1) return;
      const rect = {
        left: HDR_W + vi * COL_W,
        top: view.current.top,
        width: COL_W,
        height: HDR_H,
      };
      setHdrEditing({ c: hit.c, value: getColName(hit.c), rect });
      return;
    }
  }

  function beginEdit(r: number, c: number) {
    syncViewFromWrap();
    const val = model.current.data.get(keyOf(r, c)) ?? "";
    const vi = visibleIndexOf(c);
    if (vi === -1) return; // hidden
    setEditVal(val);
    setEditing(true);
    anchorRef.current = { r, c };
    setSingleSelection(r, c);
    setEditRect({
      left: HDR_W + vi * COL_W,
      top: HDR_H + r * ROW_H,
      width: COL_W,
      height: ROW_H,
    });
    scheduleDraw();
  }

  async function commitEdit(refocus: boolean = true) {
    const { r0, c0 } = sel;
    const k = keyOf(r0, c0);
    const prevVal = model.current.data.get(k);

    if (prevVal == editVal || (!prevVal && !editVal)) {
      setEditing(false);
      if (refocus) requestAnimationFrame(focusHost);
      return;
    }

    if (editVal === "") {
      // If the cell is committed, keep an empty-string record (IC will delete it).
      if (model.current.committedKeys.has(k)) {
        model.current.data.set(k, "");
      } else {
        model.current.data.delete(k);
      }
    } else {
      model.current.data.set(k, editVal);
    }

    setEditing(false);
    if (refocus) requestAnimationFrame(focusHost);
    scheduleDraw();
    await saveSpreadsheetToIDB();
  }

  function cancelEdit() {
    setEditing(false);
    requestAnimationFrame(focusHost);
    scheduleDraw();
  }

  // Header edit actions
  async function commitHdrEdit() {
    if (!hdrEditing) return;
    const { c, value } = hdrEditing;
    setColName(c, value.trim());
    setHdrEditing(null);
    requestAnimationFrame(focusHost);
    scheduleDraw();
    await saveSpreadsheetToIDB();
  }
  function cancelHdrEdit() {
    setHdrEditing(null);
    requestAnimationFrame(focusHost);
    scheduleDraw();
  }

  // Keyboard: nav, copy, edit, hide/unhide
  async function onKeyDown(e: React.KeyboardEvent) {
    // If the focused element is the cell editor, let its handler manage keys
    if ((e.target as HTMLElement)?.classList?.contains('cell-editor')) return;

    const { r0, c0, r1, c1 } = sel;
    const r = Math.min(r0, r1), c = Math.min(c0, c1);

    if (hdrEditing) {
      if (e.key === "Enter") { e.preventDefault(); commitHdrEdit(); }
      if (e.key === "Escape") { e.preventDefault(); cancelHdrEdit(); }
      return;
    }
    if (editing) {
      if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
      if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
      return;
    }

    // Toggle mask: Ctrl/Cmd + M
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
      e.preventDefault();
      toggleMasked(Math.min(sel.c0, sel.c1));
      scheduleDraw();
      return;
    }

    // Copy selection (TSV)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const tsv = exportRange(sel, model.current);
      navigator.clipboard.writeText(tsv).catch(() => { });
      return;
    }

    // Enter = edit
    if (e.key === "Enter") { e.preventDefault(); syncViewFromWrap(); beginEdit(r, c); return; }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const m = model.current;

      const r0 = Math.min(sel.r0, sel.r1);
      const r1 = Math.max(sel.r0, sel.r1);
      const c0 = Math.min(sel.c0, sel.c1);
      const c1 = Math.max(sel.c0, sel.c1);

      const isFullRowSelection = c0 === 0 && c1 === Math.max(0, m.cols - 1);
      const isFullColumnSelection = r0 === 0 && r1 === Math.max(0, m.rows - 1);

      if (isFullRowSelection) {
        deleteRows(r0, r1 - r0 + 1);
        return;
      }

      if (isFullColumnSelection) {
        // if you already have deleteColumns helper, call it here
        deleteColumns(c0, c1 - c0 + 1);
        return;
      }

      // Otherwise: clear the selected cells
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const k = keyOf(r, c);
          if (m.committedKeys.has(k)) {
            m.data.set(k, ""); // mark for IC deletion
          } else {
            m.data.delete(k);
          }
        }
      }
      scheduleDraw();
      await saveSpreadsheetToIDB();
      return;
    }

    if (e.key.startsWith("Arrow") || e.key === "Tab") {
      e.preventDefault();
      const shift = e.shiftKey;
      const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;

      let baseRow = Math.min(sel.r0, sel.r1);
      if (shift) {
        baseRow = dr < 0 ? Math.min(sel.r0, sel.r1) : Math.max(sel.r0, sel.r1);
      } else {
        baseRow = Math.min(sel.r0, sel.r1);
      }
      let nr = clamp(baseRow + dr, 0, model.current.rows - 1);

      if (shift && dr !== 0) {
        const a = anchorRef.current;
        const curL = Math.min(sel.c0, sel.c1);
        const curR = Math.max(sel.c0, sel.c1);
        // keep the span that includes the anchor
        const left = Math.min(a.c, curL);
        const right = Math.max(a.c, curR);

        setSel({
          r0: Math.min(a.r, nr),
          r1: Math.max(a.r, nr),
          c0: left,
          c1: right,
        });
        scheduleDraw();
        return; // <-- IMPORTANT AS FUCK AS HELL: skip the horizontal logic below
      }

      const vis = getVisibleCols();
      let vi = visibleIndexOf(
        shift
          ? (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey) ? Math.min(c0, c1) : Math.max(c0, c1))
          : c
      );
      if (vi === -1) vi = 0;

      let dc = 0;
      if (e.key === "ArrowRight") dc = 1;
      if (e.key === "ArrowLeft") dc = -1;
      if (e.key === "Tab") dc = e.shiftKey ? -1 : 1;

      vi = clamp(vi + dc, 0, Math.max(0, vis.length - 1));
      const nextLogical = vis.length ? vis[vi] : c;

      if (shift) {
        const a = anchorRef.current;
        setSel({
          r0: Math.min(a.r, nr),
          r1: Math.max(a.r, nr),
          c0: Math.min(a.c, nextLogical),
          c1: Math.max(a.c, nextLogical),
        });
      } else {
        setSingleSelection(nr, nextLogical);
      }
      scheduleDraw();
      return;
    }
  }

  // Paste (Excel/Sheets): fill across visible columns
  async function onPaste(e: React.ClipboardEvent) {
    if (hdrEditing) return;

    if (editing) {
      e.preventDefault(); // prevent inserting into the input
      await commitEdit();
      // re-dispatch a synthetic paste to the host after commit
      const txt = e.clipboardData.getData("text/plain");
      if (!txt) return;
      // --- paste logic exactly as you already have (parsed / fill map / save) ---
      const rows = txt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      const parsed: string[][] = rows
          .filter((line, i) => line.length > 0 || i < rows.length - 1)
          .map(line => (line.includes("\t") ? line.split("\t") : splitCsv(line)).map(s => s ?? ""));

      const startR = Math.min(sel.r0, sel.r1);
      const startC = Math.min(sel.c0, sel.c1);

      const vis = getVisibleCols();
      let startVI = visibleIndexOf(startC);
      if (startVI === -1) startVI = 0;

      const needRows = startR + parsed.length;
      // columns are fixed; only ensure rows
      ensureSize(needRows, COLS_DEFAULT_AMOUNT);

      for (let i = 0; i < parsed.length; i++) {
        for (let j = 0; j < parsed[i].length; j++) {
          const vi = startVI + j;
          if (vi >= vis.length) break;
          const logicalC = vis[vi];
          model.current.data.set(keyOf(startR + i, logicalC), parsed[i][j]);
          // newly pasted cells are not committed yet; leave committedKeys unchanged
        }
      }

      const endVI = Math.min(startVI + (parsed[0]?.length || 1) - 1, vis.length - 1);
      setSel({
        r0: startR,
        c0: vis[startVI],
        r1: startR + parsed.length - 1,
        c1: vis[endVI],
      });
      scheduleDraw();
      requestAnimationFrame(focusHost);
      await saveSpreadsheetToIDB();
      return;
    }
  }

  function ensureSize(minRows: number, _minColsLogical: number) {
    const m = model.current;
    if (minRows > m.rows) m.rows = minRows;
    // columns are fixed; never expand beyond 50
    m.cols = COLS_DEFAULT_AMOUNT;
    ensureCols(COLS_DEFAULT_AMOUNT);

    // update spacer width based on visible count
    if (spacerRef.current) {
      const visCols = getVisibleCols().length;
      spacerRef.current.style.width = `${HDR_W + visCols * COL_W}px`;
      spacerRef.current.style.height = `${HDR_H + m.rows * ROW_H}px`;
    }
  }

  // Toolbar: add row/col / hide/unhide / show all
  async function addRowBelow() {
    const pos = Math.max(sel.r0, sel.r1) + 1;

    // Build bottom-up to avoid intermediate collisions, and DO NOT write tombstones here.
    const entries = Array.from(model.current.data.entries())
        .map(([k, v]) => ({ k, v, ...parseKey(k) }))
        .sort((a, b) => b.r - a.r); // descending by row

    const next = new Map<CellKey, string>();
    for (const e of entries) {
      const { r, c, k, v } = e;
      if (r >= pos) {
        // shift non-empty values down; skip empties (tombstones handled at save-time)
        if (v !== "") {
          next.set(keyOf(r + 1, c), v);
        }
        // do NOT set anything at old key `k` here
      } else {
        // rows above the insertion point stay unchanged (including any existing empties)
        next.set(k, v);
      }
    }
    model.current.data = next;
    // IMPORTANT: committedKeys remains unchanged; new positions are NOT committed

    model.current.rows += 1;

    ensureSize(model.current.rows, COLS_DEFAULT_AMOUNT);
    // setSel(s => ({ r0: pos, c0: s.c0, r1: pos, c1: s.c0 }));
    setSingleSelection(pos, sel.c0);
    scheduleDraw();
    requestAnimationFrame(focusHost);
    await saveSpreadsheetToIDB();
  }

  // async function addColRight() {
  //   const pos = Math.max(sel.c0, sel.c1) + 1;
  //   const next = new Map<CellKey, string>();
  //   model.current.data.forEach((v, k) => {
  //     const { r, c } = parseKey(k);
  //     if (c >= pos) next.set(keyOf(r, c + 1), v); else next.set(k, v);
  //   });
  //   model.current.data = next;
  //   model.current.cols += 1;
  //   ensureSize(model.current.rows, model.current.cols);
  //   // setSel(s => ({ r0: s.r0, c0: pos, r1: s.r0, c1: pos }));
  //   setSingleSelection(sel.r0, pos);
  //   scheduleDraw();
  //   requestAnimationFrame(focusHost);
  //   await saveSpreadsheetToIDB();
  // }

  async function deleteColumns(start: number, count: number) {
    // fixed columns: interpret Delete on full-column selection as "clear cells in these columns"
    const m = model.current;
    if (count <= 0 || start < 0 || start >= COLS_DEFAULT_AMOUNT) return;
    const end = Math.min(start + count - 1, COLS_DEFAULT_AMOUNT - 1);
    const next = new Map<CellKey, string>();

    m.data.forEach((v, k) => {
      const { r, c } = parseKey(k);
      if (c >= start && c <= end) {
        // if committed, keep empty-string; otherwise drop
        if (m.committedKeys.has(k)) {
          next.set(k, ""); // mark for IC deletion
        } // else: omit
      } else {
        next.set(k, v);
      }
    });
    // ensure committed set remains (we do not change commit state here)
    m.data = next;

    // columns meta (name/masked) remain untouched
    scheduleDraw();
    await saveSpreadsheetToIDB();
  }

  async function deleteRows(start: number, count: number) {
    const m = model.current;
    if (count <= 0 || start < 0 || start >= m.rows) return;

    const end = Math.min(start + count - 1, m.rows - 1);
    const removed = end - start + 1;

    // 1) Rebuild data:
    // - Deleted rows [start..end]: committed -> keep tombstone at SAME key (k:""); otherwise drop.
    // - Rows below (r > end): move to new row (nk), and if committed -> ALSO keep tombstone at old key (k:"").
    const next = new Map<CellKey, string>();
    const nextCommitted = new Set<string>();
    m.data.forEach((v, k) => {
      const { r, c } = parseKey(k);
      const isCommitted = m.committedKeys.has(k);
      if (r < start) {
        // unchanged
        next.set(k, v);
        if (isCommitted) nextCommitted.add(k);
      } else if (r >= start && r <= end) {
        // deleted row: commit -> tombstone at original key
        if (isCommitted) {
          next.set(k, "");    // mark deletion for IC at original position
          nextCommitted.add(k);
        }
        // uncommitted -> drop
      } else {
        // move upward
        const nk = keyOf(r - removed, c);
        next.set(nk, v);      // new position (uncommitted)
        if (isCommitted) {
          // also tombstone old position so BE deletes it
          next.set(k, "");
          nextCommitted.add(k); // keep original key as committed (BE knows this one)
        }
      }
    });
    m.data = next;
    m.committedKeys = nextCommitted;

    // 2) Adjust row count
    m.rows = Math.max(0, m.rows - removed);

    // 3) Resize spacer (height depends on row count)
    if (spacerRef.current) {
      const visCols = getVisibleCols().length;
      spacerRef.current.style.width = `${HDR_W + visCols * COL_W}px`;
      spacerRef.current.style.height = `${HDR_H + m.rows * ROW_H}px`;
    }

    // 4) Fix selection to the row that now sits at `start` (or last row)
    const destRow = Math.max(0, Math.min(start, m.rows - 1));
    setSel({
      r0: destRow,
      r1: destRow,
      c0: 0,
      c1: Math.max(0, model.current.cols - 1),
    });

    scheduleDraw();
    await saveSpreadsheetToIDB();
  }

  async function clearAll() {
    // For committed cells -> keep empty-string; for others -> drop.
    const m = model.current;
    const next = new Map<CellKey, string>();
    m.committedKeys.forEach((k) => {
      next.set(k, ""); // mark deletion for IC
    });
    m.data = next;
    scheduleDraw();
    await saveSpreadsheetToIDB();
  }

  function syncViewFromWrap() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    view.current.left = wrap.scrollLeft;
    view.current.top = wrap.scrollTop;
  }

  async function sync () {
    setSaving(true);

    try {
      await syncCurrentVaultWithBackend();
      toast.success('Successfully synced!');
    } catch (err) {
      toast.error('Could not sync with the ICP');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`sheet ${saving ? 'saving' : ''}`}>
      {/* Header / Toolbar */}
      <div className="sheet-header">
        <div className={'title-and-button'}>
          <img src={'/ghost-white.png'} alt={'logo'} className={'ghost-icon'}></img>
          <h1>Spreadsheet</h1>


          <div className="header-actions">
            <button className="gk-btn gk-btn-add" onClick={addRowBelow}>+ Row</button>
            {/*<button className="gk-btn gk-btn-add" onClick={addColRight}>+ Col</button>*/}
            <button className="gk-btn gk-btn-export" onClick={clearAll}>Clear</button>
            <button className="gk-btn gk-btn-export">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M12 4v8m0 0l-3-3m3 3l3-3m-9 8h12"/>
              </svg>
              Export
            </button>

            <button className={`gk-btn gk-btn-save ${synced ? 'synced' : 'not-synced'}`} onClick={sync}>
              {(synced ? 'Synced' : 'Sync changes')}
            </button>
          </div>
        </div>
      </div>

      {/* Scroll host */}
      <div
        className="sheet-host"
        ref={wrapRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        aria-label="Spreadsheet grid"
      >
        {/* Big spacer gives native scrollbars */}
        <div ref={spacerRef} />

        {/* Single canvas paints only the visible region */}
        <canvas ref={canvasRef} className="sheet-canvas" />

        {/* Cell editor overlay */}
        {editing && (
          <input
            className="cell-editor"
            style={{
              left: editRect.left,
              top: editRect.top,
              width: editRect.width,
              height: editRect.height
            }}
            autoFocus
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={() => {commitEdit()}}
            onMouseDown={(e) => {e.stopPropagation()}}
            onKeyDown={async (e) => {
              // Keep existing Enter/Escape behavior
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                await commitEdit();
                // Move down one row (Excel-like)
                const r = clamp(Math.min(sel.r0, sel.r1) + 1, 0, model.current.rows - 1);
                const c = Math.min(sel.c0, sel.c1);
                setSingleSelection(r, c);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancelEdit();
                return;
              }

              // NEW: Arrow navigation and Tab from inside the editor
              if (
                  e.key === "ArrowLeft" ||
                  e.key === "ArrowRight" ||
                  e.key === "ArrowUp" ||
                  e.key === "ArrowDown" ||
                  e.key === "Tab"
              ) {
                e.preventDefault();
                e.stopPropagation();

                // Commit current cell first
                await commitEdit();

                // Compute next target
                const vis = getVisibleCols();
                const curR = Math.min(sel.r0, sel.r1);
                const curC = Math.min(sel.c0, sel.c1);
                let nextR = curR;
                let nextC = curC;

                if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) nextC = clamp(curC - 1, 0, COLS_DEFAULT_AMOUNT - 1);
                if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) nextC = clamp(curC + 1, 0, COLS_DEFAULT_AMOUNT - 1);
                if (e.key === "ArrowUp") nextR = clamp(curR - 1, 0, model.current.rows - 1);
                if (e.key === "ArrowDown") nextR = clamp(curR + 1, 0, model.current.rows - 1);

                setSingleSelection(nextR, nextC);
              }
            }}
          />
        )}

        {/* Column header editor overlay */}
        {hdrEditing && (
          <input
            className="cell-editor col-editor"
            style={{
              left: hdrEditing.rect.left,
              top: hdrEditing.rect.top,
              width: hdrEditing.rect.width,
              height: hdrEditing.rect.height
            }}
            autoFocus
            value={hdrEditing.value}
            onChange={(e) => setHdrEditing({ ...hdrEditing, value: e.target.value })}
            onBlur={commitHdrEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                commitHdrEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancelHdrEdit();
              }
            }}
          />
        )}
      </div>
    </section>
  );
}
