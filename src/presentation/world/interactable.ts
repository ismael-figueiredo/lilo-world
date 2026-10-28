import type * as THREE from 'three';

/** A place in the world the child can use when close enough (a door, a portal...). */
export interface Interactable {
  readonly id: string;
  /** Where the player stands to use it. */
  readonly position: THREE.Vector3;
  /** Where the goal arrow floats. */
  readonly markerPosition: THREE.Vector3;
  readonly radius: number;
  readonly icon: string;
  readonly label: string;
}
