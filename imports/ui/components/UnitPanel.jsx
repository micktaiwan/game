import React from 'react';

export const UnitPanel = ({ ccMenu, menuRef, base, spawnScout, spawnSoldier }) => (
  ccMenu.open ? (
    <div ref={menuRef} style={{ position: 'fixed', left: ccMenu.x, top: ccMenu.y, zIndex: 15, pointerEvents: 'auto' }}>
      <div style={{
        background: 'rgba(14,20,27,0.95)',
        color: '#e6edf3',
        border: '1px solid #e6edf3',
        borderRadius: 6,
        padding: 8,
        minWidth: 160
      }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Command Center</div>
        <button
          onClick={spawnScout}
          disabled={(base?.metal ?? 0) < 20}
          style={{
            width: '100%',
            background: (base?.metal ?? 0) < 20 ? 'rgba(14,20,27,0.4)' : 'rgba(0,146,88,0.2)',
            color: (base?.metal ?? 0) < 20 ? '#6b7785' : '#32d296',
            border: `1px solid ${(base?.metal ?? 0) < 20 ? '#6b7785' : '#32d296'}`,
            borderRadius: 4,
            padding: '6px 8px',
            fontSize: 13,
            cursor: (base?.metal ?? 0) < 20 ? 'not-allowed' : 'pointer'
          }}
          title="Produce a Scout unit (20 Metal)"
        >
          Spawn Scout (20 Metal)
        </button>
        <button
          onClick={spawnSoldier}
          disabled={(base?.metal ?? 0) < 30}
          style={{
            marginTop: 6,
            width: '100%',
            background: (base?.metal ?? 0) < 30 ? 'rgba(14,20,27,0.4)' : 'rgba(0,88,146,0.2)',
            color: (base?.metal ?? 0) < 30 ? '#6b7785' : '#2da8ff',
            border: `1px solid ${(base?.metal ?? 0) < 30 ? '#6b7785' : '#2da8ff'}`,
            borderRadius: 4,
            padding: '6px 8px',
            fontSize: 13,
            cursor: (base?.metal ?? 0) < 30 ? 'not-allowed' : 'pointer'
          }}
          title="Produce a Soldier unit (30 Metal)"
        >
          Spawn Soldier (30 Metal)
        </button>
      </div>
    </div>
  ) : null
);


