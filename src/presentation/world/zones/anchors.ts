/*
 * Where each zone stands and the ids of its places. They live apart from the
 * zones so the terrain, the map and the missions can know them without
 * downloading the zones themselves.
 */

/** A quiet garden in the island's south-west, for the Emotions missions. */
export const EMOTIONS_GARDEN = { x: -60, z: 45, radius: 14, height: 4.6 } as const;

export const EmotionsPlace = {
  faces: 'emotions:faces',
  stories: 'emotions:stories',
  calm: 'emotions:calm',
} as const;
