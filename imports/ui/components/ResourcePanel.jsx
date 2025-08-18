import React from 'react';
import { Meteor } from 'meteor/meteor';

export const ResourcePanel = ({ uiVisible, base, showLowEnergyPrompt, setShowLowEnergyPrompt, pushMessage }) => (
  <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 12, pointerEvents: 'none', opacity: uiVisible ? 1 : 0, transform: uiVisible ? 'translateY(0px)' : 'translateY(-6px)', transition: 'opacity 400ms ease, transform 400ms ease' }}>
    <div style={{
      background: 'rgba(14,20,27,0.7)',
      color: '#e6edf3',
      border: '1px solid #e6edf3',
      borderRadius: 6,
      padding: '8px 10px',
      fontSize: 14,
      minWidth: 180,
      textAlign: 'right'
    }}>
      <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4, textAlign: 'left' }}>Command Center</div>
      <div>Energy: <strong>{base?.energy ?? '—'}</strong></div>
      <div>Metal: <strong>{base?.metal ?? '—'}</strong></div>
      {(typeof base?.energy === 'number' && base.energy < 20 && showLowEnergyPrompt) && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', pointerEvents: 'auto' }}>
          <span style={{ color: '#ffb86b', fontSize: 12 }}>Low Energy</span>
          <button
            onClick={async () => {
              await Meteor.callAsync('units.stopAll');
              pushMessage('STOP: Scouts set to Idle', 'danger');
              setShowLowEnergyPrompt(false);
            }}
            style={{
              background: 'rgba(146,0,0,0.2)',
              color: '#ff6b6b',
              border: '1px solid #ff6b6b',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 12,
              cursor: 'pointer'
            }}
            title="Stop all energy-costly actions (Scouts to Idle)"
          >
            STOP Units
          </button>
        </div>
      )}
    </div>
  </div>
);


