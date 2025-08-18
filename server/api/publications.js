import { Meteor } from 'meteor/meteor';
import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';

Meteor.publish('tiles', function publishTiles() {
  return TilesCollection.find({}, { fields: { q: 1, r: 1 } });
});

Meteor.publish('units', function publishUnits() {
  return UnitsCollection.find({}, { fields: { type: 1, q: 1, r: 1, prevQ: 1, prevR: 1, lastMoveAt: 1, buildHoldUntil: 1, harvestHoldUntil: 1, pendingHarvestResourceId: 1, goal: 1, goalData: 1, hp: 1, energy: 1, createdAt: 1, updatedAt: 1 } });
});

Meteor.publish('resources', function publishResources() {
  return ResourcesCollection.find({}, { fields: { kind: 1, q: 1, r: 1, amount: 1, createdAt: 1 } });
});

Meteor.publish('bases', function publishBases() {
  return BasesCollection.find({ _id: 'player' }, { fields: { energy: 1, metal: 1, baseQ: 1, baseR: 1, updatedAt: 1 } });
});


