import { idleInput, joystickInput, type MoveInput } from '@presentation/engine/movement';
import { h } from '@presentation/ui/dom';

export interface ControlsCallbacks {
  onMove(input: MoveInput): void;
  onJump(): void;
  onAction(): void;
}

const JOYSTICK_RADIUS = 56;

/** On-screen joystick (always in the same place), jump button and context action button. */
export class Controls {
  readonly element: HTMLElement;
  private readonly knob = h('div', { className: 'joystick__knob' });
  private readonly action: HTMLButtonElement;
  private readonly actionIcon = h('span', { className: 'action__icon' });
  private readonly actionLabel = h('span', { className: 'action__label' });
  private pointer: number | null = null;
  private center = { x: 0, y: 0 };

  constructor(private readonly callbacks: ControlsCallbacks) {
    const base = h('div', { className: 'joystick', attrs: { 'aria-label': 'Mover' } }, [this.knob]);
    base.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMoveEvent);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);

    const jump = h(
      'button',
      {
        className: 'round-button round-button--jump',
        attrs: { 'aria-label': 'Pular', type: 'button' },
        onTap: () => {
          callbacks.onJump();
        },
      },
      [h('span', { text: '⤒' })],
    );

    this.action = h(
      'button',
      {
        className: 'action',
        attrs: { type: 'button' },
        onTap: () => {
          callbacks.onAction();
        },
      },
      [h('span', { className: 'action__pad pad-glyph' }), this.actionIcon, this.actionLabel],
    );

    this.element = h('div', { className: 'controls' }, [
      base,
      h('div', { className: 'controls__right' }, [this.action, jump]),
    ]);
  }

  showAction(icon: string, label: string): void {
    if (this.actionLabel.textContent !== label) {
      this.actionIcon.textContent = icon;
      this.actionLabel.textContent = label;
      this.action.setAttribute('aria-label', label);
    }
    this.action.classList.add('is-visible');
  }

  hideAction(): void {
    this.action.classList.remove('is-visible');
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('is-hidden', !visible);
    if (!visible) this.release();
  }

  private readonly onDown = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.pointer = event.pointerId;
    this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.update(event);
  };

  private readonly onMoveEvent = (event: PointerEvent): void => {
    if (event.pointerId === this.pointer) this.update(event);
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (event.pointerId === this.pointer) this.release();
  };

  private update(event: PointerEvent): void {
    let dx = event.clientX - this.center.x;
    let dy = event.clientY - this.center.y;
    const distance = Math.hypot(dx, dy);
    if (distance > JOYSTICK_RADIUS) {
      dx = (dx / distance) * JOYSTICK_RADIUS;
      dy = (dy / distance) * JOYSTICK_RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.callbacks.onMove(joystickInput(dx, dy, JOYSTICK_RADIUS));
  }

  private release(): void {
    this.pointer = null;
    this.knob.style.transform = '';
    this.callbacks.onMove(idleInput);
  }
}
