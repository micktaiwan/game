import React, { useEffect, useRef, useState } from 'react';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { createThreeApp } from '/imports/game/scene/createThreeApp';
import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';
import { Meteor } from 'meteor/meteor';
import { Notifications } from '/imports/ui/Notifications.jsx';

/**
 * Top-level UI component. Client is authoritative for base placement.
 * Subscribes to Meteor collections and synchronizes the 3D scene via an imperative API.
 */
export const App = () => {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const menuRef = useRef(null);
  const selectedUnitRef = useRef(null);
  const unitsRef = useRef([]);
  // Subscriptions (tiles/units/resources/base)
  const isLoadingTiles = useSubscribe('tiles');
  const isLoadingUnits = useSubscribe('units');
  const isLoadingResources = useSubscribe('resources');
  const isLoadingBases = useSubscribe('bases');
  const tiles = useFind(() => TilesCollection.find());
  const units = useFind(() => UnitsCollection.find());
  const resources = useFind(() => ResourcesCollection.find());
  const base = useFind(() => BasesCollection.find({ _id: 'player' }))[0];
  const [messages, setMessages] = useState([]);
  const [messageQueue, setMessageQueue] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const messageQueueRef = useRef([]);
  useEffect(() => { messageQueueRef.current = messageQueue; }, [messageQueue]);
  const hasIntroRunRef = useRef(false);
  const [ccMenu, setCcMenu] = useState({ open: false, q: null, r: null, x: 0, y: 0 });
  const [sceneNonce, setSceneNonce] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  // UI intro: fade in panels after scene intro
  const [uiVisible, setUiVisible] = useState(false);
  // GFX UI local state (to reflect initial values from scene)
  const [gfxUI, setGfxUI] = useState({
    exposure: 1.1,
    ambientIntensity: 0.8,
    bloomEnabled: true,
    bloomStrength: 0.25,
    bloomThreshold: 0.75,
    fxaaEnabled: true,
    fogEnabled: false,
    fogDensity: 0.0005,
    tileEmissiveIntensity: 0.22,
    tileBrightness: 1.0,
    outlineOpacity: 0.9,
    dirLightAzimuthDeg: 0,
    dirLightOrbitSpeedDeg: 12,
    dirLightAutoOrbit: false,
  });
  const [showGfx, setShowGfx] = useState(false);
  // Low energy prompt logic: show on crossing below 20, hide on click, re-show after rising >=20 then falling again
  const [showLowEnergyPrompt, setShowLowEnergyPrompt] = useState(false);

  function pushMessage(text, level = 'info') {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const msg = { id, text, level, ts: new Date() };
    if (!notificationsEnabled) {
      setMessageQueue((q) => q.concat(msg));
      return;
    }
    setMessages((prev) => {
      const next = [...prev, msg];
      // If more than 5 active messages, animate-dismiss the oldest non-closing one
      const activeCount = next.filter((m) => !m.closing).length;
      if (activeCount > 5) {
        const oldestIdx = next.findIndex((m) => !m.closing);
        if (oldestIdx !== -1) {
          const oldest = next[oldestIdx];
          next[oldestIdx] = { ...oldest, closing: true };
          setTimeout(() => {
            setMessages((cur) => cur.filter((m) => m.id !== oldest.id));
          }, 350);
        }
      }
      return next;
    });
  }

  function dismissMessage(id) {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], closing: true };
      setTimeout(() => {
        setMessages((cur) => cur.filter((m) => m.id !== id));
      }, 350);
      return next;
    });
  }

  useEffect(() => {
    if (isLoadingTiles() || isLoadingUnits() || isLoadingResources() || isLoadingBases()) return;
    const container = mountRef.current;
    if (!container) return;
    const tilesData = tiles.map(t => ({ q: t.q, r: t.q ? t.r : t.r }));
    // Decide authoritative base position: if not set, compute south-most via scene heuristic
    const basePos = (base && typeof base.baseQ === 'number') ? { q: base.baseQ, r: base.baseR } : null;
    apiRef.current = createThreeApp(container, tilesData, {
      base: basePos,
      onBaseCandidate: async ({ q, r }) => {
        // Persist base position exactly once after a reset when the DB has no baseQ/baseR
        if (!(base && typeof base.baseQ === 'number')) {
          try { await Meteor.callAsync('base.setPosition', { q, r }); } catch (e) {}
        }
      },
      onSelectCommandCenter: ({ tile, pointer }) => {
        // Reset current selection when CC is clicked
        setSelectedUnitId(null);
        setSelectedResourceId(null);
        if (apiRef.current?.setSelectedUnitId) apiRef.current.setSelectedUnitId(null);
        selectedUnitRef.current = null;
        if (pointer) {
          setCcMenu({ open: true, q: tile.q, r: tile.r, x: pointer.x, y: pointer.y });
        }
      },
      onSelectUnit: ({ unit }) => {
        if (!unit) return;
        setSelectedUnitId(unit._id);
        setSelectedResourceId(null);
        if (apiRef.current?.setSelectedUnitId) apiRef.current.setSelectedUnitId(unit._id);
        selectedUnitRef.current = unit._id;
      },
      onSelectResource: async ({ resource }) => {
        if (!resource) return;
        // If a scout is currently selected, auto-switch it to harvest mode
        const selId = selectedUnitRef.current;
        if (selId) {
          const unit = UnitsCollection.findOne({ _id: selId });
          if (unit && (unit.type || 'scout') === 'scout') {
            try {
              await Meteor.callAsync('units.setGoal', { unitId: selId, goal: 'harvest' });
              pushMessage('Scout set to Harvest', 'success');
              // Keep the scout selected; also show resource info in the panel
              setSelectedResourceId(resource._id);
              return;
            } catch (e) {
              pushMessage(`Failed to set harvest: ${e?.reason || e?.message}`, 'danger');
            }
          }
        }
        // Default: select the resource and clear unit selection
        setSelectedUnitId(null);
        if (apiRef.current?.setSelectedUnitId) apiRef.current.setSelectedUnitId(null);
        setSelectedResourceId(resource._id);
        selectedUnitRef.current = null;
      },
      onExploreDirection: async ({ direction }) => {
        const id = selectedUnitRef.current;
        if (!id) return;
        const uType = UnitsCollection.findOne({ _id: id })?.type || 'scout';
        if (uType !== 'scout') return; // explore only for scouts
        try {
          await Meteor.callAsync('units.setGoal', { unitId: id, goal: 'explore', goalData: { direction } });
          pushMessage('Explore mode set', 'success');
        } catch (e) {
          pushMessage(`Failed to set explore: ${e?.reason || e?.message}`, 'danger');
        }
      },
      onClickTile: async ({ tile }) => {
        const selectedId = selectedUnitRef.current;
        const unitsNow = unitsRef.current || [];
        // 1) If a unit is on this tile: select it
        const unitOnTile = unitsNow.find(u => u.q === tile.q && u.r === tile.r);
        if (unitOnTile) {
          setSelectedUnitId(unitOnTile._id);
          setSelectedResourceId(null);
          if (apiRef.current?.setSelectedUnitId) apiRef.current.setSelectedUnitId(unitOnTile._id);
          selectedUnitRef.current = unitOnTile._id;
          return;
        }
        // 2) If a resource is on this tile: select it, or harvest if a scout is selected
        const resOnTile = resources.find(r => r.q === tile.q && r.r === tile.r);
        if (resOnTile) {
          if (selectedId) {
            const selUnit = UnitsCollection.findOne({ _id: selectedId }) || unitsNow.find(u => u._id === selectedId);
            if (selUnit && (selUnit.type || 'scout') === 'scout') {
              try {
                await Meteor.callAsync('units.setGoal', { unitId: selectedId, goal: 'harvest' });
                setSelectedResourceId(resOnTile._id);
                pushMessage('Harvest mode set', 'success');
                return;
              } catch (e) {
                pushMessage(`Failed to set harvest: ${e?.reason || e?.message}`, 'danger');
              }
            }
          }
          // Default: just show the resource
          setSelectedResourceId(resOnTile._id);
          if (apiRef.current?.setSelectedUnitId) apiRef.current.setSelectedUnitId(null);
          setSelectedUnitId(null);
          selectedUnitRef.current = null;
          return;
        }
        // 3) Otherwise, if a scout is currently selected: issue Explore towards that tile
        if (selectedId) {
          const unit = UnitsCollection.findOne({ _id: selectedId }) || unitsNow.find(u => u._id === selectedId);
          if (!unit) {
            console.warn('[UI] Selected unit not found in client cache', { id: selectedId, unitsCount: unitsNow.length });
            pushMessage('Selected unit not found. Please reselect.', 'danger');
            return;
          }
          if ((unit.type || 'scout') !== 'scout') return; // only scouts can explore via tile click
          const radius = 0.6;
          const wp = (q, r) => ({ x: radius * (3/2) * q, z: radius * Math.sqrt(3) * (r + q/2) });
          const a = wp(unit.q, unit.r);
          const b = wp(tile.q, tile.r);
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          try {
            await Meteor.callAsync('units.setGoal', { unitId: selectedId, goal: 'explore', goalData: { direction: { x: dx, z: dz } } });
            pushMessage('Explore mode set', 'success');
          } catch (e) {
            pushMessage(`Failed to set explore: ${e?.reason || e?.message}`, 'danger');
          }
        }
      },
      units: units.map(u => ({ _id: u._id, type: u.type, q: u.q, r: u.r, hp: u.hp, energy: u.energy, goal: u.goal, prevQ: u.prevQ, prevR: u.prevR, lastMoveAt: u.lastMoveAt, buildHoldUntil: u.buildHoldUntil })),
      resources: resources.map(res => ({ _id: res._id, kind: res.kind, q: res.q, r: res.r, amount: res.amount }))
    });
    pushMessage('Welcome Commander. Initializing systems...', 'success');
    pushMessage(
      'Controls:\n- Pan: Drag (left click)\n- Orbit: Shift+Drag or Right Drag\n- Zoom: Mouse wheel / Pinch\n\nUnits:\n- Select a scout by clicking it (highlighted).\n- Press I: Idle mode\n- Press H: Harvest nearest resource\n- Click a tile: Explore towards that direction',
      'info'
    );
    // End of reset cycle if any
    if (isResetting) setIsResetting(false);
    // Reset intro run flag on scene (re)creation
    hasIntroRunRef.current = false;
    return () => apiRef.current && apiRef.current.cleanup && apiRef.current.cleanup();
  }, [isLoadingTiles(), isLoadingUnits(), isLoadingResources(), isLoadingBases(), sceneNonce]);

  // Schedule UI fade-in after scene intro (based on tile count and stagger used in scene)
  useEffect(() => {
    if (!tiles?.length) return;
    if (hasIntroRunRef.current) return; // don't re-run on later tile creations
    // Scene uses ~18ms stagger per tile and ~500ms drop. Add ~600ms buffer for CC/resources.
    const introMs = Math.min(6000, tiles.length * 18 + 1100);
    setUiVisible(false);
    const t = setTimeout(() => setUiVisible(true), introMs);
    const t2 = setTimeout(() => {
      setNotificationsEnabled(true);
      setMessages((prev) => prev.concat(messageQueueRef.current));
      setMessageQueue([]);
      hasIntroRunRef.current = true;
    }, introMs + 350);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [sceneNonce, tiles?.length]);

  // After scene is ready, pull initial GFX settings to sync sliders
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !api.getGfxSettings) return;
    const s = api.getGfxSettings();
    setGfxUI({
      exposure: s.exposure,
      ambientIntensity: s.ambientIntensity,
      bloomEnabled: !!s.bloomEnabled,
      bloomStrength: s.bloomStrength,
      bloomThreshold: s.bloomThreshold,
      fxaaEnabled: !!s.fxaaEnabled,
      fogEnabled: !!s.fogEnabled,
      fogDensity: s.fogDensity,
      tileEmissiveIntensity: s.tileEmissiveIntensity,
      tileBrightness: s.tileBrightness ?? 1.0,
      outlineOpacity: s.outlineOpacity ?? 0.9,
      dirLightAzimuthDeg: s.dirLightAzimuthDeg ?? 0,
      dirLightOrbitSpeedDeg: s.dirLightOrbitSpeedDeg ?? 12,
      dirLightAutoOrbit: !!s.dirLightAutoOrbit,
    });
  }, [apiRef.current]);

  // Keep light gizmo visibility in sync with panel visibility, including first load
  useEffect(() => {
    if (!apiRef.current || !apiRef.current.applyGfxSettings) return;
    apiRef.current.applyGfxSettings({ showLightGizmo: !!showGfx });
  }, [showGfx, apiRef.current]);

  useEffect(() => {
    if (!apiRef.current) return;
    const nextUnits = units.map(u => ({ _id: u._id, type: u.type, q: u.q, r: u.r, hp: u.hp, energy: u.energy, goal: u.goal, prevQ: u.prevQ, prevR: u.prevR, lastMoveAt: u.lastMoveAt, buildHoldUntil: u.buildHoldUntil }));
    if (apiRef.current.setUnits) apiRef.current.setUnits(nextUnits);
    unitsRef.current = units;
  }, [units.map(u => u._id + ':' + u.q + ',' + u.r + ':' + (u.goal || 'idle')).join('|')]);

  // Refresh scene tiles when tiles collection changes (newly discovered tiles)
  useEffect(() => {
    if (!apiRef.current || !tiles?.length) return;
    const nextTiles = tiles.map(t => ({ q: t.q, r: t.r }));
    if (apiRef.current.setTiles) apiRef.current.setTiles(nextTiles);
    // Also ensure base is applied promptly after tiles update to avoid base-placement flash
    const basePosImmediate = base && typeof base.baseQ === 'number' ? { q: base.baseQ, r: base.baseR } : null;
    if (basePosImmediate && apiRef.current.setBase) apiRef.current.setBase(basePosImmediate);
  }, [tiles.map(t => t.q + ',' + t.r).join('|')]);

  useEffect(() => {
    selectedUnitRef.current = selectedUnitId || null;
  }, [selectedUnitId]);

  // Global key bindings for goal switching (case-insensitive)
  useEffect(() => {
    function onKeyDown(e) {
      if (!selectedUnitId) return;
      const key = (e.key || '').toLowerCase();
      const sel = UnitsCollection.findOne({ _id: selectedUnitId });
      const uType = sel?.type || 'scout';
      if (uType === 'soldier') {
        if (key === 'i' || key === 'd') {
          Meteor.call('units.setGoal', { unitId: selectedUnitId, goal: 'defend' });
          pushMessage('Defend mode set', 'success');
        } else if (key === 'a') {
          Meteor.call('units.setGoal', { unitId: selectedUnitId, goal: 'attack' });
          pushMessage('Attack mode set', 'success');
        }
      } else {
        if (key === 'i') {
          Meteor.call('units.setGoal', { unitId: selectedUnitId, goal: 'idle' });
          pushMessage('Idle mode set', 'success');
        } else if (key === 'h') {
          Meteor.call('units.setGoal', { unitId: selectedUnitId, goal: 'harvest' });
          pushMessage('Harvest mode set', 'success');
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedUnitId]);

  useEffect(() => {
    if (!apiRef.current) return;
    const nextResources = resources.map(res => ({ _id: res._id, kind: res.kind, q: res.q, r: res.r, amount: res.amount }));
    if (apiRef.current.setResources) apiRef.current.setResources(nextResources);
  }, [resources.map(r => r._id + ':' + r.q + ',' + r.r).join('|')]);

  // Keep base position in sync after resets
  useEffect(() => {
    if (!apiRef.current) return;
    // If base is not set in DB yet, compute screen-south tile and persist it once
    if (!(base && typeof base.baseQ === 'number') && tiles?.length && apiRef.current) {
      // Reuse scene heuristic: pick south-most among current tiles via camera/screen
      // We approximate by reading the commandCenterTile if created; else skip
      // As we don't expose it, fallback to first tile; on next pass base will be set
      const first = tiles[0];
      if (first) {
        Meteor.call('base.setPosition', { q: first.q, r: first.r });
      }
      return;
    }
    const basePos = { q: base.baseQ, r: base.baseR };
    if (apiRef.current.setBase) apiRef.current.setBase(basePos);
  }, [base?.baseQ, base?.baseR]);

  // Energy transitions: zero notification, low-energy prompt arming
  const prevEnergyRef = useRef(null);
  useEffect(() => {
    const current = typeof base?.energy === 'number' ? base.energy : null;
    const prev = prevEnergyRef.current;
    if (prev === null) {
      prevEnergyRef.current = current;
      if (typeof current === 'number' && current < 20) {
        setShowLowEnergyPrompt(true);
      }
      return;
    }
    if (typeof current === 'number') {
      // Energy depleted notification
      if (prev > 0 && current <= 0) {
        pushMessage('Energy depleted. Units cannot move until you harvest more.', 'danger');
      }
      // Arm low-energy prompt when crossing from >=20 to <20
      if (prev >= 20 && current < 20) {
        setShowLowEnergyPrompt(true);
      }
      // Disarm when recovering to >=20
      if (prev < 20 && current >= 20) {
        setShowLowEnergyPrompt(false);
      }
    }
    prevEnergyRef.current = current;
  }, [base?.energy]);

  async function spawnScout() {
    try {
      const { q, r } = ccMenu;
      const res = await Meteor.callAsync('units.spawnScout', { base: { q, r } });
      pushMessage(`Scout produced at (q=${res.q}, r=${res.r})`, 'success');
      setCcMenu((m) => ({ ...m, open: false }));
    } catch (err) {
      pushMessage(`Failed to produce scout: ${err?.reason || err?.message}`, 'danger');
    }
  }

  async function spawnSoldier() {
    try {
      const { q, r } = ccMenu;
      const res = await Meteor.callAsync('units.spawnSoldier', { base: { q, r } });
      pushMessage(`Soldier produced at (q=${res.q}, r=${res.r})`, 'success');
      setCcMenu((m) => ({ ...m, open: false }));
    } catch (err) {
      pushMessage(`Failed to produce soldier: ${err?.reason || err?.message}`, 'danger');
    }
  }

  // Close CC menu when clicking anywhere outside of it
  useEffect(() => {
    function onGlobalMouseDown(e) {
      if (!ccMenu.open) return;
      const el = menuRef.current;
      if (el && el.contains(e.target)) return; // click inside menu → ignore
      setCcMenu((m) => (m.open ? { ...m, open: false } : m));
    }
    window.addEventListener('mousedown', onGlobalMouseDown);
    return () => window.removeEventListener('mousedown', onGlobalMouseDown);
  }, [ccMenu.open]);
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {/* Selection HUD */}
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
              if (!u) return <div style={{ opacity: 0.6 }}>No unit</div>;
              return (
                <div style={{ pointerEvents: 'auto' }}>
                  <div>Unit: <strong>{u.type.toUpperCase()}</strong> @ (q={u.q}, r={u.r})</div>
                  <div>Mode: <strong>{(u.goal || ((u.type||'scout')==='soldier'?'defend':'idle')).toUpperCase()}</strong></div>
                  { (u.type || 'scout') === 'soldier' ? (
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
              if (!r) return <div style={{ opacity: 0.6 }}>No resource</div>;
              return (
                <div style={{ pointerEvents: 'auto' }}>
                  <div>Resource: <strong>{r.kind.toUpperCase()}</strong> @ (q={r.q}, r={r.r})</div>
                  <div>Reward: <strong>{r.amount}</strong></div>
                  <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>Harvest gives the reward to the Command Center.</div>
                </div>
              );
            })()
          ) : (
            <div style={{ opacity: 0.6 }}>No selection</div>
          )}
        </div>
      </div>
      {/* HUD: base stockpile */}
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
                  // Hide until energy recovers to >=20 and falls again
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
      {ccMenu.open && (
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
      )}
      <div style={{ position: 'fixed', top: 10, left: 10, zIndex: 10, pointerEvents: uiVisible ? 'auto' : 'none', opacity: uiVisible ? 1 : 0, transform: uiVisible ? 'translateY(0px)' : 'translateY(-6px)', transition: 'opacity 400ms ease, transform 400ms ease' }}>
        <button
          onClick={() => apiRef.current && apiRef.current.resetView && apiRef.current.resetView()}
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
          onClick={() => {
            const next = !showGfx;
            setShowGfx(next);
            apiRef.current?.applyGfxSettings?.({ showLightGizmo: next });
          }}
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
        <button
          onClick={async () => {
            await resetGame({ apiRef, setSceneNonce, setMessages, setCcMenu });
          }}
          style={{
            marginLeft: 8,
            background: 'rgba(146,0,0,0.2)',
            color: '#ff6b6b',
            border: '1px solid #ff6b6b',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer'
          }}
          title="Danger: reset tiles collection"
        >
          Reset tiles (danger)
        </button>
      </div>
      {/* GFX Controls */}
      {showGfx && (
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
      )}
      <div style={{ opacity: uiVisible ? 1 : 0, transition: 'opacity 500ms ease 50ms', pointerEvents: uiVisible ? 'auto' : 'none' }}>
      <Notifications messages={messages} onDismiss={dismissMessage} />
      </div>
    </div>
  );
};

async function resetGame({ apiRef, setSceneNonce, setMessages, setCcMenu }) {
  try {
    // Clear UI to avoid duplicate messages and flash
    setCcMenu({ open: false, q: null, r: null, x: 0, y: 0 });
    setMessages([]);
    if (apiRef.current && apiRef.current.cleanup) {
      apiRef.current.cleanup();
      apiRef.current = null;
    }
    // Server-side reset (returns base position)
    await Meteor.callAsync('tiles.reset', 4);
    // Recreate scene on next render cycle
    setSceneNonce((n) => n + 1);
  } catch (e) {
    // Fallback message
    setMessages((prev) => prev.concat({ id: `${Date.now()}-err`, text: `Reset failed: ${e?.reason || e?.message}` , level: 'danger', ts: new Date() }));
  }
}
