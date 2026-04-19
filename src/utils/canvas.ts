export interface Point { x: number; y: number; }

// ── Flood fill ────────────────────────────────────────────────────────────────

export function floodFill(canvas: HTMLCanvasElement | OffscreenCanvas, x: number, y: number, fillHex: string, tolerance = 15) {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;

  const fr = parseInt(fillHex.slice(1, 3), 16);
  const fg = parseInt(fillHex.slice(3, 5), 16);
  const fb = parseInt(fillHex.slice(5, 7), 16);
  const fa = 255;

  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= width || iy < 0 || iy >= height) return;
  const startIdx = (iy * width + ix) * 4;
  const tr = d[startIdx], tg = d[startIdx + 1], tb = d[startIdx + 2], ta = d[startIdx + 3];

  if (tr === fr && tg === fg && tb === fb && ta === fa) return;

  const matches = (i: number) =>
    Math.abs(d[i] - tr) <= tolerance &&
    Math.abs(d[i + 1] - tg) <= tolerance &&
    Math.abs(d[i + 2] - tb) <= tolerance &&
    Math.abs(d[i + 3] - ta) <= tolerance;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [iy * width + ix];
  visited[iy * width + ix] = 1;

  while (stack.length > 0) {
    const pos = stack.pop()!;
    const px = pos % width;
    const py = (pos - px) / width;
    const i = pos * 4;
    d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = fa;

    const neighbors = [pos - 1, pos + 1, pos - width, pos + width];
    const valid = [px > 0, px < width - 1, py > 0, py < height - 1];
    for (let n = 0; n < 4; n++) {
      const np = neighbors[n];
      if (valid[n] && !visited[np] && matches(np * 4)) {
        visited[np] = 1;
        stack.push(np);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── Image loading ─────────────────────────────────────────────────────────────

export function loadDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = dataUrl;
  });
}

// ── Canvas to dataURL ─────────────────────────────────────────────────────────

export function canvasToDataUrl(canvas: HTMLCanvasElement | OffscreenCanvas): string {
  if (canvas instanceof HTMLCanvasElement) return canvas.toDataURL('image/png');
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d')!.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
  return tmp.toDataURL('image/png');
}

// ── Compositing ───────────────────────────────────────────────────────────────

export interface CompositeLayer {
  img: HTMLImageElement | OffscreenCanvas | null;
  opacity: number;
  tint?: { r: number; g: number; b: number; a: number } | null;
}

export function composite(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layers: CompositeLayer[],
  background = '#ffffff',
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (const layer of layers) {
    if (!layer.img || layer.opacity === 0) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;

    if (layer.tint) {
      // Draw with colour tint using multiply + source-atop
      const off = new OffscreenCanvas(width, height);
      const offCtx = off.getContext('2d')!;
      offCtx.drawImage(layer.img as CanvasImageSource, 0, 0);
      offCtx.globalCompositeOperation = 'source-atop';
      const { r, g, b, a } = layer.tint;
      offCtx.fillStyle = `rgba(${r},${g},${b},${a})`;
      offCtx.fillRect(0, 0, width, height);
      ctx.drawImage(off, 0, 0);
    } else {
      ctx.drawImage(layer.img as CanvasImageSource, 0, 0);
    }
    ctx.restore();
  }
}

// ── Brush helpers ─────────────────────────────────────────────────────────────

export function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export function applyStabilizer(newPt: Point, prev: Point[], strength: number): Point {
  if (strength === 0 || prev.length === 0) return newPt;
  const count = Math.min(strength, prev.length);
  let sx = newPt.x, sy = newPt.y;
  for (let i = prev.length - count; i < prev.length; i++) {
    sx += prev[i].x; sy += prev[i].y;
  }
  return { x: sx / (count + 1), y: sy / (count + 1) };
}

// ── Pencil texture ─────────────────────────────────────────────────────────────

export function drawPencilDabs(
  ctx: CanvasRenderingContext2D,
  p1: Point, p2: Point,
  size: number, color: string, opacity: number,
) {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const steps = Math.max(1, Math.ceil(dist / 2));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = p1.x + (p2.x - p1.x) * t;
    const cy = p1.y + (p2.y - p1.y) * t;
    const r = size / 2;
    for (let d = 0; d < 3; d++) {
      const ox = (Math.random() - 0.5) * size * 0.6;
      const oy = (Math.random() - 0.5) * size * 0.6;
      ctx.globalAlpha = opacity * (0.4 + Math.random() * 0.4);
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r * (0.3 + Math.random() * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Smooth line ────────────────────────────────────────────────────────────────

export function drawSmoothLine(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  size: number,
  color: string,
  opacity: number,
  composite: GlobalCompositeOperation = 'source-over',
) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = composite;
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

// ── Export GIF (simple frame sequence as PNG download) ────────────────────────

export async function exportFramesAsPNG(frames: { dataUrls: string[] }[], filename: string) {
  // For now, export each frame as numbered PNG
  for (let i = 0; i < frames.length; i++) {
    const a = document.createElement('a');
    a.download = `${filename}_frame${String(i + 1).padStart(3, '0')}.png`;
    a.href = frames[i].dataUrls[0] ?? '';
    a.click();
    await new Promise(r => setTimeout(r, 50));
  }
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

export function makeThumbnail(src: HTMLCanvasElement, w = 80, h = 45): string {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(src, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.7);
}
