export const keyOf = (r: number, c: number): string => `${r},${c}`;

export const parseKey = (k: string) => {
  const i = k.indexOf(",");
  return { r: +k.slice(0, i), c: +k.slice(i + 1) };
};

export const drawEye = (ctx: CanvasRenderingContext2D, x: number, y: number, masked: boolean) => {
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

export const pointInRect = (px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean => {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export const clamp = (n: number, min: number, max: number) => {
  return n < min ? min : n > max ? max : n;
}

export const colName = (idx: number) => { // A..Z, AA..AB
  let n = idx + 1, out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export const splitCsv = (line: string): string[] => {
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

export const fitCanvasToCSSPixels = (canvas: HTMLCanvasElement, cssW: number, cssH: number) => {
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

export const exportRange = (sel: { r0: number; c0: number; r1: number; c1: number }, m: {
  data: Map<string, string>
}): string => {
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

export const isSingle = (s: {r0:number;c0:number;r1:number;c1:number}) =>
    s.r0 === s.r1 && s.c0 === s.c1;