import { useState } from 'react';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import LayerPanel from './components/LayerPanel';
import Timeline from './components/Timeline';
import AssetLibrary from './components/AssetLibrary';

export default function App() {
  const [showLayers, setShowLayers] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: '#111827' }}>
        <Toolbar />

        {/* Mobile slide-over panels */}
        {showLayers && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
            <div style={{ width: 200, height: '100%', background: '#111827', overflow: 'auto', boxShadow: '4px 0 20px rgba(0,0,0,0.5)' }}>
              <div style={{ padding: '8px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Layers</span>
                <button className="icon-btn" onClick={() => setShowLayers(false)}>✕</button>
              </div>
              <LayerPanel />
            </div>
            <div style={{ flex: 1 }} onClick={() => setShowLayers(false)} />
          </div>
        )}
        {showAssets && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ flex: 1 }} onClick={() => setShowAssets(false)} />
            <div style={{ width: 210, height: '100%', background: '#111827', overflow: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.5)' }}>
              <div style={{ padding: '8px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Assets</span>
                <button className="icon-btn" onClick={() => setShowAssets(false)}>✕</button>
              </div>
              <AssetLibrary />
            </div>
          </div>
        )}

        {/* Canvas fills everything */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
          <Canvas />

          {/* Floating panel toggles */}
          <div style={{ position: 'absolute', left: 6, top: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className={`btn ${showLayers ? 'active' : ''}`}
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => { setShowLayers(p => !p); setShowAssets(false); }}
            >
              ☰ Layers
            </button>
            <button
              className={`btn ${showAssets ? 'active' : ''}`}
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => { setShowAssets(p => !p); setShowLayers(false); }}
            >
              📦 Assets
            </button>
          </div>
        </div>

        <Timeline />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: '#111827' }}>
      <Toolbar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <LayerPanel />
        <Canvas />
        <AssetLibrary />
      </div>
      <Timeline />
    </div>
  );
}
