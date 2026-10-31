import { h } from '@presentation/ui/dom';

/** A quiet place the child can ask for at any moment, and leave when ready. No timer. */
export class CalmPause {
  readonly element: HTMLElement;

  constructor(onBack: () => void) {
    this.element = h(
      'section',
      { className: 'overlay overlay--calm', attrs: { 'aria-label': 'Pausa' } },
      [
        h('div', { className: 'sheet day' }, [
          h('h2', { className: 'sheet__title', text: '🧸 Pausa' }),
          h('div', { className: 'day__breath', attrs: { 'aria-hidden': 'true' } }),
          h('p', { className: 'day__hint', text: 'Puxe o ar devagar. Solte devagar.' }),
          h('button', {
            className: 'big-button big-button--light',
            text: '➡️ Voltar',
            attrs: { type: 'button' },
            onTap: onBack,
          }),
        ]),
      ],
    );
  }

  show(): void {
    this.element.classList.add('is-visible');
  }

  hide(): void {
    this.element.classList.remove('is-visible');
  }
}
