import { useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { UnitsCollection } from '/imports/api/units';

export function useUnitHotkeys({ selectedUnitId, pushMessage }) {
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
}


