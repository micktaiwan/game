import React, { useEffect, useRef, useState } from 'react';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
// createThreeApp is used inside useSceneBridge
import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';
import { Meteor } from 'meteor/meteor';
import { Notifications } from '/imports/ui/Notifications.jsx';
import { TopBar } from '/imports/ui/components/TopBar.jsx';
import { GfxPanel } from '/imports/ui/components/GfxPanel.jsx';
import { SelectionInfo } from '/imports/ui/components/SelectionInfo.jsx';
import { ResourcePanel } from '/imports/ui/components/ResourcePanel.jsx';
import { UnitPanel } from '/imports/ui/components/UnitPanel.jsx';
import { useSceneBridge } from '/imports/ui/hooks/useSceneBridge.js';
import { useUnitHotkeys } from '/imports/ui/hooks/useUnitHotkeys.js';

/**
 * Top-level UI component. Client is authoritative for base placement.
 * Subscribes to Meteor collections and synchronizes the 3D scene via an imperative API.
 */
export const App = () => {
  const menuRef = useRef(null);
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
  useUnitHotkeys({ selectedUnitId, pushMessage });

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

  const { apiRef, mountRef, selectedUnitRef } = useSceneBridge({
    tiles,
    units,
    resources,
    base,
    isLoadingTiles,
    isLoadingUnits,
    isLoadingResources,
    isLoadingBases,
    sceneNonce,
    setCcMenu,
    setSelectedUnitId,
    setSelectedResourceId,
    pushMessage,
  });

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
    apiRef.current.applyGfxSettings({ showLightGizmo: !!showGfx, dirLightAutoOrbit: !!showGfx });
  }, [showGfx, apiRef.current]);

  useEffect(() => {
    if (!apiRef.current) return;
    const nextUnits = units.map(u => ({ _id: u._id, type: u.type, q: u.q, r: u.r, hp: u.hp, energy: u.energy, goal: u.goal, prevQ: u.prevQ, prevR: u.prevR, lastMoveAt: u.lastMoveAt, buildHoldUntil: u.buildHoldUntil }));
    if (apiRef.current.setUnits) apiRef.current.setUnits(nextUnits);
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

  // Clamp CC menu to viewport and offset slightly from pointer
  useEffect(() => {
    if (!ccMenu.open) return;
    const el = menuRef.current;
    if (!el) return;
    // allow DOM to paint then measure
    const id = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const margin = 10;
      const offset = 8;
      let targetX = ccMenu.x + offset;
      let targetY = ccMenu.y + offset;
      const maxX = window.innerWidth - rect.width - margin;
      const maxY = window.innerHeight - rect.height - margin;
      targetX = Math.max(margin, Math.min(targetX, maxX));
      targetY = Math.max(margin, Math.min(targetY, maxY));
      if (targetX !== ccMenu.x || targetY !== ccMenu.y) {
        setCcMenu((m) => ({ ...m, x: targetX, y: targetY }));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [ccMenu.open, ccMenu.x, ccMenu.y]);
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {/* Selection HUD */}
      <SelectionInfo
        uiVisible={uiVisible}
        selectedUnitId={selectedUnitId}
        selectedResourceId={selectedResourceId}
        units={units}
        resources={resources}
        pushMessage={pushMessage}
      />
      {/* HUD: base stockpile */}
      <ResourcePanel
        uiVisible={uiVisible}
        base={base}
        showLowEnergyPrompt={showLowEnergyPrompt}
        setShowLowEnergyPrompt={setShowLowEnergyPrompt}
        pushMessage={pushMessage}
      />
      <UnitPanel ccMenu={ccMenu} menuRef={menuRef} base={base} spawnScout={spawnScout} spawnSoldier={spawnSoldier} />
      <div style={{ position: 'fixed', top: 10, left: 10, zIndex: 10, pointerEvents: uiVisible ? 'auto' : 'none', opacity: uiVisible ? 1 : 0, transform: uiVisible ? 'translateY(0px)' : 'translateY(-6px)', transition: 'opacity 400ms ease, transform 400ms ease', display: 'flex', gap: 8, alignItems: 'center' }}>
        <TopBar
          onResetView={() => apiRef.current && apiRef.current.resetView && apiRef.current.resetView()}
          onToggleGfx={() => { const next = !showGfx; setShowGfx(next); apiRef.current?.applyGfxSettings?.({ showLightGizmo: next }); }}
          showGfx={showGfx}
        />
        <button
          onClick={async () => { await resetGame({ apiRef, setSceneNonce, setMessages, setCcMenu }); }}
          style={{
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
        <GfxPanel gfxUI={gfxUI} setGfxUI={setGfxUI} apiRef={apiRef} pushMessage={pushMessage} />
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
