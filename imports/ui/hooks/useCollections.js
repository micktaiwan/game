import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';

export function useCollections() {
  const isLoadingTiles = useSubscribe('tiles');
  const isLoadingUnits = useSubscribe('units');
  const isLoadingResources = useSubscribe('resources');
  const isLoadingBases = useSubscribe('bases');
  const tiles = useFind(() => TilesCollection.find());
  const units = useFind(() => UnitsCollection.find());
  const resources = useFind(() => ResourcesCollection.find());
  const base = useFind(() => BasesCollection.find({ _id: 'player' }))[0];
  return { isLoadingTiles, isLoadingUnits, isLoadingResources, isLoadingBases, tiles, units, resources, base };
}


