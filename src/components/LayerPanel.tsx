import { useState } from 'react';
import { useStore } from '../store/useStore';

export default function LayerPanel() {
  const {
    frames, frameIdx, layerIdx,
    addLayer, deleteLayer, setLayerIdx,
    toggleLayerVisible, toggleLayerLocked,
    setLayerOpacity, renameLayer, reorderLayer,
  } = useStore();

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const layers = frames[frameIdx]?.layers ?? [];

  return (
    <div className="flex flex-col" style={{ width: 180, borderRight: '1px solid #374151', background: '#111827', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-700">
        <span className="panel-label mb-0">LAYERS</span>
        <div className="flex gap-0.5">
          <button className="icon-btn" title="Add layer" onClick={addLayer}>+</button>
          <button
            className="icon-btn"
            title="Delete layer"
            onClick={deleteLayer}
            disabled={layers.length <= 1}
          >×</button>
        </div>
      </div>

      {/* Layer list (top = front) */}
      <div className="flex-1 overflow-y-auto">
        {layers.map((layer, i) => (
          <div
            key={layer.id}
            className={`flex flex-col border-b border-gray-800 ${i === layerIdx ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
            style={{ cursor: 'pointer', opacity: dragIdx === i ? 0.4 : 1 }}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== i) reorderLayer(dragIdx, i);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
            onClick={() => setLayerIdx(i)}
          >
            <div className="flex items-center gap-1 px-1.5 py-1">
              {/* Visibility */}
              <button
                className="icon-btn"
                style={{ fontSize: 12, width: 20, height: 20 }}
                title={layer.visible ? 'Hide' : 'Show'}
                onClick={e => { e.stopPropagation(); toggleLayerVisible(i); }}
              >
                {layer.visible ? '👁' : '🚫'}
              </button>

              {/* Lock */}
              <button
                className="icon-btn"
                style={{ fontSize: 11, width: 20, height: 20 }}
                title={layer.locked ? 'Unlock' : 'Lock'}
                onClick={e => { e.stopPropagation(); toggleLayerLocked(i); }}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>

              {/* Name */}
              {editingIdx === i ? (
                <input
                  type="text"
                  defaultValue={layer.name}
                  autoFocus
                  style={{ flex: 1, fontSize: 11, minWidth: 0 }}
                  onBlur={e => { renameLayer(i, e.target.value); setEditingIdx(null); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingIdx(null);
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: i === layerIdx ? '#f3f4f6' : '#9ca3af' }}
                  onDoubleClick={e => { e.stopPropagation(); setEditingIdx(i); }}
                >
                  {layer.name}
                </span>
              )}
            </div>

            {/* Opacity slider (shown for active layer) */}
            {i === layerIdx && (
              <div className="flex items-center gap-1 px-1.5 pb-1">
                <span style={{ fontSize: 9, color: '#6b7280' }}>OPACITY</span>
                <input
                  type="range" min={0} max={1} step={0.01} value={layer.opacity}
                  style={{ flex: 1 }}
                  onChange={e => setLayerOpacity(i, +e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
                <span style={{ fontSize: 9, color: '#9ca3af', width: 26, textAlign: 'right' }}>
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Onion skin settings */}
      <div className="px-2 py-2 border-t border-gray-700" style={{ fontSize: 10 }}>
        <OnionSettings />
      </div>
    </div>
  );
}

function OnionSettings() {
  const { onionSkin, setOnionSkin } = useStore();

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="panel-label mb-0">ONION SKIN</span>
        <button
          className={`btn ${onionSkin.enabled ? 'active' : ''}`}
          style={{ padding: '1px 6px', fontSize: 9 }}
          onClick={() => setOnionSkin({ enabled: !onionSkin.enabled })}
        >
          {onionSkin.enabled ? 'ON' : 'OFF'}
        </button>
      </div>
      {onionSkin.enabled && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span style={{ color: '#f87171' }}>Prev frames</span>
            <input type="number" min={0} max={5} value={onionSkin.prevCount}
              style={{ width: 36 }}
              onChange={e => setOnionSkin({ prevCount: +e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: '#60a5fa' }}>Next frames</span>
            <input type="number" min={0} max={5} value={onionSkin.nextCount}
              style={{ width: 36 }}
              onChange={e => setOnionSkin({ nextCount: +e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: '#9ca3af' }}>Prev opacity</span>
            <input type="range" min={0} max={1} step={0.05} value={onionSkin.prevOpacity}
              style={{ width: 60 }}
              onChange={e => setOnionSkin({ prevOpacity: +e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: '#9ca3af' }}>Color tint</span>
            <button
              className={`btn ${onionSkin.tinted ? 'active' : ''}`}
              style={{ padding: '1px 6px', fontSize: 9 }}
              onClick={() => setOnionSkin({ tinted: !onionSkin.tinted })}
            >
              {onionSkin.tinted ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
