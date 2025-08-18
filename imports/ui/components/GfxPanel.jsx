import React from 'react';

export const GfxPanel = ({ gfxUI, setGfxUI, apiRef, pushMessage }) => {
  return (
    <div style={{ position: 'fixed', top: 10, left: 180, zIndex: 14, pointerEvents: 'auto', background: 'rgba(14,20,27,0.9)', color: '#e6edf3', border: '1px solid #e6edf3', borderRadius: 6, padding: 8, width: 260 }}>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>GFX</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'center' }}>
        <label style={{ fontSize: 12 }}>Exposure</label>
        <input type="range" min="0.3" max="3.0" step="0.02" value={gfxUI.exposure} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, exposure: v })); apiRef.current?.applyGfxSettings?.({ exposure: v }); }} />
        <label style={{ fontSize: 12 }}>Ambient</label>
        <input type="range" min="0.2" max="1.5" step="0.02" value={gfxUI.ambientIntensity} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, ambientIntensity: v })); apiRef.current?.applyGfxSettings?.({ ambientIntensity: v }); }} />
        <label style={{ fontSize: 12 }}>Bloom</label>
        <input type="checkbox" checked={gfxUI.bloomEnabled} onChange={(e) => { const v = e.target.checked; setGfxUI(s=>({ ...s, bloomEnabled: v })); apiRef.current?.applyGfxSettings?.({ bloomEnabled: v }); }} />
        <label style={{ fontSize: 12 }}>Bloom Str.</label>
        <input type="range" min="0" max="1" step="0.01" value={gfxUI.bloomStrength} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, bloomStrength: v })); apiRef.current?.applyGfxSettings?.({ bloomStrength: v }); }} />
        <label style={{ fontSize: 12 }}>Bloom Thr.</label>
        <input type="range" min="0" max="1" step="0.01" value={gfxUI.bloomThreshold} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, bloomThreshold: v })); apiRef.current?.applyGfxSettings?.({ bloomThreshold: v }); }} />
        <label style={{ fontSize: 12 }}>FXAA</label>
        <input type="checkbox" checked={gfxUI.fxaaEnabled} onChange={(e) => { const v = e.target.checked; setGfxUI(s=>({ ...s, fxaaEnabled: v })); apiRef.current?.applyGfxSettings?.({ fxaaEnabled: v }); }} />
        <label style={{ fontSize: 12 }}>Fog</label>
        <input type="checkbox" checked={gfxUI.fogEnabled} onChange={(e) => { const v = e.target.checked; setGfxUI(s=>({ ...s, fogEnabled: v })); apiRef.current?.applyGfxSettings?.({ fogEnabled: v }); }} />
        <label style={{ fontSize: 12 }}>Fog dens.</label>
        <input type="range" min="0" max="0.02" step="0.0005" value={gfxUI.fogDensity} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, fogDensity: v })); apiRef.current?.applyGfxSettings?.({ fogDensity: v }); }} />
        <label style={{ fontSize: 12 }}>Tiles emissive</label>
        <input type="range" min="0" max="2.0" step="0.01" value={gfxUI.tileEmissiveIntensity} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, tileEmissiveIntensity: v })); apiRef.current?.applyGfxSettings?.({ tileEmissiveIntensity: v }); }} />
        <label style={{ fontSize: 12 }}>Tile brightness</label>
        <input type="range" min="0.3" max="2.0" step="0.01" value={gfxUI.tileBrightness} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, tileBrightness: v })); apiRef.current?.applyGfxSettings?.({ tileBrightness: v }); }} />
        <label style={{ fontSize: 12 }}>Outline intensity</label>
        <input type="range" min="0.2" max="1.0" step="0.01" value={gfxUI.outlineOpacity} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, outlineOpacity: v })); apiRef.current?.applyGfxSettings?.({ outlineOpacity: v }); }} />
        <label style={{ fontSize: 12 }}>Light L↔R (deg)</label>
        <input type="range" min="-180" max="180" step="1" value={gfxUI.dirLightAzimuthDeg} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, dirLightAzimuthDeg: v })); apiRef.current?.applyGfxSettings?.({ dirLightAzimuthDeg: v }); }} />
        <label style={{ fontSize: 12 }}>Light auto-orbit</label>
        <input type="checkbox" checked={gfxUI.dirLightAutoOrbit} onChange={(e) => { const v = e.target.checked; setGfxUI(s=>({ ...s, dirLightAutoOrbit: v })); apiRef.current?.applyGfxSettings?.({ dirLightAutoOrbit: v }); }} />
        <label style={{ fontSize: 12 }}>Orbit speed (deg/s)</label>
        <input type="range" min="0" max="90" step="1" value={gfxUI.dirLightOrbitSpeedDeg} onChange={(e) => { const v = parseFloat(e.target.value); setGfxUI(s=>({ ...s, dirLightOrbitSpeedDeg: v })); apiRef.current?.applyGfxSettings?.({ dirLightOrbitSpeedDeg: v }); }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          onClick={async () => {
            try {
              const settings = apiRef.current?.getGfxSettings?.() || {};
              const json = JSON.stringify(settings, null, 2);
              await navigator.clipboard.writeText(json);
              pushMessage('GFX settings copied to clipboard', 'success');
            } catch (e) {
              pushMessage('Failed to copy GFX settings', 'danger');
            }
          }}
          style={{
            background: 'rgba(14,20,27,0.7)',
            color: '#e6edf3',
            border: '1px solid #e6edf3',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          Copy JSON
        </button>
      </div>
    </div>
  );
};


