import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import type { Asset } from '../types';

const DEFAULT_CATEGORIES = ['Bodies', 'Faces', 'Mouths', 'Eyes', 'Expressions', 'Backgrounds', 'Props', 'Other'];

export default function AssetLibrary() {
  const { assets, addAsset, deleteAsset, selection, selectionData } = useStore();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [naming, setNaming] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetCat, setAssetCat] = useState('Other');
  const nameRef = useRef<HTMLInputElement>(null);

  const categories = ['All', ...DEFAULT_CATEGORIES];
  const filtered = assets.filter(a =>
    (category === 'All' || a.category === category) &&
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const saveCurrentSelection = () => {
    if (!selectionData || !selection || selection.w < 4 || selection.h < 4) {
      alert('Make a selection on the canvas first (use the Select tool).');
      return;
    }
    setAssetName(`Asset ${assets.length + 1}`);
    setNaming(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const confirmSave = () => {
    if (!selectionData || !selection) return;
    // Make thumb
    const tmp = document.createElement('canvas');
    tmp.width = 60; tmp.height = 60;
    const ctx = tmp.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 60, 60);
    const img = new Image();
    img.onload = () => {
      const aspectW = selection.w / selection.h;
      let tw = 60, th = 60;
      if (aspectW > 1) th = Math.round(60 / aspectW);
      else tw = Math.round(60 * aspectW);
      ctx.drawImage(img, (60 - tw) / 2, (60 - th) / 2, tw, th);
      const thumb = tmp.toDataURL('image/jpeg', 0.8);
      const asset: Asset = {
        id: crypto.randomUUID(),
        name: assetName,
        category: assetCat,
        data: selectionData,
        width: selection.w,
        height: selection.h,
        thumb,
      };
      addAsset(asset);
      setNaming(false);
    };
    img.src = selectionData;
  };

  const pasteAsset = (asset: Asset) => {
    window.dispatchEvent(new CustomEvent('flipnote:paste-asset', { detail: { asset } }));
  };

  return (
    <div className="flex flex-col" style={{ width: 200, borderLeft: '1px solid #374151', background: '#111827', overflow: 'hidden' }}>
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <span className="panel-label mb-0">ASSET LIBRARY</span>
          <button
            className="btn"
            style={{ fontSize: 10, padding: '1px 6px' }}
            title="Save current selection as asset"
            onClick={saveCurrentSelection}
          >
            + Save Selection
          </button>
        </div>
        <input
          type="text"
          placeholder="Search assets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', fontSize: 11 }}
        />
      </div>

      {/* Save dialog */}
      {naming && (
        <div className="px-2 py-2 border-b border-gray-700" style={{ background: '#1f2937' }}>
          <div className="panel-label">Name this asset</div>
          <input
            ref={nameRef}
            type="text"
            value={assetName}
            onChange={e => setAssetName(e.target.value)}
            style={{ width: '100%', fontSize: 11, marginBottom: 4 }}
            onKeyDown={e => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setNaming(false); }}
          />
          <select
            value={assetCat}
            onChange={e => setAssetCat(e.target.value)}
            style={{ width: '100%', marginBottom: 6 }}
          >
            {DEFAULT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div className="flex gap-1">
            <button className="btn active flex-1" style={{ fontSize: 10 }} onClick={confirmSave}>Save</button>
            <button className="btn flex-1" style={{ fontSize: 10 }} onClick={() => setNaming(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-0.5 px-1 py-1 border-b border-gray-700">
        {categories.map(c => (
          <button
            key={c}
            className={`btn ${category === c ? 'active' : ''}`}
            style={{ fontSize: 9, padding: '1px 5px' }}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: '20px 8px' }}>
            {assets.length === 0
              ? 'No assets yet.\nSelect an area on canvas and click "+ Save Selection".'
              : 'No matching assets.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {filtered.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onPaste={() => pasteAsset(asset)}
                onDelete={() => deleteAsset(asset.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Import image as asset */}
      <div className="px-2 py-2 border-t border-gray-700">
        <button
          className="btn w-full"
          style={{ fontSize: 10, justifyContent: 'center' }}
          title="Import PNG/JPG as asset"
          onClick={() => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = () => {
              const file = inp.files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                const img = new Image();
                img.onload = () => {
                  const th = document.createElement('canvas');
                  th.width = 60; th.height = 60;
                  th.getContext('2d')!.drawImage(img, 0, 0, 60, 60);
                  addAsset({
                    id: crypto.randomUUID(),
                    name: file.name.replace(/\.[^.]+$/, ''),
                    category: 'Other',
                    data: dataUrl,
                    width: img.width,
                    height: img.height,
                    thumb: th.toDataURL('image/jpeg', 0.8),
                  });
                };
                img.src = dataUrl;
              };
              reader.readAsDataURL(file);
            };
            inp.click();
          }}
        >
          📥 Import Image
        </button>
      </div>
    </div>
  );
}

function AssetCard({ asset, onPaste, onDelete }: { asset: Asset; onPaste: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        position: 'relative',
        width: 60,
        height: 60,
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid #374151',
        background: 'white',
      }}
      title={`${asset.name} (${asset.category})\n${asset.width}×${asset.height}px\nClick to paste`}
      onClick={onPaste}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <img src={asset.thumb} width={60} height={60} style={{ display: 'block', objectFit: 'contain' }} />
      {hover && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          <span style={{ fontSize: 9, color: 'white', textAlign: 'center', padding: '0 2px', lineHeight: 1.2 }}>
            {asset.name}
          </span>
          <button
            style={{ fontSize: 9, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 3, padding: '1px 5px', cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
