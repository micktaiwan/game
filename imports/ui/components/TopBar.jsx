import React from 'react';

export const TopBar = ({ onResetView, onToggleGfx, showGfx }) => (
  <div style={{ position: 'fixed', top: 10, left: 10, zIndex: 10, pointerEvents: 'auto' }}>
    <button
      onClick={onResetView}
      style={{
        background: 'rgba(14,20,27,0.7)',
        color: '#e6edf3',
        border: '1px solid #e6edf3',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        cursor: 'pointer'
      }}
    >
      Reset view
    </button>
    <button
      onClick={onToggleGfx}
      style={{
        marginLeft: 8,
        background: 'rgba(14,20,27,0.7)',
        color: '#e6edf3',
        border: '1px solid #e6edf3',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        cursor: 'pointer'
      }}
      title="Toggle GFX panel"
    >
      {showGfx ? 'Hide GFX' : 'Show GFX'}
    </button>
  </div>
);


