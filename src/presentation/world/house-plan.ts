/** A place inside the house, relative to its middle, with the direction to face. */
export interface HouseSpot {
  readonly x: number;
  readonly z: number;
  readonly facing: number;
}

interface Point {
  readonly x: number;
  readonly z: number;
}

type Room = 'bedroom' | 'bathroom' | 'living' | 'kitchen';

const roomAt = ({ x, z }: Point): Room => {
  if (z < 0) return x < 0 ? 'bedroom' : 'bathroom';
  return x < 0 ? 'living' : 'kitchen';
};

/** The doorways between rooms. */
const doors: readonly { readonly rooms: readonly [Room, Room]; readonly at: Point }[] = [
  { rooms: ['bedroom', 'bathroom'], at: { x: 0, z: -2.6 } },
  { rooms: ['bedroom', 'living'], at: { x: -4.1, z: 0 } },
  { rooms: ['living', 'kitchen'], at: { x: 0, z: 2.8 } },
];

/** The doors to go through, in order, walking from one spot to another. */
export const doorsOnTheWay = (from: Point, to: Point): readonly Point[] =>
  doorsBetween(roomAt(from), roomAt(to));

function doorsBetween(from: Room, to: Room): readonly Point[] {
  const visited = new Set<Room>([from]);
  const paths: { room: Room; path: Point[] }[] = [{ room: from, path: [] }];
  for (const { room, path } of paths) {
    if (room === to) return path;
    for (const door of doors) {
      const other = door.rooms[0] === room ? door.rooms[1] : door.rooms[0];
      if (!door.rooms.includes(room) || visited.has(other)) continue;
      visited.add(other);
      paths.push({ room: other, path: [...path, door.at] });
    }
  }
  return [];
}

const DOT_GAP = 0.9;
/** The trail starts a little ahead of the child and stops short of the thing. */
const END_MARGIN = 0.7;

/** Points of a trail of light from one spot of the house to another, through the doors. */
export function routeInside(from: Point, to: Point): readonly Point[] {
  const corners = [from, ...doorsOnTheWay(from, to), to];
  const dots: Point[] = [];
  corners.slice(1).forEach((corner, index) => {
    const start = corners[index] ?? from;
    const length = Math.hypot(corner.x - start.x, corner.z - start.z);
    for (let walked = END_MARGIN; walked < length - END_MARGIN / 2; walked += DOT_GAP) {
      const part = walked / length;
      dots.push({
        x: start.x + (corner.x - start.x) * part,
        z: start.z + (corner.z - start.z) * part,
      });
    }
  });
  return dots;
}
