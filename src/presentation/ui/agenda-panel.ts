import {
  currentBlock,
  currentStep,
  dayBlocks,
  nextStep,
  type DayState,
} from '@domain/day/day-plan';
import type { Weather } from '@domain/day/weather';
import type { Errand } from '@domain/errand/errand';
import { groceryOf } from '@domain/errand/groceries';
import { total, written } from '@domain/money/money';
import { stepLooks } from '@presentation/ui/day-looks';
import { h } from '@presentation/ui/dom';

const weatherIcons: Readonly<Record<Weather, string>> = {
  sunny: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  wind: '🍃',
  cold: '🧣',
};

const blockIcons = { morning: '🌅', afternoon: '☀️', night: '🌙' } as const;

/** The day in pictures: what is now, what comes next and what is done. */
export class AgendaPanel {
  readonly element: HTMLElement;
  private readonly sheet = h('div', { className: 'sheet agenda' });

  constructor(private readonly onClose: () => void) {
    this.element = h(
      'section',
      { className: 'overlay', attrs: { 'aria-label': 'Agenda do dia' } },
      [this.sheet],
    );
  }

  open(day: DayState, weather: Weather): void {
    const now = currentStep(day);
    const next = nextStep(day);
    const big = (title: string, step: typeof now, className: string) =>
      step === undefined
        ? null
        : h('div', { className: `agenda__card ${className}` }, [
            h('span', { className: 'agenda__when', text: title }),
            h('span', { className: 'agenda__icon', text: stepLooks[step].icon }),
            h('span', { className: 'agenda__name', text: stepLooks[step].name }),
          ]);
    const block = currentBlock(day);
    this.sheet.replaceChildren(
      h('h2', { className: 'sheet__title', text: `📅 Dia ${day.number} ${weatherIcons[weather]}` }),
      h('div', { className: 'agenda__now' }, [
        big('Agora', now, 'is-now'),
        h('span', { className: 'agenda__arrow', text: '→', attrs: { 'aria-hidden': 'true' } }),
        big('Depois', next, 'is-next'),
      ]),
      h(
        'div',
        { className: 'agenda__blocks' },
        dayBlocks.map((part) =>
          h('div', { className: `agenda__block${part.id === block?.id ? ' is-current' : ''}` }, [
            h('span', { className: 'agenda__block-icon', text: blockIcons[part.id] }),
            ...part.steps.map((step) =>
              h('span', {
                className: `agenda__step${day.done.includes(step) ? ' is-done' : ''}`,
                text: stepLooks[step].icon,
                attrs: { title: stepLooks[step].name },
              }),
            ),
          ]),
        ),
      ),
      ...(day.errand === undefined ? [] : [this.shopping(day.errand)]),
      h('button', {
        className: 'big-button big-button--green',
        text: '✓ Entendi',
        attrs: { type: 'button' },
        onTap: () => {
          this.onClose();
        },
      }),
    );
    this.element.classList.add('is-visible');
  }

  /** The list and the wallet: always one press away. */
  private shopping(errand: Errand): HTMLElement {
    const items = errand.list.map((id) => {
      const { icon, short } = groceryOf(id);
      const got = errand.picked.includes(id);
      return h('li', { className: `agenda__item${got ? ' is-done' : ''}` }, [
        h('span', { text: got ? '✅' : '⬜' }),
        h('span', { text: `${icon} ${short}` }),
      ]);
    });
    return h('div', { className: 'agenda__list' }, [
      h('ul', { className: 'agenda__items' }, items),
      h('p', { className: 'agenda__wallet', text: `👛 ${written(total(errand.wallet))}` }),
    ]);
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }
}
