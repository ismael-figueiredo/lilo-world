import { idleInput, joystickInput, type MoveInput } from '@presentation/engine/movement';
import { h } from '@presentation/ui/dom';

export interface ControlsCallbacks {
  onMove(input: MoveInput): void;
  onGesture(): void;
  onAgenda(): void;
  onAction(): void;
}

/** What the gesture button does here. */
export type Gesture = 'greet' | 'jump';

const gestureLooks: Readonly<Record<Gesture, { icon: string; label: string }>> = {
  greet: { icon: '👋', label: 'Cumprimentar' },
  jump: { icon: '⤒', label: 'Pular' },
};

const JOYSTICK_RADIUS = 56;

/** On-screen joystick and buttons, always in the same places: the same jobs as a controller. */
export class Controls {
  readonly element: HTMLElement;
  private readonly knob = h('div', { className: 'joystick__knob' });
  private readonly action: HTMLButtonElement;
  private readonly actionIcon = h('span', { className: 'action__icon' });
  private readonly actionLabel = h('span', { className: 'action__label' });
  private readonly gestureIcon = h('span');
  private readonly gesture: HTMLButtonElement;
  private currentGesture: Gesture | undefined;
  private pointer: number | null = null;
  private center = { x: 0, y: 0 };

  constructor(private readonly callbacks: ControlsCallbacks) {
    const base = h('div', { className: 'joystick', attrs: { 'aria-label': 'Mover' } }, [this.knob]);
    base.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMoveEvent);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);

    this.gesture = h(
      'button',
      {
        className: 'round-button round-button--touch',
        attrs: { type: 'button' },
        onTap: () => {
          callbacks.onGesture();
        },
      },
      [this.gestureIcon],
    );
    this.setGesture('greet');
    const agenda = h(
      'button',
      {
        className: 'round-button round-button--touch',
        attrs: { type: 'button', 'aria-label': 'Plano de hoje' },
        onTap: () => {
          callbacks.onAgenda();
        },
      },
      [h('span', { text: '📅' })],
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
      h('div', { className: 'controls__right' }, [this.action, this.gesture, agenda]),
    ]);
  }

  setGesture(gesture: Gesture): void {
    if (gesture === this.currentGesture) return;
    this.currentGesture = gesture;
    const { icon, label } = gestureLooks[gesture];
    this.gestureIcon.textContent = icon;
    this.gesture.setAttribute('aria-label', label);
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
