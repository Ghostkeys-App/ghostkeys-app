import React from "react";
import { getOrCreateFactoryCanisterActor, getOrCreateSharedCanisterActor } from "../../utility/api";
import { HttpAgent } from "@dfinity/agent";
import { ghostkeysStorage } from "../../storage/IDBService.ts";
import { useIdentitySystem } from "../../utility/identity";
import { generateSeedAndIdentityPrincipal } from "../../utility/crypto/encdcrpt.ts";
import { VaultData } from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import { useAPIContext } from "../../utility/api/APIContext.tsx";

type CellKey = string; // "r,c"
const keyOf = (r: number, c: number): CellKey => `${r},${c}`;
const parseKey = (k: CellKey) => {
  const i = k.indexOf(",");
  return { r: +k.slice(0, i), c: +k.slice(i + 1) };
};

// --- Tunables ---
const ROW_H = 30;
const COL_W = 120;
const HDR_H = 36;
const HDR_W = 60;
const PADDING_X = 8;
const OVERSCAN = 2;

type ColumnMeta = { name: string; masked: boolean };

export default function SpreadsheetCanvas(): JSX.Element {
  const { currentProfile } = useIdentitySystem();
  const { getSharedVaultCanisterAPI } = useAPIContext();
  const id = currentProfile.principal.toString();
  const currentVaultId = "default";

  // Sparse model + column metadata
  const model = React.useRef({
    rows: 200,
    cols: 50,
    data: new Map<CellKey, string>(),
    columns: [] as ColumnMeta[], // length === cols (lazily filled)
  });

  // View refs
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<{ r: number; c: number }>({ r: 0, c: 0 });
  const hdrIconRectsRef = React.useRef<Array<{ c: number; x: number; y: number; w: number; h: number }>>([]);
  const lastIconToggleAtRef = React.useRef(0);

  // Selection / editor
  const [sel, setSel] = React.useState({ r0: 0, c0: 0, r1: 0, c1: 0 });
  const [editing, setEditing] = React.useState(false);
  const [editVal, setEditVal] = React.useState("");
  const [editRect, setEditRect] = React.useState<{ left: number; top: number; width: number; height: number }>({ left: 0, top: 0, width: 0, height: 0 });

  // Header editing
  const [hdrEditing, setHdrEditing] = React.useState<null | { c: number; value: string; rect: { left: number; top: number; width: number; height: number } }>(null);

  // Scroll + viewport (in refs; we only redraw canvas, no re-render)
  const view = React.useRef({ left: 0, top: 0, w: 800, h: 600 });
  const rafId = React.useRef<number | 0>(0);
  const dragging = React.useRef<{ anchorR: number; anchorC: number } | null>(null);

  function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, masked: boolean) {
    // minimalist eye / eye-off in ~12px box
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = masked ? "#93b4ff" : "#bcd3ff";

    // eye outline
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.quadraticCurveTo(0, -5, 5, 0);
    ctx.quadraticCurveTo(0, 5, -5, 0);
    ctx.stroke();

    // pupil
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
    ctx.stroke();

    if (masked) {
      // slash
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pointInRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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

  function toggleMasked(c: number) {
    ensureCols(c + 1);
    model.current.columns[c].masked = !model.current.columns[c].masked;
    saveSpreadsheetToIDB();
  }

  // Draw (respects hidden columns)
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

    // translate world->view
    ctx.save();
    ctx.translate(-left, -top);

    // Headers background blocks
    ctx.fillStyle = "#1c2754";
    hdrIconRectsRef.current = [];
    // Column headers
    for (let i = visStart; i < visEnd; i++) {
      const c = vis[i];
      const x = HDR_W + i * COL_W;
      ctx.fillRect(x, 0, COL_W, HDR_H);
      ctx.fillStyle = "#dfe7ff";
      ctx.font = "600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textBaseline = "middle";
      ctx.fillText(getColName(c), x + PADDING_X, HDR_H / 2);
      ctx.fillStyle = "#1c2754";
      // icon rect (right-aligned inside the header cell)
      const iconSize = 14;
      const padRight = 6;
      const iconX = x + COL_W - padRight - iconSize / 2; // center point
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
      ctx.fillStyle = "#1c2754";
      ctx.fillRect(0, y, HDR_W, ROW_H);
      ctx.fillStyle = "#dfe7ff";
      ctx.font = "600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textBaseline = "middle";
      ctx.fillText(String(r + 1), HDR_W / 2 - 6, y + ROW_H / 2);
    }
    // Corner
    ctx.fillStyle = "#1c2754";
    ctx.fillRect(0, 0, HDR_W, HDR_H);

    // Cells background
    ctx.fillStyle = "#16214a";
    ctx.fillRect(HDR_W, HDR_H, vis.length * COL_W, rows * ROW_H);

    // banding
    ctx.fillStyle = "#18234f";
    for (let r = rStart; r < rEnd; r += 2) {
      const y = HDR_H + r * ROW_H;
      ctx.fillRect(HDR_W, y, vis.length * COL_W, ROW_H);
    }

    // grid lines
    ctx.strokeStyle = "#233060";
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
    ctx.font = "13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.textBaseline = "middle";
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
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
      ctx.shadowColor = "rgba(37,99,235,.35)";
      ctx.shadowBlur = 8;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }, [sel]);

  React.useEffect(() => {
    (async () => {
      const vault = await ghostkeysStorage.getVault(id, currentVaultId);
      console.log(123, vault)
      if (!vault) return;

      applySpreadsheetFromVault({
        flexible_grid_columns: vault.data.flexible_grid_columns?.map(c => ({
          name: c.name,
          meta: { index: c.meta.index, hidden: c.meta.hidden }
        })) ?? [],
        flexible_grid: vault.data.flexible_grid?.map(cell => ({
          key: { row: cell.key.row, col: cell.key.col },
          value: cell.value
        })) ?? []
      });
    })();
  }, []);

  // // Demo seed
  // React.useEffect(() => {
  //   const m = model.current;
  //   if (m.data.size === 0) {
  //     for (let r = 0; r < 30; r++) m.data.set(keyOf(r, 0), String(r + 1));
  //     m.data.set(keyOf(0, 1), "Ghostkeys");
  //     m.data.set(keyOf(1, 1), "Cinematic • Blue • Fast");
  //     m.data.set(keyOf(2, 2), "Paste from Excel →");
  //   }
  //   // init column meta names A, B, C… and visible
  //   ensureCols(m.cols);
  //   drawNow();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

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
              left: HDR_W + vi * COL_W,        // ← world coords
              top: HDR_H + r0 * ROW_H,        // ← world coords
              width: COL_W,
              height: ROW_H,
            });
          }
        }
        if (hdrEditing) {
          const vi = visibleIndexOf(hdrEditing.c);
          if (vi !== -1) {
            const rect = {
              left: HDR_W + vi * COL_W,        // ← world X
              top: view.current.top,          // ← stick to visible header stripe
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

  const scheduleDraw = () => {
    if (!rafId.current) rafId.current = requestAnimationFrame(() => { rafId.current = 0; drawNow(); });
  };

  // whenever you want a single-cell selection (no shift), call:
  function setSingleSelection(r: number, c: number) {
    anchorRef.current = { r, c };
    setSel({ r0: r, c0: c, r1: r, c1: c });
  }

  // --- Column helpers (names + hidden) ---
  function ensureCols(n: number) {
    const m = model.current;
    if (m.columns.length < n) {
      for (let i = m.columns.length; i < n; i++) {
        m.columns.push({ name: colName(i), masked: false }); // ← masked
      }
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
    // all logical columns are visible now
    ensureCols(model.current.cols);
    return Array.from({ length: model.current.cols }, (_, i) => i);
  }
  function visibleIndexOf(c: number): number {
    // identity mapping as nothing is hidden
    return (c >= 0 && c < model.current.cols) ? c : -1;
  }
  function logicalFromVisibleIndex(vi: number): number {
    // identity mapping as nothing is hidden
    return (vi >= 0 && vi < model.current.cols) ? vi : -1;
  }

  async function saveSpreadsheetToIDB() {
    const m = model.current;

    // flatten sparse map
    const flexible_grid = [];
    for (const [k, v] of m.data.entries()) {
      const { r, c } = parseKey(k);
      if (v != null && v !== "") flexible_grid.push({ key: { col: c, row: r }, value: v });
    }

    // columns meta
    ensureCols(m.cols);
    const flexible_grid_columns = m.columns.map((col, index) => ({
      name: col.name,
      meta: {
        index,
        hidden: col.masked,
      }
    }));

    await ghostkeysStorage.setFlexGrid(id, currentVaultId, {
      cells: flexible_grid,
      columns: flexible_grid_columns,
    });
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
    focusHost(); // keep keyboard on grid
    if (hdrEditing) return;

    // 1) mask icon hit?
    const maskCol = hitMaskIcon(e.clientX, e.clientY);
    if (maskCol != null) {
      toggleMasked(maskCol);
      lastIconToggleAtRef.current = performance.now();
      scheduleDraw();
      return; // don't fall through to column selection
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
        left: HDR_W + vi * COL_W,          // ← world X
        top: view.current.top,            // ← sticky header Y
        width: COL_W,
        height: HDR_H,
      };
      setHdrEditing({ c: hit.c, value: getColName(hit.c), rect });
      return;
    }

    if (hit.kind === "cell") {
      beginEdit(hit.r, hit.c);
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
  function commitEdit() {
    const { r0, c0 } = sel;
    const k = keyOf(r0, c0);
    if (editVal === "") model.current.data.delete(k);
    else model.current.data.set(k, editVal);
    setEditing(false);
    requestAnimationFrame(focusHost);
    scheduleDraw();
    saveSpreadsheetToIDB();
  }
  function cancelEdit() {
    setEditing(false);
    requestAnimationFrame(focusHost);
    scheduleDraw();
  }

  // Header edit actions
  function commitHdrEdit() {
    if (!hdrEditing) return;
    const { c, value } = hdrEditing;
    setColName(c, value.trim());
    setHdrEditing(null);
    requestAnimationFrame(focusHost);
    scheduleDraw();
  }
  function cancelHdrEdit() {
    setHdrEditing(null);
    requestAnimationFrame(focusHost);
    scheduleDraw();
  }

  // Keyboard: nav, copy, edit, hide/unhide
  function onKeyDown(e: React.KeyboardEvent) {
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
          m.data.delete(keyOf(r, c));
        }
      }
      scheduleDraw();
      saveSpreadsheetToIDB();
      return;
    }

    if (e.key.startsWith("Arrow") || e.key === "Tab") {
      e.preventDefault();
      const shift = e.shiftKey;

      // direction
      const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;

      // ✅ FIX: choose the correct row edge when shift-extending
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
        return; // <-- important: skip the horizontal logic below
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
  function onPaste(e: React.ClipboardEvent) {
    if (editing || hdrEditing) return; // let input handle it
    const txt = e.clipboardData.getData("text/plain");
    if (!txt) return;
    e.preventDefault();

    const rows = txt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const parsed: string[][] = rows
      .filter((line, i) => line.length > 0 || i < rows.length - 1)
      .map(line => (line.includes("\t") ? line.split("\t") : splitCsv(line)).map(s => s ?? ""));

    const startR = Math.min(sel.r0, sel.r1);
    const startC = Math.min(sel.c0, sel.c1);

    // Build visible list so we can skip hidden cols while pasting
    const vis = getVisibleCols();
    let startVI = visibleIndexOf(startC);
    if (startVI === -1) startVI = 0;

    const needRows = startR + parsed.length;
    const needCols = vis[startVI] + (parsed[0]?.length || 1);
    ensureSize(needRows, needCols);

    for (let i = 0; i < parsed.length; i++) {
      for (let j = 0; j < parsed[i].length; j++) {
        const vi = startVI + j;
        if (vi >= vis.length) break;
        const logicalC = vis[vi];
        model.current.data.set(keyOf(startR + i, logicalC), parsed[i][j]);
      }
    }
    // Update selection to pasted rect (visible columns)
    const endVI = Math.min(startVI + (parsed[0]?.length || 1) - 1, vis.length - 1);
    setSel({
      r0: startR,
      c0: vis[startVI],
      r1: startR + parsed.length - 1,
      c1: vis[endVI],
    });
    scheduleDraw();
    requestAnimationFrame(focusHost);
  }

  function ensureSize(minRows: number, minColsLogical: number) {
    const m = model.current;
    if (minRows > m.rows) m.rows = minRows;
    if (minColsLogical > m.cols) m.cols = minColsLogical;
    ensureCols(m.cols);
    // update spacer width based on visible count
    if (spacerRef.current) {
      const visCols = getVisibleCols().length;
      spacerRef.current.style.width = `${HDR_W + visCols * COL_W}px`;
      spacerRef.current.style.height = `${HDR_H + m.rows * ROW_H}px`;
    }
  }

  // Toolbar: add row/col / hide/unhide / show all
  function addRowBelow() {
    const pos = Math.max(sel.r0, sel.r1) + 1;
    const next = new Map<CellKey, string>();
    model.current.data.forEach((v, k) => {
      const { r, c } = parseKey(k);
      if (r >= pos) next.set(keyOf(r + 1, c), v); else next.set(k, v);
    });
    model.current.data = next;
    model.current.rows += 1;
    ensureSize(model.current.rows, model.current.cols);
    // setSel(s => ({ r0: pos, c0: s.c0, r1: pos, c1: s.c0 }));
    setSingleSelection(pos, sel.c0);
    scheduleDraw();
    requestAnimationFrame(focusHost);
    saveSpreadsheetToIDB();
  }
  function addColRight() {
    const pos = Math.max(sel.c0, sel.c1) + 1;
    const next = new Map<CellKey, string>();
    model.current.data.forEach((v, k) => {
      const { r, c } = parseKey(k);
      if (c >= pos) next.set(keyOf(r, c + 1), v); else next.set(k, v);
    });
    model.current.data = next;
    model.current.cols += 1;
    ensureSize(model.current.rows, model.current.cols);
    // setSel(s => ({ r0: s.r0, c0: pos, r1: s.r0, c1: pos }));
    setSingleSelection(sel.r0, pos);
    scheduleDraw();
    requestAnimationFrame(focusHost);
    saveSpreadsheetToIDB();
  }

  function deleteColumns(start: number, count: number) {
    const m = model.current;
    if (count <= 0 || start < 0 || start >= m.cols) return;

    const end = Math.min(start + count - 1, m.cols - 1);
    const removed = end - start + 1;

    // 1) Rebuild columns array (drop [start..end])
    m.columns = m.columns.filter((_, idx) => idx < start || idx > end);
    m.cols = m.columns.length;

    // 2) Rebuild data map: drop cells in deleted range; shift the rest left
    const next = new Map<CellKey, string>();
    m.data.forEach((v, k) => {
      const { r, c } = parseKey(k);
      if (c < start) {
        next.set(k, v); // unchanged
      } else if (c >= start && c <= end) {
        // dropped
      } else {
        // shift left by removed
        next.set(keyOf(r, c - removed), v);
      }
    });
    m.data = next;

    // 3) Resize spacer (width depends on column count)
    if (spacerRef.current) {
      const visCols = getVisibleCols().length;
      spacerRef.current.style.width = `${HDR_W + visCols * COL_W}px`;
      spacerRef.current.style.height = `${HDR_H + m.rows * ROW_H}px`;
    }

    // 4) Fix selection to the column that now sits at `start` (or last col)
    const destCol = Math.max(0, Math.min(start, m.cols - 1));
    setSel({
      r0: 0,
      r1: Math.max(0, m.rows - 1),
      c0: destCol,
      c1: destCol,
    });

    scheduleDraw();
    saveSpreadsheetToIDB();
  }

  function deleteRows(start: number, count: number) {
    const m = model.current;
    if (count <= 0 || start < 0 || start >= m.rows) return;

    const end = Math.min(start + count - 1, m.rows - 1);
    const removed = end - start + 1;

    // 1) Rebuild data: drop rows in [start..end]; shift above stays, below shifts up
    const next = new Map<CellKey, string>();
    m.data.forEach((v, k) => {
      const { r, c } = parseKey(k);
      if (r < start) {
        next.set(k, v);
      } else if (r >= start && r <= end) {
        // dropped
      } else {
        next.set(keyOf(r - removed, c), v);
      }
    });
    m.data = next;

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
    saveSpreadsheetToIDB();
  }

  function clearAll() {
    model.current.data.clear();
    scheduleDraw();
  }

  function syncViewFromWrap() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    view.current.left = wrap.scrollLeft;
    view.current.top = wrap.scrollTop;
  }

  // Call this with the object returned by makeSeedVault().data for a vault
  function applySpreadsheetFromVault(vault: {
    flexible_grid_columns?: Array<{ name: string; meta: { index: number; hidden: boolean } }>;
    flexible_grid?: Array<{ key: { row: number; col: number }; value: string }>;
  }) {
    const m = model.current;

    // ----- Columns -----
    m.columns = [];           // reset columns
    m.cols = 0;

    if (Array.isArray(vault.flexible_grid_columns) && vault.flexible_grid_columns.length > 0) {
      // compute how many columns we need based on highest index
      const maxIdx = vault.flexible_grid_columns.reduce(
        (acc, col) => Math.max(acc, Number(col?.meta?.index ?? 0)),
        0
      );
      // prefill with defaults up to maxIdx
      for (let i = 0; i <= maxIdx; i++) {
        m.columns[i] = { name: colName(i), masked: false };
      }
      // place each configured column at its declared index
      for (const col of vault.flexible_grid_columns) {
        const idx = Number(col.meta?.index ?? 0);
        m.columns[idx] = {
          name: String(col.name ?? colName(idx)),
          masked: Boolean(col.meta?.hidden),
        };
      }
      m.cols = m.columns.length;
    } else {
      // no columns provided → keep an empty set
      m.columns = [];
      m.cols = 0;
    }

    // ----- Cells -----
    m.data.clear();
    let maxRow = 0;

    if (Array.isArray(vault.flexible_grid)) {
      for (const cell of vault.flexible_grid) {
        const r = Number(cell?.key?.row ?? 0);
        const c = Number(cell?.key?.col ?? 0);
        const v = cell?.value ?? "";
        // ignore out-of-range cols (in case data refers to a column beyond declared columns)
        if (c < 0 || c >= m.columns.length) continue;
        if (v == null || v === "") continue;

        m.data.set(keyOf(r, c), String(v));
        if (r > maxRow) maxRow = r;
      }
    }

    // ----- Rows / spacer -----
    m.rows = Math.max(m.rows, maxRow + 1);

    if (spacerRef.current) {
      const visCols = getVisibleCols().length; // uses current hidden flags
      spacerRef.current.style.width = `${HDR_W + visCols * COL_W}px`;
      spacerRef.current.style.height = `${HDR_H + m.rows * ROW_H}px`;
    }

    // Optional: reset selection to A1 if desired
    setSel({ r0: 0, c0: 0, r1: 0, c1: 0 });

    // Redraw
    requestAnimationFrame(() => {
      // keep canvas pinned if you rely on transform sync
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (wrap && canvas) {
        canvas.style.transform = `translate3d(${wrap.scrollLeft}px, ${wrap.scrollTop}px, 0)`;
      }
    });
    // trigger a draw
    (function scheduleDraw() {
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = 0;
          drawNow();
        });
      }
    })();
  }

  generateSeedAndIdentityPrincipal().then(res => console.log(res.principal.toString()));

  // Testing backend canister | THIS IS ONLY FOR TESTING
  const makeCallToFactory = async () => {
    console.log("Testing canister calls");

    const { principal: vaultId } = await generateSeedAndIdentityPrincipal();
    console.log('user', id);
    console.log('vault', vaultId);
    const data: VaultData = {
      'vault_name': 'Vault1',
      'flexible_grid_columns': [['Col1', [1, true]]],
      'secure_notes': [['Secure', 'Note']],
      'flexible_grid': [[{'col': 1, row: 2}, 'Value']],
      'website_logins': [['Google', [['test', 'pass']]]],
    };
    console.log('data before', data);
    const sharedActor = await getSharedVaultCanisterAPI();
    const addToShared = await sharedActor.add_or_update_vault(id, vaultId.toString(), data);
    console.log(addToShared);
    
    const getData = await sharedActor.get_all_vaults_for_user(id);
    console.log("data for user", getData);
  }

  return (
    <section className="sheet">
      {/* Header / Toolbar */}
      <div className="sheet-header">
        <div className={'title-and-button'}>
          <img src={'/ghost-white.png'} alt={'logo'} className={'ghost-icon'}></img>
          <h1>Spreadsheet</h1>


          <div className="header-actions">
            <button className="gk-btn gk-btn-add" onClick={addRowBelow}>+ Row</button>
            <button className="gk-btn gk-btn-add" onClick={addColRight}>+ Col</button>
            <button className="gk-btn gk-btn-export" onClick={clearAll}>Clear</button>
            <button className="gk-btn gk-btn-export">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 4v8m0 0l-3-3m3 3l3-3m-9 8h12" />
              </svg>
              Export
            </button>

            <button className="gk-btn gk-btn-save" onClick={makeCallToFactory}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
              Save
            </button>
          </div>
        </div>
      </div>

      {/*<div className="sheet-head">*/}
      {/*  <div className="sheet-title">*/}
      {/*    <span className="sheet-ghost">👻</span>*/}
      {/*    <h1>Spreadsheet</h1>*/}
      {/*  </div>*/}
      {/*  <div className="sheet-actions" style={{display: "flex", gap: 10}}>*/}
      {/*    <button className="gk-btn gk-btn-add" onClick={addRowBelow}>+ Row</button>*/}
      {/*    <button className="gk-btn gk-btn-add" onClick={addColRight}>+ Col</button>*/}

      {/*    <button className="gk-btn gk-btn-save" onClick={hideSelectedCol} title="Hide selected column (Ctrl/Cmd+H)">*/}
      {/*      Hide col*/}
      {/*    </button>*/}
      {/*    <button className="gk-btn gk-btn-save" onClick={unhideSelectedCol}>Unhide col</button>*/}
      {/*    <button className="gk-btn gk-btn-save" onClick={showAllCols}>Show all</button>*/}

      {/*    <button className="gk-btn gk-btn-export" onClick={clearAll}>Clear</button>*/}
      {/*  </div>*/}
      {/*</div>*/}

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
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                commitEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancelEdit();
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

// --- Helpers ---
function clamp(n: number, min: number, max: number) {
  return n < min ? min : n > max ? max : n;
}

function colName(idx: number) { // A..Z, AA..AB
  let n = idx + 1, out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function fitCanvasToCSSPixels(canvas: HTMLCanvasElement, cssW: number, cssH: number) {
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.floor(cssW * dpr);
  const displayHeight = Math.floor(cssH * dpr);
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
}

function exportRange(sel: { r0: number; c0: number; r1: number; c1: number }, m: {
  data: Map<string, string>
}): string {
  const R0 = Math.min(sel.r0, sel.r1), R1 = Math.max(sel.r0, sel.r1);
  const C0 = Math.min(sel.c0, sel.c1), C1 = Math.max(sel.c0, sel.c1);
  let out: string[] = [];
  for (let r = R0; r <= R1; r++) {
    let row: string[] = [];
    for (let c = C0; c <= C1; c++) {
      row.push(m.data.get(keyOf(r, c)) ?? "");
    }
    out.push(row.join("\t"));
  }
  return out.join("\n");
}