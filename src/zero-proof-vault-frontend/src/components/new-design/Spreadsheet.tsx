import React from "react";
import { getOrCreateFactoryCanisterActor, getOrCreateSharedCanisterActor } from "../../utility/api";
import { HttpAgent } from "@dfinity/agent";

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

type ColumnMeta = { name: string; hidden: boolean };

export default function SpreadsheetCanvas(): JSX.Element {
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

  // Selection / editor
  const [sel, setSel] = React.useState({ r0: 0, c0: 0, r1: 0, c1: 0 });
  const [editing, setEditing] = React.useState(false);
  const [editVal, setEditVal] = React.useState("");
  const [editRect, setEditRect] = React.useState<{left:number;top:number;width:number;height:number}>({left:0,top:0,width:0,height:0});

  // Header editing
  const [hdrEditing, setHdrEditing] = React.useState<null | { c: number; value: string; rect: {left:number;top:number;width:number;height:number} }>(null);

  // Scroll + viewport (in refs; we only redraw canvas, no re-render)
  const view = React.useRef({ left: 0, top: 0, w: 800, h: 600 });
  const rafId = React.useRef<number | 0>(0);
  const dragging = React.useRef<{ anchorR:number; anchorC:number } | null>(null);

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
    const rStart = Math.max(0, Math.floor((top  - HDR_H) / ROW_H));
    const rVis   = Math.ceil(h / ROW_H) + OVERSCAN;
    const rEnd   = clamp(rStart + rVis, 0, rows);

    const visStart = Math.max(0, Math.floor((left - HDR_W) / COL_W));
    const visCount = Math.ceil(h > 0 ? w / COL_W : 0) + OVERSCAN;
    const visEnd   = clamp(visStart + visCount, 0, vis.length);

    // translate world->view
    ctx.save();
    ctx.translate(-left, -top);

    // Headers background blocks
    ctx.fillStyle = "#1c2754";
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
        const x = HDR_W + i * COL_W + PADDING_X;
        const y = HDR_H + r * ROW_H + ROW_H / 2;
        ctx.fillText(v, x, y, COL_W - PADDING_X * 2);
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
      spacer.style.width  = `${HDR_W + visCols * COL_W}px`;
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
        view.current.top  = wrap.scrollTop;
        canvas.style.transform = `translate3d(${view.current.left}px, ${view.current.top}px, 0)`;

        // keep overlays aligned
        if (editing) {
          const { r0, c0 } = sel;
          const vi = visibleIndexOf(c0);
          if (vi !== -1) {
            setEditRect({
              left: HDR_W + vi * COL_W - view.current.left,
              top:  HDR_H + r0 * ROW_H - view.current.top,
              width: COL_W,
              height: ROW_H,
            });
          }
        }
        if (hdrEditing) {
          const vi = visibleIndexOf(hdrEditing.c);
          if (vi !== -1) {
            const rect = {
              left: HDR_W + vi * COL_W - view.current.left,
              top:  0 - view.current.top,
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

  const scheduleDraw = () => {
    if (!rafId.current) rafId.current = requestAnimationFrame(() => { rafId.current = 0; drawNow(); });
  };

  // --- Column helpers (names + hidden) ---
  function ensureCols(n: number) {
    const m = model.current;
    if (m.columns.length < n) {
      for (let i = m.columns.length; i < n; i++) {
        m.columns.push({ name: colName(i), hidden: false });
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
  function toggleHidden(c: number, hidden: boolean) {
    ensureCols(c + 1);
    model.current.columns[c].hidden = hidden;
    // if selection is on hidden col, move to next visible
    if (hidden) {
      const next = nextVisibleCol(c);
      if (next !== -1) setSel(s => ({ ...s, c0: next, c1: next }));
      else {
        const prev = prevVisibleCol(c);
        if (prev !== -1) setSel(s => ({ ...s, c0: prev, c1: prev }));
      }
    }
    // update spacer width
    if (spacerRef.current) {
      const visCols = getVisibleCols().length;
      spacerRef.current.style.width  = `${HDR_W + visCols * COL_W}px`;
    }
  }
  function getVisibleCols(): number[] {
    ensureCols(model.current.cols);
    const out: number[] = [];
    for (let i = 0; i < model.current.cols; i++) if (!model.current.columns[i].hidden) out.push(i);
    return out;
  }
  function visibleIndexOf(c: number): number {
    if (c < 0 || c >= model.current.cols) return -1;
    if (model.current.columns[c]?.hidden) return -1;
    let count = 0;
    for (let i = 0; i < c; i++) if (!model.current.columns[i]?.hidden) count++;
    return count;
  }
  function logicalFromVisibleIndex(vi: number): number {
    ensureCols(model.current.cols);
    let count = 0;
    for (let c = 0; c < model.current.cols; c++) {
      if (!model.current.columns[c].hidden) {
        if (count === vi) return c;
        count++;
      }
    }
    return -1;
  }
  function nextVisibleCol(c: number): number {
    for (let i = c + 1; i < model.current.cols; i++) if (!model.current.columns[i].hidden) return i;
    return -1;
  }
  function prevVisibleCol(c: number): number {
    for (let i = c - 1; i >= 0; i--) if (!model.current.columns[i].hidden) return i;
    return -1;
  }

  // Map mouse coords -> hit (header/cell) respecting hidden columns
  function hitTest(clientX: number, clientY: number):
      | { kind: "cell"; r: number; c: number; x: number; y: number }
      | { kind: "colhdr"; c: number; x: number }
      | null {
    const wrap = wrapRef.current!;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left + view.current.left;
    const y = clientY - rect.top  + view.current.top;

    if (x < HDR_W && y < HDR_H) return null; // corner
    if (y < HDR_H && x >= HDR_W) {
      // Column header; translate x to visible index then logical col
      const vi = Math.floor((x - HDR_W) / COL_W);
      const c = logicalFromVisibleIndex(vi);
      if (c === -1) return null;
      return { kind: "colhdr", c, x };
    }
    if (x < HDR_W || y < HDR_H) return null;
    const vi = Math.floor((x - HDR_W) / COL_W);
    const c = logicalFromVisibleIndex(vi);
    if (c === -1) return null;
    const r = Math.floor((y - HDR_H) / ROW_H);
    return { kind: "cell", r, c, x, y };
  }

  // Mouse selection / header rename
  function onMouseDown(e: React.MouseEvent) {
    if (hdrEditing) return; // let header input handle
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    if (hit.kind === "colhdr") {
      // Select entire column on click
      setEditing(false);
      setSel(s => ({ r0: 0, r1: model.current.rows - 1, c0: hit.c, c1: hit.c }));
      scheduleDraw();
      return;
    }

    // cell selection drag
    setEditing(false);
    setSel({ r0: hit.r, c0: hit.c, r1: hit.r, c1: hit.c });
    dragging.current = { anchorR: hit.r, anchorC: hit.c };
    scheduleDraw();

    const onMove = (ev: MouseEvent) => {
      const h = hitTest(ev.clientX, ev.clientY);
      if (!h || h.kind !== "cell" || !dragging.current) return;
      setSel(s => ({
        ...s,
        r1: clamp(h.r, 0, model.current.rows - 1),
        c1: clamp(h.c, 0, model.current.cols - 1),
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

  function onDoubleClick(e: React.MouseEvent) {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.kind === "colhdr") {
      // Begin header edit
      const vi = visibleIndexOf(hit.c);
      if (vi === -1) return;
      const rect = {
        left: HDR_W + vi * COL_W - view.current.left,
        top:  0 - view.current.top,
        width: COL_W,
        height: HDR_H,
      };
      setHdrEditing({ c: hit.c, value: getColName(hit.c), rect });
      return;
    }
    if (hit.kind === "cell") beginEdit(hit.r, hit.c);
  }

  function beginEdit(r: number, c: number) {
    const val = model.current.data.get(keyOf(r, c)) ?? "";
    const vi = visibleIndexOf(c);
    if (vi === -1) return; // hidden
    setEditVal(val);
    setEditing(true);
    setSel({ r0: r, c0: c, r1: r, c1: c });
    setEditRect({
      left: HDR_W + vi * COL_W - view.current.left,
      top:  HDR_H + r * ROW_H - view.current.top,
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
    scheduleDraw();
  }
  function cancelEdit() {
    setEditing(false);
    scheduleDraw();
  }

  // Header edit actions
  function commitHdrEdit() {
    if (!hdrEditing) return;
    const { c, value } = hdrEditing;
    setColName(c, value.trim());
    setHdrEditing(null);
    scheduleDraw();
  }
  function cancelHdrEdit() {
    setHdrEditing(null);
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

    // Toggle hide current column: Ctrl/Cmd + H
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
      e.preventDefault();
      const hidden = !model.current.columns[c]?.hidden;
      toggleHidden(c, hidden);
      scheduleDraw();
      return;
    }

    // Copy selection (TSV)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const tsv = exportRange(sel, model.current);
      navigator.clipboard.writeText(tsv).catch(() => {});
      return;
    }

    // Enter = edit
    if (e.key === "Enter") { e.preventDefault(); beginEdit(r, c); return; }

    // Navigation (skips hidden columns)
    if (e.key.startsWith("Arrow") || e.key === "Tab") {
      e.preventDefault();
      let nr = r, nc = c;
      const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      let dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (e.key === "Tab") { if (e.shiftKey) dc = -1; else dc = 1; }

      nr = clamp(nr + dr, 0, model.current.rows - 1);

      // Move across visible columns only
      let vi = visibleIndexOf(nc);
      if (vi === -1) vi = 0;
      vi = clamp(vi + dc, 0, getVisibleCols().length - 1);
      const nextLogical = logicalFromVisibleIndex(vi);
      nc = nextLogical === -1 ? nc : nextLogical;

      setSel({ r0: nr, c0: nc, r1: nr, c1: nc });
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
  }

  function ensureSize(minRows: number, minColsLogical: number) {
    const m = model.current;
    if (minRows > m.rows) m.rows = minRows;
    if (minColsLogical > m.cols) m.cols = minColsLogical;
    ensureCols(m.cols);
    // update spacer width based on visible count
    if (spacerRef.current) {
      const visCols = getVisibleCols().length;
      spacerRef.current.style.width  = `${HDR_W + visCols * COL_W}px`;
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
    setSel(s => ({ r0: pos, c0: s.c0, r1: pos, c1: s.c0 }));
    scheduleDraw();
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
    setSel(s => ({ r0: s.r0, c0: pos, r1: s.r0, c1: pos }));
    scheduleDraw();
  }
  function hideSelectedCol() {
    const c = Math.min(sel.c0, sel.c1);
    toggleHidden(c, true);
    scheduleDraw();
  }
  function unhideSelectedCol() {
    const c = Math.min(sel.c0, sel.c1);
    toggleHidden(c, false);
    scheduleDraw();
  }
  function showAllCols() {
    ensureCols(model.current.cols);
    for (let i = 0; i < model.current.cols; i++) model.current.columns[i].hidden = false;
    if (spacerRef.current) {
      spacerRef.current.style.width = `${HDR_W + model.current.cols * COL_W}px`;
    }
    scheduleDraw();
  }
  function clearAll() {
    model.current.data.clear();
    scheduleDraw();
  }

  // Testing backend canister | THIS IS ONLY FOR TESTING
  const makeCallToFactory = async () => {
    console.log("Testing canister calls");
    const agent = await HttpAgent.create();
    const factoryActor = await getOrCreateFactoryCanisterActor("uxrrr-q7777-77774-qaaaq-cai", agent);
    console.log(factoryActor);
    const testCreatingSharedCanister = await factoryActor.get_or_create_shared_vault();
    console.log(testCreatingSharedCanister);
    const sharedActor = await getOrCreateSharedCanisterActor(testCreatingSharedCanister, agent);
    const addUserToShared = await sharedActor.add_user(testCreatingSharedCanister);
    console.log(addUserToShared);
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
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 4v8m0 0l-3-3m3 3l3-3m-9 8h12"/>
                </svg>
                Export
              </button>
              <button className="gk-btn gk-btn-save" onClick={hideSelectedCol}
                      title="Hide selected column (Ctrl/Cmd+H)">
                Hide col
              </button>
              <button className="gk-btn gk-btn-save" onClick={unhideSelectedCol}>Unhide col</button>
              <button className="gk-btn gk-btn-save" onClick={showAllCols}>Show all</button>

              <button className="gk-btn gk-btn-save" onClick={makeCallToFactory}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
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
          <div ref={spacerRef}/>

          {/* Single canvas paints only the visible region */}
          <canvas ref={canvasRef} className="sheet-canvas"/>

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
                      commitEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
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
                  onChange={(e) => setHdrEditing({...hdrEditing, value: e.target.value})}
                  onBlur={commitHdrEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitHdrEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
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