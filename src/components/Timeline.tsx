import { useRef, useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { loadDataUrl } from '../utils/canvas';

const THUMB_W = 80;
const THUMB_H = 45;

// Generates a composited thumbnail for a frame
async function generateThumb(frame: { layers: { visible: boolean; data: string | null }[] }): Promise<string> {
  const c = document.createElement('canvas');
  c.width = THUMB_W; c.height = THUMB_H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  const layers = [...frame.layers].reverse();
  for (const layer of layers) {
    if (!layer.visible || !layer.data) continue;
    const img = await loadDataUrl(layer.data);
    ctx.drawImage(img, 0, 0, THUMB_W, THUMB_H);
  }
  return c.toDataURL('image/jpeg', 0.75);
}

function FrameThumb({ idx }: { idx: number }) {
  const { frames, frameIdx, setFrameIdx } = useStore();
  const frame = frames[idx];
  const [thumb, setThumb] = useState<string | null>(null);
  const prevDataRef = useRef<string>('');

  useEffect(() => {
    const key = frame.layers.map(l => l.data?.slice(0, 20) ?? '').join('|');
    if (key === prevDataRef.current) return;
    prevDataRef.current = key;
    generateThumb(frame).then(setThumb);
  }, [frame]);

  const isActive = idx === frameIdx;

  return (
    <div
      className={`frame-cell ${isActive ? 'active' : ''}`}
      style={{ width: THUMB_W, height: THUMB_H + 16 }}
      onClick={() => setFrameIdx(idx)}
    >
      {thumb
        ? <img src={thumb} width={THUMB_W} height={THUMB_H} style={{ display: 'block' }} />
        : <div style={{ width: THUMB_W, height: THUMB_H, background: '#f9f9f9' }} />
      }
      <div style={{
        fontSize: 9, textAlign: 'center', padding: '1px 0',
        background: isActive ? 'var(--accent)' : '#1f2937',
        color: isActive ? 'white' : '#9ca3af',
      }}>
        {idx + 1}
      </div>
    </div>
  );
}

export default function Timeline() {
  const {
    frames, frameIdx, playback,
    addFrame, insertFrame, duplicateFrame, deleteFrame,
    setFrameDuration, setPlayback, moveFrame,
  } = useStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Auto-scroll to active frame
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const item = el.children[frameIdx] as HTMLElement;
    if (item) item.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
  }, [frameIdx]);

  const currentDuration = frames[frameIdx]?.duration ?? 100;

  return (
    <div
      className="flex flex-col border-t border-gray-700"
      style={{ background: '#111827', userSelect: 'none' }}
    >
      {/* Playback controls row */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700">
        {/* Transport */}
        <button className="icon-btn" title="First frame" onClick={() => useStore.getState().setFrameIdx(0)}>⏮</button>
        <button className="icon-btn" title="Prev frame" onClick={() => useStore.getState().setFrameIdx(frameIdx - 1)}>◀</button>
        <button
          className={`icon-btn ${playback.playing ? 'active' : ''}`}
          title={playback.playing ? 'Pause' : 'Play'}
          style={{ width: 34, height: 34, fontSize: 18 }}
          onClick={() => setPlayback({ playing: !playback.playing })}
        >
          {playback.playing ? '⏸' : '▶'}
        </button>
        <button className="icon-btn" title="Next frame" onClick={() => useStore.getState().setFrameIdx(frameIdx + 1)}>▶</button>
        <button className="icon-btn" title="Last frame" onClick={() => useStore.getState().setFrameIdx(frames.length - 1)}>⏭</button>

        <div style={{ width: 1, height: 24, background: '#374151', margin: '0 4px' }} />

        {/* FPS */}
        <span className="panel-label mb-0">FPS</span>
        <input
          type="range" min={1} max={30} value={playback.fps}
          style={{ width: 70 }}
          onChange={e => setPlayback({ fps: +e.target.value })}
        />
        <input
          type="number" min={1} max={30} value={playback.fps}
          onChange={e => setPlayback({ fps: Math.min(30, Math.max(1, +e.target.value)) })}
        />

        {/* Loop */}
        <button
          className={`btn ${playback.loop ? 'active' : ''}`}
          onClick={() => setPlayback({ loop: !playback.loop })}
          title="Loop"
        >
          🔁 Loop
        </button>

        <div style={{ width: 1, height: 24, background: '#374151', margin: '0 4px' }} />

        {/* Frame duration */}
        <span className="panel-label mb-0">FRAME ms</span>
        <input
          type="number" min={16} max={5000} step={10} value={currentDuration}
          onChange={e => setFrameDuration(frameIdx, +e.target.value)}
          title="Frame duration in milliseconds"
        />

        <div style={{ width: 1, height: 24, background: '#374151', margin: '0 4px' }} />

        {/* Frame ops */}
        <button className="btn" title="Add frame at end" onClick={addFrame}>+ Frame</button>
        <button className="btn" title="Insert frame after current" onClick={() => insertFrame(frameIdx)}>Insert</button>
        <button className="btn" title="Duplicate frame" onClick={() => duplicateFrame()}>Dupe</button>
        <button
          className="btn"
          title="Delete frame"
          disabled={frames.length <= 1}
          onClick={deleteFrame}
        >
          Del
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>
          {frameIdx + 1} / {frames.length}
        </span>
      </div>

      {/* Frame strip */}
      <div
        ref={scrollRef}
        className="flex gap-1 items-center px-2 py-1.5 overflow-x-auto"
        style={{ minHeight: THUMB_H + 28 }}
      >
        {frames.map((_, i) => (
          <div
            key={frames[i].id}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== i) moveFrame(dragIdx, i);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
            style={{ opacity: dragIdx === i ? 0.4 : 1 }}
          >
            <FrameThumb idx={i} />
          </div>
        ))}

        {/* Add button at the end */}
        <button
          className="flex-shrink-0 flex items-center justify-center rounded"
          style={{
            width: THUMB_W, height: THUMB_H,
            border: '1px dashed #374151',
            color: '#6b7280',
            fontSize: 22,
            background: 'transparent',
            cursor: 'pointer',
          }}
          onClick={addFrame}
          title="Add frame"
        >
          +
        </button>
      </div>
    </div>
  );
}
