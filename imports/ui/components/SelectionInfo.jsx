import React from 'react';
import { UI_OPACITY_DIM } from '/imports/shared/ui.js';
import { Meteor } from 'meteor/meteor';

export const SelectionInfo = ({ uiVisible, selectedUnitId, selectedResourceId, units, resources, pushMessage }) => (
  <div style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 12, pointerEvents: 'none', opacity: uiVisible ? 1 : 0, transform: uiVisible ? 'translateY(0px)' : 'translateY(8px)', transition: 'opacity 400ms ease, transform 400ms ease' }}>
    <div style={{
      background: 'rgba(14,20,27,0.7)',
      color: '#e6edf3',
      border: '1px solid #e6edf3',
      borderRadius: 6,
      padding: '8px 10px',
      fontSize: 14,
      minWidth: 220,
    }}>
      <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4 }}>Selection</div>
      {selectedUnitId ? (
        (() => {
          const u = units.find(x => x._id === selectedUnitId);
          if (!u) return <div style={{ opacity: UI_OPACITY_DIM }}>No unit</div>;
          const effectiveGoal = (u.goal || ((u.type || 'scout') === 'soldier' ? 'defend' : 'idle'));
          const modeColorMap = { idle: '#32d296', harvest: '#ffd166', explore: '#bc66ff', defend: '#2da8ff', attack: '#ff4d4d' };
          const modeColor = modeColorMap[effectiveGoal] || '#e6edf3';
          return (
            <div style={{ pointerEvents: 'auto' }}>
              <div>Unit: <strong>{u.type.toUpperCase()}</strong> @ (q={u.q}, r={u.r})</div>
              <div>Mode: <strong style={{ color: modeColor }}>{effectiveGoal.toUpperCase()}</strong></div>
              {(u.type || 'scout') === 'soldier' ? (
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <button onClick={async () => { await Meteor.callAsync('units.setGoal', { unitId: u._id, goal: 'defend' }); }} style={{ cursor: 'pointer' }}>I/D: Defend</button>
                  <button onClick={async () => { await Meteor.callAsync('units.setGoal', { unitId: u._id, goal: 'attack' }); }} style={{ cursor: 'pointer' }}>A: Attack</button>
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                    <button onClick={async () => { await Meteor.callAsync('units.setGoal', { unitId: u._id, goal: 'idle' }); }} style={{ cursor: 'pointer' }}>I: Idle</button>
                    <button onClick={async () => { await Meteor.callAsync('units.setGoal', { unitId: u._id, goal: 'harvest' }); }} style={{ cursor: 'pointer' }}>H: Harvest</button>
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>Click a tile to Explore towards it</div>
                </>
              )}
            </div>
          );
        })()
      ) : selectedResourceId ? (
        (() => {
          const r = resources.find(x => x._id === selectedResourceId);
          if (!r) return <div style={{ opacity: UI_OPACITY_DIM }}>No resource</div>;
          return (
            <div style={{ pointerEvents: 'auto' }}>
              <div>Resource: <strong>{r.kind.toUpperCase()}</strong> @ (q={r.q}, r={r.r})</div>
              <div>Reward: <strong>{r.amount}</strong></div>
              <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>Harvest gives the reward to the Command Center.</div>
            </div>
          );
        })()
      ) : (
        <div style={{ opacity: UI_OPACITY_DIM }}>No selection</div>
      )}
    </div>
  </div>
);


