import { describe, expect, it } from 'vitest';
import {
  PadButton,
  padGlyphs,
  padIsActive,
  padStyleOf,
  readPad,
  stickToLook,
  stickToMove,
  type PadState,
} from '@presentation/engine/gamepad';
import { gameKey } from '@presentation/engine/input';
import { idleInput } from '@presentation/engine/movement';
import { pickInDirection, pickNearest } from '@presentation/ui/pad-focus';

const pad = (axes: number[] = [], pressedButtons: number[] = []): PadState => {
  const pressed: boolean[] = Array.from({ length: 17 }, () => false);
  for (const button of pressedButtons) pressed[button] = true;
  return { axes, pressed };
};

describe('gamepad mapping', () => {
  it('ignores a resting, slightly loose stick', () => {
    expect(stickToMove(0.1, -0.12)).toBe(idleInput);
    expect(stickToLook(0.15, -0.1)).toEqual({ x: 0, y: 0 });
  });

  it('walks forward when the left stick goes up and runs at the edge', () => {
    const half = stickToMove(0, -0.6);
    expect(half.y).toBeGreaterThan(0);
    expect(half.x).toBeCloseTo(0);
    expect(half.running).toBe(false);
    expect(stickToMove(0, -1).running).toBe(true);
    expect(stickToMove(0, -1).y).toBeCloseTo(1);
  });

  it('walks with the D-pad and runs while RB is held', () => {
    const frame = readPad(pad(), pad([0, 0], [PadButton.up, PadButton.right, PadButton.rb]));
    expect(frame.move.x).toBeCloseTo(Math.SQRT1_2);
    expect(frame.move.y).toBeCloseTo(Math.SQRT1_2);
    expect(frame.move.running).toBe(true);
  });

  it('counts buttons only on the frame they are pressed', () => {
    expect(readPad(pad(), pad([], [PadButton.a])).select).toBe(true);
    expect(readPad(pad([], [PadButton.a]), pad([], [PadButton.a])).select).toBe(false);
  });

  it('knows when the choosing button stays down, for buttons that must be held', () => {
    const held = readPad(pad([], [PadButton.a]), pad([], [PadButton.a]));
    expect(held.selectHeld).toBe(true);
    expect(readPad(pad([], [PadButton.a]), pad()).selectHeld).toBe(false);
  });

  it('uses the buttons of any console, each with one job', () => {
    const press = (button: number) => readPad(pad(), pad([], [button]));
    const cross = press(PadButton.a);
    expect(cross.select && !cross.gesture).toBe(true);
    const square = press(PadButton.x);
    expect(square.gesture && !square.select).toBe(true);
    expect(press(PadButton.b).back).toBe(true);
    const triangle = press(PadButton.y);
    expect(triangle.agenda && !triangle.menu).toBe(true);
    const options = press(PadButton.start);
    expect(options.menu && !options.agenda).toBe(true);
    expect(press(PadButton.lb).pause).toBe(true);
  });

  it('shows PlayStation symbols in their own colors', () => {
    const { select, gesture, back, agenda, menu, pause } = padGlyphs.playstation;
    const glyphs = [select, gesture, back, agenda, menu, pause];
    expect(glyphs.map((g) => g.symbol)).toEqual(['✕', '▢', '◯', '△', '☰', 'L1']);
    expect(new Set(glyphs.map((g) => g.color)).size).toBe(6);
  });

  it('knows when the child is using the controller', () => {
    expect(padIsActive(readPad(pad(), pad([0, 0])))).toBe(false);
    expect(padIsActive(readPad(pad(), pad([0, -1])))).toBe(true);
    expect(padIsActive(readPad(pad(), pad([], [PadButton.b])))).toBe(true);
  });

  it('shows the symbols of the controller, PlayStation when unknown', () => {
    expect(padStyleOf('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(padStyleOf('Wireless Controller (Vendor: 054c)')).toBe('playstation');
    expect(padStyleOf('USB Gamepad')).toBe('playstation');
  });

  it('navigates panels once per push of the D-pad or stick', () => {
    expect(readPad(pad(), pad([], [PadButton.down])).navigate).toBe('down');
    expect(readPad(pad([0.9, 0]), pad([0.9, 0])).navigate).toBeUndefined();
    expect(readPad(pad([0, 0]), pad([-0.9, 0])).navigate).toBe('left');
  });

  it('turns the camera with the right stick', () => {
    const frame = readPad(pad(), pad([0, 0, 1, 0]));
    expect(frame.look.x).toBeCloseTo(1);
    expect(frame.look.y).toBe(0);
  });
});

describe('panel focus with the D-pad', () => {
  const box = (x: number, y: number) => ({ x, y, width: 100, height: 100 });
  const grid = [box(200, 0), box(0, 200), box(200, 200), box(400, 200)];

  it('goes to the closest button in line', () => {
    expect(pickInDirection(box(0, 0), grid, 'right')).toBe(0);
    expect(pickInDirection(box(0, 0), grid, 'down')).toBe(1);
    expect(pickInDirection(box(200, 200), grid, 'right')).toBe(3);
  });

  it('goes to the nearest button when the focused one disappears', () => {
    expect(pickNearest(box(210, 190), grid)).toBe(2);
    expect(pickNearest(box(0, 0), [])).toBeUndefined();
  });

  it('stays put when nothing is in that direction', () => {
    expect(pickInDirection(box(0, 0), grid, 'up')).toBeUndefined();
    expect(pickInDirection(box(0, 0), grid, 'left')).toBeUndefined();
  });
});

describe('keyboard', () => {
  it('has the same jobs as the controller', () => {
    expect(gameKey('Tab')).toBe('agenda');
    expect(gameKey('KeyP')).toBe('menu');
    expect(gameKey('KeyC')).toBe('pause');
    expect(gameKey('KeyW')).toBeUndefined();
  });
});
