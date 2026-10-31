import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from '@presentation/engine/input';

type Listener = (event: { pointerId: number; clientX: number; clientY: number }) => void;

describe('looking around', () => {
  const listeners = new Map<string, Listener>();
  const listen = (type: string, listener: Listener) => {
    listeners.set(type, listener);
  };
  const surface = { addEventListener: listen, removeEventListener: () => undefined };
  let input: Input;

  const drag = (distance: number) => {
    listeners.get('pointerdown')?.({ pointerId: 1, clientX: 0, clientY: 0 });
    listeners.get('pointermove')?.({ pointerId: 1, clientX: distance, clientY: 0 });
    listeners.get('pointerup')?.({ pointerId: 1, clientX: distance, clientY: 0 });
  };

  beforeEach(() => {
    vi.stubGlobal('window', { addEventListener: listen, removeEventListener: () => undefined });
    input = new Input(surface as unknown as HTMLElement);
  });

  it('rests with the controls during a scene', () => {
    input.enabled = false;
    drag(50);
    expect(input.consumeLook()).toEqual({ x: 0, y: 0 });
  });

  it('stays free while waiting, and the child still cannot walk', () => {
    input.enabled = false;
    input.lookOnly = true;
    drag(50);
    expect(input.consumeLook()).toEqual({ x: 50, y: 0 });
    expect(input.move).toEqual({ x: 0, y: 0, running: false });
  });
});
