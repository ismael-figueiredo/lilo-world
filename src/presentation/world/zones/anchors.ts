/*
 * Where each zone stands and the ids of its places. They live apart from the
 * zones so the terrain, the map and the missions can know them without
 * downloading the zones themselves.
 */

/** The school and its park, on a hill in the island's north-east. */
export const SCHOOL_AREA = { x: 45, z: -58, radius: 16, height: 5.5 } as const;

export const SchoolPlace = {
  classroom: 'school:classroom',
  teacher: 'school:teacher',
  park: 'school:park',
} as const;

/** A flat clearing in the west of the island where the Nature missions happen. */
export const NATURE_CAMP = { x: -70, z: -15, radius: 15, height: 4.2 } as const;

export const NaturePlace = {
  farm: 'nature:farm',
  garden: 'nature:garden',
  recycling: 'nature:recycling',
} as const;

/** A quiet garden in the island's south-west, for the Emotions missions. */
export const EMOTIONS_GARDEN = { x: -60, z: 45, radius: 14, height: 4.6 } as const;

export const EmotionsPlace = {
  faces: 'emotions:faces',
  stories: 'emotions:stories',
  calm: 'emotions:calm',
} as const;
