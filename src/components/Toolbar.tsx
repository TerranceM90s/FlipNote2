import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import type { ToolType, SymmetryMode } from '../types';

const TOOLS: { id: ToolType; icon: string; label: string; key: string }[] = [
  { id: 'pen',     icon: '✏️', label: 'Pen',     key: 'B' },
  { id: 'pencil',  icon: '🖊️', label: 'Pencil',  key: 'P' },
  { id: 'marker',  icon: '🖍️', label: 'Marker',  key: 'M' },
  { id: 'eraser',  icon: '⬜', label: 'Eraser',  key: 'E' },
  { id: 'fill',    icon: '🪣', label: 'Fill',    key: 'F' },
  { id: 'select',  icon: '⬚',  label: 'Select',  key: 'S' },
  { id: 'move',    icon: '✥',  label: 'Move',    key: 'V' },
];

const PRESET_COLORS = [
  '#111111','#ffffff','#e94560','#f97316','#eab308',
  '#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4',
  '#854d0e','#166534','#1e3a5f','#6b21a8','#9f1239',
  '#d4d4d4','#a3a3a3','#737373','#404040','#0a0a0a',
];

export default function Toolbar() {
  const { tool, setTool, onionSkin, setOnionSkin, recentColors, frameIdx } = useStore();
  const colorRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const canUndo = (() => {
    const { historyPos } = useStore.getState();
    return (historyPos[frameIdx] ?? -1) > 0;
  })();
  const canRedo = (() => {
    const { history, historyPos } = useStore.getState();
    const stack = history[frameIdx];
    return stack ? (historyPos[frameIdx] ?? -1) < stack.length - 1 : false;
  })();

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-700 bg-gray-900 flex-wrap" style={{ minHeight: 48 }}>
      {/* Logo */}
      <div className="text-xs font-bold mr-2" style={{ color: 'var(--accent)', fontSize: 13, letterSpacing: -0.5 }}>
        FlipNote2
      </div>

      {/* Tools */}
      <div className="flex gap-0.5 border-r border-gray-700 pr-2 mr-1">
        {TOOLS.map(t => (
          <button
            key={t.id}
            title={`${t.label} (${t.key})`}
            className={`tool-btn ${tool.tool === t.id ? 'active' : ''}`}
            onClick={() => setTool({ tool: t.id })}
          >
            <span>{t.icon}</span>
            <span className="tlabel" style={{ color: tool.tool === t.id ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Brush size */}
      <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
        <span className="panel-label mb-0">SIZE</span>
        <input
          type="range" min={1} max={80} value={tool.size}
          style={{ width: 72 }}
          onChange={e => setTool({ size: +e.target.value })}
        />
        <input type="number" min={1} max={80} value={tool.size}
          onChange={e => setTool({ size: Math.min(80, Math.max(1, +e.target.value)) })}
        />
      </div>

      {/* Opacity */}
      <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
        <span className="panel-label mb-0">OPAC</span>
        <input
          type="range" min={1} max={100} value={tool.opacity}
          style={{ width: 60 }}
          onChange={e => setTool({ opacity: +e.target.value })}
        />
        <input type="number" min={1} max={100} value={tool.opacity}
          onChange={e => setTool({ opacity: Math.min(100, Math.max(1, +e.target.value)) })}
        />
      </div>

      {/* Stabilizer */}
      <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
        <span className="panel-label mb-0">STAB</span>
        <input
          type="range" min={0} max={10} value={tool.stabilizer}
          style={{ width: 50 }}
          onChange={e => setTool({ stabilizer: +e.target.value })}
        />
        <span style={{ fontSize: 11, color: '#9ca3af', width: 14 }}>{tool.stabilizer}</span>
      </div>

      {/* Color */}
      <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1 relative">
        <button
          className="w-7 h-7 rounded border-2"
          style={{
            background: tool.color,
            borderColor: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
          }}
          title="Pick color"
          onClick={() => setShowColorPicker(p => !p)}
        />
        <div className="flex flex-wrap gap-0.5" style={{ maxWidth: 130 }}>
          {PRESET_COLORS.slice(0, 10).map(c => (
            <button
              key={c}
              className="color-swatch"
              style={{ background: c, outline: c === tool.color ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}
              onClick={() => { setTool({ color: c }); useStore.getState().addRecentColor(c); }}
            />
          ))}
        </div>
        {showColorPicker && (
          <div
            className="absolute z-50 rounded-lg p-3 shadow-xl"
            style={{ top: '110%', left: 0, background: '#1f2937', border: '1px solid #374151', width: 220 }}
          >
            <div className="flex flex-wrap gap-1 mb-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  className="color-swatch"
                  style={{ background: c, outline: c === tool.color ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}
                  onClick={() => { setTool({ color: c }); useStore.getState().addRecentColor(c); setShowColorPicker(false); }}
                />
              ))}
            </div>
            <div className="panel-label">CUSTOM</div>
            <input
              ref={colorRef}
              type="color"
              value={tool.color}
              className="w-full h-8 cursor-pointer rounded"
              style={{ background: 'none', border: 'none', padding: 0 }}
              onChange={e => { setTool({ color: e.target.value }); useStore.getState().addRecentColor(e.target.value); }}
            />
            <div className="panel-label mt-2">RECENT</div>
            <div className="flex flex-wrap gap-1">
              {recentColors.slice(0, 16).map((c, i) => (
                <button
                  key={i}
                  className="color-swatch"
                  style={{ background: c, outline: c === tool.color ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}
                  onClick={() => { setTool({ color: c }); setShowColorPicker(false); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Symmetry */}
      <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
        <span className="panel-label mb-0">SYM</span>
        {(['none','vertical','horizontal','both'] as SymmetryMode[]).map(s => (
          <button
            key={s}
            className={`btn ${tool.symmetry === s ? 'active' : ''}`}
            style={{ padding: '2px 5px', fontSize: 10 }}
            onClick={() => setTool({ symmetry: s })}
          >
            {s === 'none' ? 'Off' : s === 'vertical' ? '|' : s === 'horizontal' ? '—' : '+'}
          </button>
        ))}
      </div>

      {/* Onion skin toggle */}
      <button
        className={`btn ${onionSkin.enabled ? 'active' : ''}`}
        title="Toggle onion skin"
        onClick={() => setOnionSkin({ enabled: !onionSkin.enabled })}
      >
        👻 Onion
      </button>

      {/* Undo/Redo */}
      <div className="flex gap-0.5 ml-1">
        <button
          className="btn"
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          onClick={() => {
            useStore.getState().undo();
            // Force canvas reload after undo
            window.dispatchEvent(new CustomEvent('flipnote:undo-redo'));
          }}
        >↩</button>
        <button
          className="btn"
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          onClick={() => {
            useStore.getState().redo();
            window.dispatchEvent(new CustomEvent('flipnote:undo-redo'));
          }}
        >↪</button>
      </div>

      {/* Clear layer */}
      <button
        className="btn ml-1"
        title="Clear current layer"
        onClick={() => window.dispatchEvent(new Event('flipnote:clear-layer'))}
      >
        🗑️ Clear
      </button>

      {/* Save/Load */}
      <div className="flex gap-0.5 ml-auto">
        <button
          className="btn"
          title="Save project"
          onClick={() => {
            const data = useStore.getState().exportProject();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
            a.download = 'flipnote-project.json';
            a.click();
          }}
        >
          💾 Save
        </button>
        <button
          className="btn"
          title="Load project"
          onClick={() => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.json';
            inp.onchange = () => {
              const file = inp.files?.[0];
              if (!file) return;
              file.text().then(t => useStore.getState().importProject(t));
            };
            inp.click();
          }}
        >
          📂 Load
        </button>
      </div>
    </div>
  );
}
