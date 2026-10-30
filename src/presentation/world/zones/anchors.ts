import * as THREE from 'three';

/*
 * Where each zone stands and the ids of its places. They live apart from the
 * zones so the terrain, the map and the missions can know them without
 * downloading the zones themselves.
 */

/** The routines house: a big dollhouse open at the front, east of the new neighborhood. */
export const HOME_AREA = { x: 64, z: 44, radius: 14, height: 2.2 } as const;

export const HomePlace = {
  bathroom: 'home:bathroom',
  bedroom: 'home:bedroom',
  kitchen: 'home:kitchen',
  back: 'home:back',
} as const;

/** Where the child appears when coming through the Casa portal (looking at the house). */
export const homeArrival = new THREE.Vector3(HOME_AREA.x, HOME_AREA.height, HOME_AREA.z + 6);

/** The school and its park, on a hill in the island's north-east. */
export const SCHOOL_AREA = { x: 45, z: -58, radius: 16, height: 5.5 } as const;

export const SchoolPlace = {
  classroom: 'school:classroom',
  teacher: 'school:teacher',
  park: 'school:park',
  back: 'school:back',
} as const;

/** Where the child appears when coming through the portal (looking at the school). */
export const schoolArrival = new THREE.Vector3(
  SCHOOL_AREA.x - 2,
  SCHOOL_AREA.height,
  SCHOOL_AREA.z + 9,
);

/** A flat clearing in the west of the island where the Nature missions happen. */
export const NATURE_CAMP = { x: -70, z: -15, radius: 15, height: 4.2 } as const;

export const NaturePlace = {
  farm: 'nature:farm',
  garden: 'nature:garden',
  recycling: 'nature:recycling',
  back: 'camp:back',
} as const;

/** Where the child appears when coming through the Nature portal. */
export const campArrival = new THREE.Vector3(
  NATURE_CAMP.x + 9,
  NATURE_CAMP.height,
  NATURE_CAMP.z + 5,
);

/** A quiet garden in the island's south-west, for the Emotions missions. */
export const EMOTIONS_GARDEN = { x: -60, z: 45, radius: 14, height: 4.6 } as const;

export const EmotionsPlace = {
  faces: 'emotions:faces',
  stories: 'emotions:stories',
  calm: 'emotions:calm',
  back: 'emotions:back',
} as const;

/** Where the child appears when coming through the portal (looking at the garden). */
export const emotionsArrival = new THREE.Vector3(
  EMOTIONS_GARDEN.x,
  EMOTIONS_GARDEN.height,
  EMOTIONS_GARDEN.z + 9,
);
