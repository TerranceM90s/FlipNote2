export type ToolType = 'pen' | 'pencil' | 'marker' | 'eraser' | 'fill' | 'select' | 'move';

export type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'both';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0-1
  locked: boolean;
  data: string | null; // base64 PNG dataURL
}

export interface Frame {
  id: string;
  layers: Layer[];
  duration: number; // ms
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  data: string; // base64 PNG dataURL (RGBA)
  width: number;
  height: number;
  thumb: string; // small preview dataURL
}

export interface ToolSettings {
  tool: ToolType;
  size: number;       // 1–80
  opacity: number;    // 0–100
  color: string;      // hex
  stabilizer: number; // 0–10
  symmetry: SymmetryMode;
}

export interface OnionSkin {
  enabled: boolean;
  prevCount: number;
  nextCount: number;
  prevOpacity: number; // 0-1
  nextOpacity: number;
  tinted: boolean;
}

export interface Playback {
  playing: boolean;
  fps: number; // 1-30
  loop: boolean;
}

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
