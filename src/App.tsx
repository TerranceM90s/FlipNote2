import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import LayerPanel from './components/LayerPanel';
import Timeline from './components/Timeline';
import AssetLibrary from './components/AssetLibrary';

export default function App() {
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
