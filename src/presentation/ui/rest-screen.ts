import { h } from '@presentation/ui/dom';
import { holdButton } from '@presentation/ui/hold-button';

export interface RestScreenCallbacks {
  onFinish(): void;
  /** Adults can give a little more time. */
  onExtend(): void;
}

/** Calm, predictable end of a session when the time limit is reached. */
export class RestScreen {
  readonly element: HTMLElement;
  private readonly message = h('p', { className: 'rest__message' });

  constructor(callbacks: RestScreenCallbacks) {
    this.element = h(
      'section',
      { className: 'overlay overlay--calm', attrs: { 'aria-label': 'Hora de descansar' } },
      [
        h('div', { className: 'sheet sheet--rest' }, [
          h('p', { className: 'rest__icon', text: '🌙' }),
          h('h2', { className: 'sheet__title', text: 'Hora de descansar' }),
          this.message,
          h('div', { className: 'celebration__actions' }, [
            h('button', {
              className: 'big-button big-button--green',
              text: '👋 Até logo',
              attrs: { type: 'button' },
              onTap: () => {
                callbacks.onFinish();
              },
            }),
            holdButton(
              '👪 +5 minutos',
              () => {
                callbacks.onExtend();
              },
              { className: 'hold--subtle' },
            ),
          ]),
        ]),
      ],
    );
  }

  open(playerName: string): void {
    this.message.textContent = `Você brincou muito bem hoje, ${playerName}! O seu progresso está guardado.`;
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }
}
