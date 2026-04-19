import { create } from 'zustand';
import type { Frame, Layer, Asset, ToolSettings, OnionSkin, Playback, SelectionRect } from '../types';

const CANVAS_W = 800;
const CANVAS_H = 450;

export const newLayer = (name = 'Layer 1'): Layer => ({
  id: crypto.randomUUID(),
  name,
  visible: true,
  opacity: 1,
  locked: false,
  data: null,
});

export const newFrame = (): Frame => ({
  id: crypto.randomUUID(),
  layers: [newLayer()],
  duration: 100,
});

type HistoryEntry = Layer[];

interface Store {
  projectName: string;
  width: number;
  height: number;
  frames: Frame[];
  frameIdx: number;
  layerIdx: number;
  tool: ToolSettings;
  onionSkin: OnionSkin;
  playback: Playback;
  assets: Asset[];
  recentColors: string[];
  selection: SelectionRect | null;
  selectionData: string | null; // dataURL of the selection
  // Per-frame history: indexed by frameIdx
  history: Record<number, HistoryEntry[]>;
  historyPos: Record<number, number>;

  // Frame
  addFrame: () => void;
  insertFrame: (afterIdx: number) => void;
  duplicateFrame: (idx?: number) => void;
  deleteFrame: () => void;
  setFrameIdx: (i: number) => void;
  setFrameDuration: (i: number, ms: number) => void;
  moveFrame: (from: number, to: number) => void;

  // Layer
  addLayer: () => void;
  deleteLayer: () => void;
  setLayerIdx: (i: number) => void;
  setLayerData: (frameIdx: number, layerIdx: number, data: string | null) => void;
  toggleLayerVisible: (i: number) => void;
  toggleLayerLocked: (i: number) => void;
  setLayerOpacity: (i: number, v: number) => void;
  renameLayer: (i: number, name: string) => void;
  reorderLayer: (from: number, to: number) => void;

  // Tool
  setTool: (t: Partial<ToolSettings>) => void;
  setOnionSkin: (o: Partial<OnionSkin>) => void;
  setPlayback: (p: Partial<Playback>) => void;

  // Assets
  addAsset: (a: Asset) => void;
  deleteAsset: (id: string) => void;

  // Selection
  setSelection: (s: SelectionRect | null) => void;
  setSelectionData: (d: string | null) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Color history
  addRecentColor: (c: string) => void;

  // IO
  exportProject: () => string;
  importProject: (json: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  projectName: 'My Animation',
  width: CANVAS_W,
  height: CANVAS_H,
  frames: [newFrame()],
  frameIdx: 0,
  layerIdx: 0,
  tool: {
    tool: 'pen',
    size: 5,
    opacity: 100,
    color: '#111111',
    stabilizer: 3,
    symmetry: 'none',
  },
  onionSkin: {
    enabled: true,
    prevCount: 2,
    nextCount: 0,
    prevOpacity: 0.35,
    nextOpacity: 0.25,
    tinted: true,
  },
  playback: { playing: false, fps: 10, loop: true },
  assets: [],
  recentColors: ['#111111', '#ffffff', '#e94560', '#3b82f6', '#10b981', '#f59e0b'],
  selection: null,
  selectionData: null,
  history: {},
  historyPos: {},

  // ── Frame ops ──────────────────────────────────────────────────────────────

  addFrame: () => set(s => {
    const frames = [...s.frames, newFrame()];
    return { frames, frameIdx: frames.length - 1, layerIdx: 0, selection: null };
  }),

  insertFrame: (afterIdx) => set(s => {
    const frames = [
      ...s.frames.slice(0, afterIdx + 1),
      newFrame(),
      ...s.frames.slice(afterIdx + 1),
    ];
    return { frames, frameIdx: afterIdx + 1, layerIdx: 0, selection: null };
  }),

  duplicateFrame: (idx) => set(s => {
    const srcIdx = idx ?? s.frameIdx;
    const src = s.frames[srcIdx];
    const copy: Frame = {
      id: crypto.randomUUID(),
      duration: src.duration,
      layers: src.layers.map(l => ({ ...l, id: crypto.randomUUID() })),
    };
    const frames = [
      ...s.frames.slice(0, srcIdx + 1),
      copy,
      ...s.frames.slice(srcIdx + 1),
    ];
    return { frames, frameIdx: srcIdx + 1, layerIdx: s.layerIdx, selection: null };
  }),

  deleteFrame: () => set(s => {
    if (s.frames.length <= 1) return s;
    const frames = s.frames.filter((_, i) => i !== s.frameIdx);
    const frameIdx = Math.min(s.frameIdx, frames.length - 1);
    return { frames, frameIdx, layerIdx: 0, selection: null };
  }),

  setFrameIdx: (i) => set(s => {
    if (i < 0 || i >= s.frames.length) return s;
    const layerIdx = Math.min(s.layerIdx, s.frames[i].layers.length - 1);
    return { frameIdx: i, layerIdx, selection: null };
  }),

  setFrameDuration: (i, ms) => set(s => ({
    frames: s.frames.map((f, fi) => fi === i ? { ...f, duration: Math.max(16, ms) } : f),
  })),

  moveFrame: (from, to) => set(s => {
    const frames = [...s.frames];
    const [moved] = frames.splice(from, 1);
    frames.splice(to, 0, moved);
    return { frames, frameIdx: to };
  }),

  // ── Layer ops ──────────────────────────────────────────────────────────────

  addLayer: () => set(s => {
    const frame = s.frames[s.frameIdx];
    const name = `Layer ${frame.layers.length + 1}`;
    const frames = s.frames.map((f, i) =>
      i === s.frameIdx ? { ...f, layers: [newLayer(name), ...f.layers] } : f
    );
    return { frames, layerIdx: 0 };
  }),

  deleteLayer: () => set(s => {
    const frame = s.frames[s.frameIdx];
    if (frame.layers.length <= 1) return s;
    const frames = s.frames.map((f, i) =>
      i === s.frameIdx ? { ...f, layers: f.layers.filter((_, li) => li !== s.layerIdx) } : f
    );
    const layerIdx = Math.min(s.layerIdx, frame.layers.length - 2);
    return { frames, layerIdx };
  }),

  setLayerIdx: (i) => set({ layerIdx: i }),

  setLayerData: (frameIdx, layerIdx, data) => set(s => ({
    frames: s.frames.map((f, fi) =>
      fi !== frameIdx ? f : {
        ...f,
        layers: f.layers.map((l, li) => li === layerIdx ? { ...l, data } : l),
      }
    ),
  })),

  toggleLayerVisible: (i) => set(s => ({
    frames: s.frames.map((f, fi) =>
      fi !== s.frameIdx ? f : {
        ...f,
        layers: f.layers.map((l, li) => li === i ? { ...l, visible: !l.visible } : l),
      }
    ),
  })),

  toggleLayerLocked: (i) => set(s => ({
    frames: s.frames.map((f, fi) =>
      fi !== s.frameIdx ? f : {
        ...f,
        layers: f.layers.map((l, li) => li === i ? { ...l, locked: !l.locked } : l),
      }
    ),
  })),

  setLayerOpacity: (i, v) => set(s => ({
    frames: s.frames.map((f, fi) =>
      fi !== s.frameIdx ? f : {
        ...f,
        layers: f.layers.map((l, li) => li === i ? { ...l, opacity: v } : l),
      }
    ),
  })),

  renameLayer: (i, name) => set(s => ({
    frames: s.frames.map((f, fi) =>
      fi !== s.frameIdx ? f : {
        ...f,
        layers: f.layers.map((l, li) => li === i ? { ...l, name } : l),
      }
    ),
  })),

  reorderLayer: (from, to) => set(s => {
    const frame = s.frames[s.frameIdx];
    const layers = [...frame.layers];
    const [moved] = layers.splice(from, 1);
    layers.splice(to, 0, moved);
    const frames = s.frames.map((f, i) => i === s.frameIdx ? { ...f, layers } : f);
    return { frames, layerIdx: to };
  }),

  // ── Tool ───────────────────────────────────────────────────────────────────

  setTool: (t) => set(s => ({ tool: { ...s.tool, ...t } })),
  setOnionSkin: (o) => set(s => ({ onionSkin: { ...s.onionSkin, ...o } })),
  setPlayback: (p) => set(s => ({ playback: { ...s.playback, ...p } })),

  // ── Assets ─────────────────────────────────────────────────────────────────

  addAsset: (a) => set(s => ({ assets: [...s.assets, a] })),
  deleteAsset: (id) => set(s => ({ assets: s.assets.filter(a => a.id !== id) })),

  // ── Selection ──────────────────────────────────────────────────────────────

  setSelection: (s) => set({ selection: s }),
  setSelectionData: (d) => set({ selectionData: d }),

  // ── History ────────────────────────────────────────────────────────────────

  pushHistory: () => set(s => {
    const fi = s.frameIdx;
    const snapshot = s.frames[fi].layers.map(l => ({ ...l }));
    const prev = s.history[fi] ?? [];
    const prevPos = s.historyPos[fi] ?? -1;
    const trimmed = prev.slice(0, prevPos + 1);
    trimmed.push(snapshot);
    if (trimmed.length > 40) trimmed.shift();
    return {
      history: { ...s.history, [fi]: trimmed },
      historyPos: { ...s.historyPos, [fi]: trimmed.length - 1 },
    };
  }),

  undo: () => set(s => {
    const fi = s.frameIdx;
    const pos = (s.historyPos[fi] ?? -1) - 1;
    const stack = s.history[fi];
    if (!stack || pos < 0) return s;
    const snapshot = stack[pos];
    return {
      frames: s.frames.map((f, i) => i !== fi ? f : { ...f, layers: snapshot.map(l => ({ ...l })) }),
      historyPos: { ...s.historyPos, [fi]: pos },
    };
  }),

  redo: () => set(s => {
    const fi = s.frameIdx;
    const stack = s.history[fi];
    const pos = (s.historyPos[fi] ?? -1) + 1;
    if (!stack || pos >= stack.length) return s;
    const snapshot = stack[pos];
    return {
      frames: s.frames.map((f, i) => i !== fi ? f : { ...f, layers: snapshot.map(l => ({ ...l })) }),
      historyPos: { ...s.historyPos, [fi]: pos },
    };
  }),

  // ── Recent colors ──────────────────────────────────────────────────────────

  addRecentColor: (c) => set(s => {
    const arr = [c, ...s.recentColors.filter(x => x !== c)].slice(0, 20);
    return { recentColors: arr };
  }),

  // ── IO ─────────────────────────────────────────────────────────────────────

  exportProject: () => {
    const s = get();
    return JSON.stringify({ projectName: s.projectName, width: s.width, height: s.height, frames: s.frames, assets: s.assets });
  },

  importProject: (json) => {
    const d = JSON.parse(json);
    set({
      projectName: d.projectName ?? 'Imported',
      width: d.width ?? CANVAS_W,
      height: d.height ?? CANVAS_H,
      frames: d.frames ?? [newFrame()],
      assets: d.assets ?? [],
      frameIdx: 0,
      layerIdx: 0,
      history: {},
      historyPos: {},
      selection: null,
    });
  },
}));
