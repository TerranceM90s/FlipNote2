import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  floodFill, loadDataUrl, canvasToDataUrl, applyStabilizer,
  drawPencilDabs, drawSmoothLine,
} from '../utils/canvas';
import type { Point } from '../utils/canvas';

// Cache loaded images so we don't re-decode on every frame
const imgCache = new Map<string, HTMLImageElement>();

async function getImg(dataUrl: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!dataUrl) return null;
  if (imgCache.has(dataUrl)) return imgCache.get(dataUrl)!;
  const img = await loadDataUrl(dataUrl);
  imgCache.set(dataUrl, img);
  return img;
}

export default function Canvas() {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Active layer's offscreen canvas — we draw here during strokes
  const activeCanvas = useRef<OffscreenCanvas | null>(null);
  const isDrawing = useRef(false);
  const strokePoints = useRef<Point[]>([]);
  const stabBuffer = useRef<Point[]>([]);
  // For marker: accumulate the stroke on a scratch canvas, then blit at the layer opacity
  const scratchCanvas = useRef<OffscreenCanvas | null>(null);
  // Selection dragging
  const selStart = useRef<Point | null>(null);
  // Move tool
  const moveStart = useRef<Point | null>(null);
  const moveSelStart = useRef<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);

  const {
    frames, frameIdx, layerIdx, width, height,
    tool, onionSkin, playback,
    setLayerData, pushHistory, setTool,
    addRecentColor, setSelection, setSelectionData, selection, selectionData,
  } = useStore();

  const currentFrame = frames[frameIdx];
  const currentLayer = currentFrame?.layers[layerIdx];

  // ── Scale canvas to fill its container ────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const { clientWidth: cw, clientHeight: ch } = el;
      const s = Math.min(cw / width, ch / height);
      setScale(s);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [width, height]);

  // ── Load active layer into offscreen canvas ────────────────────────────────

  useEffect(() => {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    activeCanvas.current = canvas;
    scratchCanvas.current = new OffscreenCanvas(width, height);

    if (currentLayer?.data) {
      getImg(currentLayer.data).then(img => {
        if (img) ctx.drawImage(img, 0, 0);
        redisplay();
      });
    } else {
      redisplay();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIdx, layerIdx, frames[frameIdx]?.id]);

  // ── Redisplay when layer data changes (other frames/layers updated) ─────────

  useEffect(() => {
    redisplay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, onionSkin, scale, selection, selectionData]);

  // ── Composite everything to the display canvas ────────────────────────────

  const redisplay = useCallback(async () => {
    const display = displayRef.current;
    if (!display || !activeCanvas.current) return;
    const ctx = display.getContext('2d')!;
    const w = width, h = height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Onion skin — previous frames
    if (onionSkin.enabled) {
      for (let i = onionSkin.prevCount; i >= 1; i--) {
        const fi = frameIdx - i;
        if (fi < 0) continue;
        const frame = frames[fi];
        const alpha = onionSkin.prevOpacity * (1 - (i - 1) / onionSkin.prevCount);
        for (const layer of frame.layers) {
          if (!layer.visible || !layer.data) continue;
          const img = await getImg(layer.data);
          if (!img) continue;
          ctx.save();
          ctx.globalAlpha = alpha * layer.opacity;
          if (onionSkin.tinted) {
            const off = new OffscreenCanvas(w, h);
            const oc = off.getContext('2d')!;
            oc.drawImage(img, 0, 0);
            oc.globalCompositeOperation = 'source-atop';
            oc.fillStyle = 'rgba(255,80,80,0.55)';
            oc.fillRect(0, 0, w, h);
            ctx.drawImage(off, 0, 0);
          } else {
            ctx.drawImage(img, 0, 0);
          }
          ctx.restore();
        }
      }
      // Next frames
      for (let i = 1; i <= onionSkin.nextCount; i++) {
        const fi = frameIdx + i;
        if (fi >= frames.length) continue;
        const frame = frames[fi];
        const alpha = onionSkin.nextOpacity * (1 - (i - 1) / Math.max(1, onionSkin.nextCount));
        for (const layer of frame.layers) {
          if (!layer.visible || !layer.data) continue;
          const img = await getImg(layer.data);
          if (!img) continue;
          ctx.save();
          ctx.globalAlpha = alpha * layer.opacity;
          if (onionSkin.tinted) {
            const off = new OffscreenCanvas(w, h);
            const oc = off.getContext('2d')!;
            oc.drawImage(img, 0, 0);
            oc.globalCompositeOperation = 'source-atop';
            oc.fillStyle = 'rgba(80,80,255,0.55)';
            oc.fillRect(0, 0, w, h);
            ctx.drawImage(off, 0, 0);
          } else {
            ctx.drawImage(img, 0, 0);
          }
          ctx.restore();
        }
      }
    }

    // Render all layers of current frame
    const layers = currentFrame?.layers ?? [];
    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      if (li === layerIdx) {
        ctx.drawImage(activeCanvas.current, 0, 0);
      } else {
        if (layer.data) {
          const img = await getImg(layer.data);
          if (img) ctx.drawImage(img, 0, 0);
        }
      }
      ctx.restore();
    }

    // Selection overlay
    if (selection) {
      if (selectionData) {
        const img = await getImg(selectionData);
        if (img) ctx.drawImage(img, selection.x, selection.y, selection.w, selection.h);
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(80,160,255,0.9)';
      ctx.lineWidth = 1 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
      ctx.restore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, frameIdx, layerIdx, onionSkin, selection, selectionData, scale, width, height]);

  // ── Coordinate helpers ────────────────────────────────────────────────────

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = displayRef.current!;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ('touches' in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      cx = t.clientX; cy = t.clientY;
    } else {
      cx = e.clientX; cy = e.clientY;
    }
    return {
      x: (cx - rect.left) * (width / rect.width),
      y: (cy - rect.top) * (height / rect.height),
    };
  }, [width, height]);

  // ── Drawing helpers ───────────────────────────────────────────────────────

  const getActiveCtx = () => activeCanvas.current?.getContext('2d') as CanvasRenderingContext2D | null;
  const getScratchCtx = () => scratchCanvas.current?.getContext('2d') as CanvasRenderingContext2D | null;

  const commitStroke = useCallback(() => {
    if (!activeCanvas.current) return;
    const data = canvasToDataUrl(activeCanvas.current);
    setLayerData(frameIdx, layerIdx, data);
    // Invalidate cache for this layer's new data
    imgCache.delete(frames[frameIdx]?.layers[layerIdx]?.data ?? '');
  }, [frameIdx, layerIdx, frames, setLayerData]);

  const drawOnActive = useCallback((from: Point, to: Point, pts: Point[]) => {
    const ctx = getActiveCtx();
    const scrCtx = getScratchCtx();
    if (!ctx) return;
    const { tool: t, size, color, opacity } = tool;
    const op = opacity / 100;

    const mirror = (pt: Point): Point[] => {
      const pts: Point[] = [pt];
      if (tool.symmetry === 'vertical' || tool.symmetry === 'both')
        pts.push({ x: width - pt.x, y: pt.y });
      if (tool.symmetry === 'horizontal' || tool.symmetry === 'both')
        pts.push({ x: pt.x, y: height - pt.y });
      if (tool.symmetry === 'both')
        pts.push({ x: width - pt.x, y: height - pt.y });
      return pts;
    };

    if (t === 'pen') {
      const allPts = pts.length >= 2 ? pts : [from, to];
      const mirrors = mirror(allPts[0]);
      for (const m of mirrors) {
        const mirrored = allPts.map(p => ({
          x: m.x + (p.x - allPts[0].x) * (mirror({ x: p.x, y: 0 }).length > 1 && tool.symmetry !== 'horizontal' ? -1 : 1),
          y: m.y + (p.y - allPts[0].y) * (mirror({ x: 0, y: p.y }).length > 1 && tool.symmetry === 'horizontal' ? -1 : 1),
        }));
        drawSmoothLine(ctx, mirrored, size, color, op);
      }
      // Simple approach for symmetry
      if (tool.symmetry !== 'none') {
        for (const frm of mirror(from)) {
          const toMirror = {
            x: frm.x + (to.x - from.x) * (tool.symmetry === 'vertical' || tool.symmetry === 'both' ? -1 : 1),
            y: frm.y + (to.y - from.y) * (tool.symmetry === 'horizontal' || tool.symmetry === 'both' ? -1 : 1),
          };
          drawSmoothLine(ctx, [frm, toMirror], size, color, op);
        }
      } else {
        drawSmoothLine(ctx, pts.length >= 2 ? pts : [from, to], size, color, op);
      }
    } else if (t === 'pencil') {
      drawPencilDabs(ctx, from, to, size, color, op);
      if (tool.symmetry !== 'none') {
        const pairs: [Point, Point][] = [];
        if (tool.symmetry === 'vertical' || tool.symmetry === 'both')
          pairs.push([{ x: width - from.x, y: from.y }, { x: width - to.x, y: to.y }]);
        if (tool.symmetry === 'horizontal' || tool.symmetry === 'both')
          pairs.push([{ x: from.x, y: height - from.y }, { x: to.x, y: height - to.y }]);
        for (const [a, b] of pairs) drawPencilDabs(ctx, a, b, size, color, op);
      }
    } else if (t === 'marker') {
      // Draw on scratch, then blit scratch at opacity on active
      if (!scrCtx || !scratchCanvas.current) return;
      scrCtx.strokeStyle = color;
      scrCtx.lineWidth = size * 2.5;
      scrCtx.lineCap = 'round';
      scrCtx.lineJoin = 'round';
      scrCtx.beginPath();
      scrCtx.moveTo(from.x, from.y);
      scrCtx.lineTo(to.x, to.y);
      scrCtx.stroke();
    } else if (t === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
      if (tool.symmetry !== 'none') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (tool.symmetry === 'vertical' || tool.symmetry === 'both') {
          ctx.beginPath(); ctx.moveTo(width - from.x, from.y); ctx.lineTo(width - to.x, to.y); ctx.stroke();
        }
        if (tool.symmetry === 'horizontal' || tool.symmetry === 'both') {
          ctx.beginPath(); ctx.moveTo(from.x, height - from.y); ctx.lineTo(to.x, height - to.y); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }, [tool, width, height]);

  // ── Mouse / touch events ──────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (currentLayer?.locked) return;
    e.preventDefault();
    const pt = getPoint(e);

    if (tool.tool === 'fill') {
      pushHistory();
      const ctx = getActiveCtx();
      if (!ctx) return;
      const tmp = document.createElement('canvas');
      tmp.width = width; tmp.height = height;
      const tmpCtx = tmp.getContext('2d')!;
      tmpCtx.drawImage(activeCanvas.current!, 0, 0);
      floodFill(tmp, pt.x, pt.y, tool.color);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(tmp, 0, 0);
      commitStroke();
      redisplay();
      return;
    }

    if (tool.tool === 'select') {
      selStart.current = pt;
      setSelection({ x: pt.x, y: pt.y, w: 0, h: 0 });
      setSelectionData(null);
      isDrawing.current = true;
      return;
    }

    if (tool.tool === 'move' && selection) {
      moveStart.current = pt;
      moveSelStart.current = { x: selection.x, y: selection.y };
      isDrawing.current = true;
      return;
    }

    addRecentColor(tool.color);
    pushHistory();

    // Clear scratch canvas for marker
    if (tool.tool === 'marker') {
      const sc = getScratchCtx();
      if (sc && scratchCanvas.current) sc.clearRect(0, 0, width, height);
    }

    isDrawing.current = true;
    strokePoints.current = [pt];
    stabBuffer.current = [pt];
    drawOnActive(pt, pt, [pt, pt]);
    redisplay();
  }, [tool, currentLayer, getPoint, pushHistory, commitStroke, drawOnActive, redisplay, selection, width, height, addRecentColor, setSelection, setSelectionData]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const rawPt = getPoint(e);

    if (tool.tool === 'select' && selStart.current) {
      const sx = selStart.current.x, sy = selStart.current.y;
      const x = Math.min(sx, rawPt.x), y = Math.min(sy, rawPt.y);
      const w = Math.abs(rawPt.x - sx), h = Math.abs(rawPt.y - sy);
      setSelection({ x, y, w, h });
      redisplay();
      return;
    }

    if (tool.tool === 'move' && moveStart.current && moveSelStart.current && selection) {
      const dx = rawPt.x - moveStart.current.x;
      const dy = rawPt.y - moveStart.current.y;
      setSelection({ ...selection, x: moveSelStart.current.x + dx, y: moveSelStart.current.y + dy });
      redisplay();
      return;
    }

    if (tool.tool === 'fill' || tool.tool === 'select' || tool.tool === 'move') return;

    const stabBuffer_ = stabBuffer.current;
    const smoothed = applyStabilizer(rawPt, stabBuffer_, tool.stabilizer);
    stabBuffer_.push(rawPt);
    if (stabBuffer_.length > 10) stabBuffer_.shift();

    const pts = strokePoints.current;
    const prev = pts[pts.length - 1] ?? smoothed;
    pts.push(smoothed);

    drawOnActive(prev, smoothed, pts);

    // For marker: composite scratch onto display at opacity
    if (tool.tool === 'marker' && scratchCanvas.current) {
      const ctx = getActiveCtx();
      if (ctx) {
        // We draw the marker stroke directly at opacity on a copy approach:
        // Actually just draw directly with globalAlpha (slight artifact but acceptable)
        const sc = getScratchCtx()!;
        sc.strokeStyle = tool.color;
        sc.lineWidth = tool.size * 2.5;
        sc.lineCap = 'round';
        sc.lineJoin = 'round';
        sc.beginPath();
        sc.moveTo(prev.x, prev.y);
        sc.lineTo(smoothed.x, smoothed.y);
        sc.stroke();
        // Blit scratch over active at each frame (redraw active from committed + scratch)
      }
    }

    redisplay();
  }, [tool, getPoint, drawOnActive, redisplay, selection, setSelection]);

  const onPointerUp = useCallback((_e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool.tool === 'select') {
      selStart.current = null;
      // Capture selection region
      if (selection && selection.w > 5 && selection.h > 5 && activeCanvas.current) {
        const tmp = document.createElement('canvas');
        tmp.width = selection.w; tmp.height = selection.h;
        tmp.getContext('2d')!.drawImage(
          activeCanvas.current as unknown as CanvasImageSource,
          selection.x, selection.y, selection.w, selection.h,
          0, 0, selection.w, selection.h
        );
        setSelectionData(tmp.toDataURL('image/png'));
      }
      redisplay();
      return;
    }

    if (tool.tool === 'move') {
      moveStart.current = null;
      moveSelStart.current = null;
      return;
    }

    if (tool.tool === 'fill') return;

    // For marker: blit accumulated scratch onto active layer at opacity
    if (tool.tool === 'marker' && scratchCanvas.current && activeCanvas.current) {
      const ctx = getActiveCtx()!;
      ctx.save();
      ctx.globalAlpha = tool.opacity / 100;
      ctx.drawImage(scratchCanvas.current as unknown as CanvasImageSource, 0, 0);
      ctx.restore();
      getScratchCtx()?.clearRect(0, 0, width, height);
    }

    commitStroke();
    strokePoints.current = [];
    stabBuffer.current = [];
    redisplay();
  }, [tool, commitStroke, redisplay, selection, setSelectionData, width, height]);

  // ── Paste asset onto canvas ────────────────────────────────────────────────

  useEffect(() => {
    const handler = async (e: Event) => {
      const { asset } = (e as CustomEvent).detail;
      if (!activeCanvas.current) return;
      pushHistory();
      const img = await loadDataUrl(asset.data);
      const ctx = getActiveCtx()!;
      ctx.drawImage(img, (width - asset.width) / 2, (height - asset.height) / 2);
      commitStroke();
      redisplay();
    };
    window.addEventListener('flipnote:paste-asset', handler);
    return () => window.removeEventListener('flipnote:paste-asset', handler);
  }, [pushHistory, commitStroke, redisplay, width, height]);

  // ── Clear current layer ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      if (!activeCanvas.current) return;
      pushHistory();
      getActiveCtx()?.clearRect(0, 0, width, height);
      commitStroke();
      redisplay();
    };
    window.addEventListener('flipnote:clear-layer', handler);
    return () => window.removeEventListener('flipnote:clear-layer', handler);
  }, [pushHistory, commitStroke, redisplay, width, height]);

  // ── Playback ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!playback.playing) return;
    const interval = 1000 / playback.fps;
    let fi = useStore.getState().frameIdx;
    const timer = setInterval(() => {
      const total = useStore.getState().frames.length;
      fi = (fi + 1) % total;
      if (fi === 0 && !useStore.getState().playback.loop) {
        useStore.getState().setPlayback({ playing: false });
        clearInterval(timer);
        return;
      }
      useStore.getState().setFrameIdx(fi);
    }, interval);
    return () => clearInterval(timer);
  }, [playback.playing, playback.fps, playback.loop]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
        // reload active canvas from store after undo/redo
        const { frames, frameIdx, layerIdx } = useStore.getState();
        const data = frames[frameIdx]?.layers[layerIdx]?.data ?? null;
        const ctx = getActiveCtx();
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          if (data) {
            loadDataUrl(data).then(img => { ctx.drawImage(img, 0, 0); redisplay(); });
          } else redisplay();
        }
      }
      if (e.key === 'b') setTool({ tool: 'pen' });
      if (e.key === 'e') setTool({ tool: 'eraser' });
      if (e.key === 'f') setTool({ tool: 'fill' });
      if (e.key === 'p') setTool({ tool: 'pencil' });
      if (e.key === 'm') setTool({ tool: 'marker' });
      if (e.key === 's') setTool({ tool: 'select' });
      if (e.key === '[') useStore.getState().setTool({ size: Math.max(1, tool.size - 2) });
      if (e.key === ']') useStore.getState().setTool({ size: Math.min(80, tool.size + 2) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool.size, width, height, redisplay, setTool]);

  const cursorStyle = (() => {
    if (tool.tool === 'eraser') return 'cell';
    if (tool.tool === 'fill') return 'crosshair';
    if (tool.tool === 'select') return 'crosshair';
    if (tool.tool === 'move') return 'grab';
    return 'crosshair';
  })();

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center"
      style={{ background: '#0d1117', overflow: 'hidden' }}
    >
      <canvas
        ref={displayRef}
        width={width}
        height={height}
        style={{
          width: width * scale,
          height: height * scale,
          cursor: cursorStyle,
          boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
          borderRadius: 2,
          touchAction: 'none',
        }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />
    </div>
  );
}
