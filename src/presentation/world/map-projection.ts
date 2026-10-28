/** Half the width of the island area shown on the map, in world units. */
export const MAP_EXTENT = 135;

/** World (x, z) to map coordinates in 0..1, north (−z) at the top. */
export const toMap = (x: number, z: number, extent = MAP_EXTENT): { u: number; v: number } => ({
  u: (x + extent) / (2 * extent),
  v: (z + extent) / (2 * extent),
});

/** CSS rotation (degrees) of an up-pointing arrow for a character facing `facing`. */
export const arrowRotation = (facing: number): number => 180 - (facing * 180) / Math.PI;
