import { useEffect, useRef } from 'react';
import { Meteor } from 'meteor/meteor';
import { createThreeApp } from '/imports/game/scene/createThreeApp';
import { TILE_RADIUS } from '/imports/shared/constants.js';
import { UnitsCollection } from '/imports/api/units';

/**
 * Bridge hook to mount the 3D scene and wire selection callbacks to React state.
 * Keeps the façade API in a ref and exposes the DOM mount target.
 */
export function useSceneBridge({
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
}) {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const selectedUnitRef = useRef(null);
  const unitsRef = useRef([]);

  // Keep latest units available to tile click handler
  useEffect(() => { unitsRef.current = units; }, [units.map(u => u._id + ':' + u.q + ',' + u.r + ':' + (u.goal || 'idle')).join('|')]);

  useEffect(() => {
    if (isLoadingTiles() || isLoadingUnits() || isLoadingResources() || isLoadingBases()) return;
    const container = mountRef.current;
    if (!container) return;
    const tilesData = tiles.map(t => ({ q: t.q, r: t.r }));
    const basePos = (base && typeof base.baseQ === 'number') ? { q: base.baseQ, r: base.baseR } : null;
    apiRef.current = createThreeApp(container, tilesData, {
      base: basePos,
      onBaseCandidate: async ({ q, r }) => {
        if (!(base && typeof base.baseQ === 'number')) {
          try { await Meteor.callAsync('base.setPosition', { q, r }); } catch (e) {}
        }
      },
      onSelectCommandCenter: ({ tile, pointer }) => {
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
        const selId = selectedUnitRef.current;
        if (selId) {
          const unit = UnitsCollection.findOne({ _id: selId });
          if (unit && (unit.type || 'scout') === 'scout') {
            try {
              await Meteor.callAsync('units.setGoal', { unitId: selId, goal: 'harvest' });
              pushMessage('Scout set to Harvest', 'success');
              setSelectedResourceId(resource._id);
              // Guard: avoid immediate Explore overriding Harvest for a short window
              lastActionRef.current = { kind: 'harvest', at: Date.now() };
              return;
            } catch (e) {
              pushMessage(`Failed to set harvest: ${e?.reason || e?.message}`, 'danger');
            }
          }
        }
        setSelectedUnitId(null);
        if (apiRef.current?.setSelectedUnitId) apiRef.current.setSelectedUnitId(null);
        setSelectedResourceId(resource._id);
        selectedUnitRef.current = null;
      },
      onExploreDirection: async ({ direction }) => {
        const id = selectedUnitRef.current;
        if (!id) return;
        const uType = UnitsCollection.findOne({ _id: id })?.type || 'scout';
        if (uType !== 'scout') return;
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
        const unitOnTile = unitsNow.find(u => u.q === tile.q && u.r === tile.r);
        if (unitOnTile) {
          setSelectedUnitId(unitOnTile._id);
          setSelectedResourceId(null);
          if (apiRef.current?.setSelectedUnitId) apiRef.current.setSelectedUnitId(unitOnTile._id);
          selectedUnitRef.current = unitOnTile._id;
          return;
        }
        const resOnTile = resources.find(r => r.q === tile.q && r.r === tile.r);
        if (resOnTile) {
          if (selectedId) {
            const selUnit = UnitsCollection.findOne({ _id: selectedId }) || unitsNow.find(u => u._id === selectedId);
            if (selUnit && (selUnit.type || 'scout') === 'scout') {
              try {
                await Meteor.callAsync('units.setGoal', { unitId: selectedId, goal: 'harvest' });
                setSelectedResourceId(resOnTile._id);
                pushMessage('Harvest mode set', 'success');
                lastActionRef.current = { kind: 'harvest', at: Date.now() };
                return;
              } catch (e) {
                pushMessage(`Failed to set harvest: ${e?.reason || e?.message}`, 'danger');
              }
            }
          }
          setSelectedResourceId(resOnTile._id);
          if (apiRef.current?.setSelectedUnitId) apiRef.current.setSelectedUnitId(null);
          setSelectedUnitId(null);
          selectedUnitRef.current = null;
          return;
        }
        if (selectedId) {
          // Optional UX guard: avoid Explore right after Harvest click
          const now = Date.now();
          const recent = lastActionRef.current;
          if (recent && recent.kind === 'harvest' && (now - recent.at) < 500) {
            return;
          }
          const unit = UnitsCollection.findOne({ _id: selectedId }) || unitsNow.find(u => u._id === selectedId);
          if (!unit) {
            pushMessage('Selected unit not found. Please reselect.', 'danger');
            return;
          }
          if ((unit.type || 'scout') !== 'scout') return;
          const radius = TILE_RADIUS;
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
      resources: resources.map(res => ({ _id: res._id, kind: res.kind, q: res.q, r: res.r, amount: res.amount })),
    });
    // Welcome/help messages
    pushMessage('Welcome, Commander. Build, explore, and harvest to survive.', 'info');
    pushMessage('Tip: Click the Command Center to open the production menu.', 'success');
    return () => apiRef.current && apiRef.current.cleanup && apiRef.current.cleanup();
  }, [isLoadingTiles(), isLoadingUnits(), isLoadingResources(), isLoadingBases(), sceneNonce]);

  const lastActionRef = useRef(null);
  return { apiRef, mountRef, selectedUnitRef };
}


