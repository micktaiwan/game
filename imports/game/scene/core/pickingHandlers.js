import * as THREE from 'three';
import { findPickedUnitId } from './picking';

/**
 * Handle a click pick (tile-first invariant, with CC/unit/resource routing).
 * Returns true if a target was handled.
 */
export function handleClickPick({
  ndc,
  camera,
  unitsGroup,
  tilesGroup,
  resourcesGroup,
  commandCenter,
  commandCenterTile,
  currentSelectedUnitId,
  optionsUnits,
  optionsResources,
  onSelectUnit,
  onSelectResource,
  onSelectCommandCenter,
  onClickTile,
  pointer,
}) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);

  // If no unit currently selected, try picking a unit directly under cursor first
  if (!currentSelectedUnitId) {
    const unitHitsPre = raycaster.intersectObject(unitsGroup, true);
    if (unitHitsPre.length > 0) {
      for (const h of unitHitsPre) {
        const chosenUnitId = findPickedUnitId(h);
        if (chosenUnitId && typeof onSelectUnit === 'function') {
          const unit = optionsUnits.find((u) => u._id === chosenUnitId) || null;
          onSelectUnit({ unit });
          return true;
        }
      }
    }
  }

  // Tile-first invariant
  const tileHitsCmd = raycaster.intersectObject(tilesGroup, true);
  if (tileHitsCmd.length > 0) {
    const tObj = tileHitsCmd[0].object;
    const info = tObj && tObj.userData;
    if (info && info.kind === 'tile') {
      // If this tile hosts the Command Center, route to CC selection
      if (
        commandCenterTile &&
        info.q === commandCenterTile.q &&
        info.r === commandCenterTile.r &&
        typeof onSelectCommandCenter === 'function'
      ) {
        onSelectCommandCenter({ tile: commandCenterTile, pointer });
        return true;
      }
      if (typeof onClickTile === 'function') {
        onClickTile({ tile: { q: info.q, r: info.r } });
        return true;
      }
    }
  }

  // Then try command center
  if (commandCenter) {
    const hit = raycaster.intersectObject(commandCenter, true);
    if (hit.length > 0 && typeof onSelectCommandCenter === 'function') {
      onSelectCommandCenter({ tile: commandCenterTile, pointer });
      return true;
    }
  }

  // Then try resources (only if no tile was resolved)
  const resHits = raycaster.intersectObject(resourcesGroup, true);
  if (resHits.length > 0) {
    const first = resHits[0].object;
    const data = (first && first.userData) || {};
    if (data.kind === 'resource' && typeof onSelectResource === 'function') {
      const resource = optionsResources.find((r) => r._id === data.resourceId) || null;
      onSelectResource({ resource });
      return true;
    }
  }

  // Then try units (fallback)
  const unitHits = raycaster.intersectObject(unitsGroup, true);
  if (unitHits.length > 0) {
    for (const h of unitHits) {
      const chosenUnitId = findPickedUnitId(h);
      if (chosenUnitId && typeof onSelectUnit === 'function') {
        const unit = optionsUnits.find((u) => u._id === chosenUnitId) || null;
        onSelectUnit({ unit });
        return true;
      }
    }
  }

  // Then try tiles (fallback)
  const tileHits = raycaster.intersectObject(tilesGroup, true);
  if (tileHits.length > 0 && typeof onClickTile === 'function') {
    const tObj = tileHits[0].object;
    const info = tObj && tObj.userData;
    if (info && info.kind === 'tile') {
      onClickTile({ tile: { q: info.q, r: info.r } });
      return true;
    }
  }

  // Then try command center again
  if (commandCenter) {
    const hit = raycaster.intersectObject(commandCenter, true);
    if (hit.length > 0 && typeof onSelectCommandCenter === 'function') {
      onSelectCommandCenter({ tile: commandCenterTile, pointer });
      return true;
    }
  }

  return false;
}


