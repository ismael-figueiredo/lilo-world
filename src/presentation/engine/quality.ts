/** How much the game draws. Lower levels keep it moving on simpler tablets. */
export type Quality = 'high' | 'medium' | 'low';

const levels: readonly Quality[] = ['low', 'medium', 'high'];

/** Below this the game feels slow; above the other one there is room to spare. */
const SLOW_FPS = 28;
const SMOOTH_FPS = 52;
/** Seconds of evidence before changing. */
const SLOW_SECONDS = 3;
const SMOOTH_SECONDS = 20;
/** A longer frame is the tab waking up or a loading hitch, not how the game runs. */
const IGNORED_FRAME_SECONDS = 0.25;

/**
 * Chooses the quality from how the game is running. It goes down fast and up
 * slowly, and it stops trying to go up after a level proved too heavy, so the
 * picture does not keep changing in front of the child.
 */
export class QualityGovernor {
  private time = 0;
  private frames = 0;
  private tooHeavy: Quality | undefined;

  constructor(private current: Quality = 'high') {}

  get quality(): Quality {
    return this.current;
  }

  /** Call every frame. Returns the new quality when it changes. */
  sample(dt: number): Quality | undefined {
    if (dt <= 0 || dt > IGNORED_FRAME_SECONDS) return undefined;
    this.time += dt;
    this.frames += 1;
    const fps = this.frames / this.time;
    if (this.time >= SLOW_SECONDS && fps < SLOW_FPS) return this.step(-1);
    if (this.time < SMOOTH_SECONDS) return undefined;
    if (fps > SMOOTH_FPS) return this.step(1);
    this.restart();
    return undefined;
  }

  private restart(): void {
    this.time = 0;
    this.frames = 0;
  }

  private step(direction: 1 | -1): Quality | undefined {
    this.restart();
    const index = levels.indexOf(this.current);
    const next = levels[index + direction];
    if (next === undefined || next === this.tooHeavy) return undefined;
    if (direction === -1) this.tooHeavy = this.current;
    this.current = next;
    return next;
  }
}
