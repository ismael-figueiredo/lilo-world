import { isCoin, spoken, total, written, type Cents } from '@domain/money/money';
import { h, replayAnimation } from '@presentation/ui/dom';

export interface BillLine {
  readonly icon: string;
  readonly name: string;
  readonly price: Cents;
}

const noteColors: Readonly<Record<number, string>> = {
  200: '#5b8fd6',
  500: '#9c7bc4',
  1000: '#d9695f',
  2000: '#e0a03c',
  5000: '#c98a4b',
};

/** One coin or note, as a button. */
function money(value: Cents, onPress: () => void): HTMLButtonElement {
  const coin = isCoin(value);
  const button = h('button', {
    className: `money${coin ? ' money--coin' : ''}`,
    text: written(value),
    attrs: { type: 'button', 'aria-label': spoken(value) },
    onTap: onPress,
  });
  button.style.setProperty('--money', noteColors[value] ?? '#e0b84a');
  return button;
}

/**
 * The cashier's counter: what is being bought, the money in hand and what was
 * put on the counter. Nothing can go wrong here: money comes back with a press.
 */
export class PayPanel {
  readonly element: HTMLElement;
  private readonly title = h('h2', { className: 'mission__title', text: '🧾 Caixa' });
  private readonly body = h('div', { className: 'pay' });

  constructor() {
    this.element = h(
      'section',
      { className: 'mission challenge', attrs: { 'aria-label': 'Caixa' } },
      [h('div', { className: 'mission__sheet' }, [this.title, this.body])],
    );
  }

  /** Waits for the child to put enough on the counter, and answers with what they put. */
  pay(lines: readonly BillLine[], wallet: readonly Cents[]): Promise<readonly Cents[]> {
    const bill = total(lines.map((line) => line.price));
    return new Promise((resolve) => {
      const hand = h('div', { className: 'pay__money' });
      const counter = h('div', { className: 'pay__money pay__counter' });
      const missing = h('p', { className: 'pay__left instruction__text' });
      const onCounter: { value: Cents; button: HTMLButtonElement }[] = [];
      const go = h('button', {
        className: 'big-button big-button--green',
        text: '✓ Pagar',
        attrs: { type: 'button' },
        onTap: () => {
          this.close();
          resolve(onCounter.map((piece) => piece.value));
        },
      });
      const refresh = () => {
        const paid = total(onCounter.map((piece) => piece.value));
        go.disabled = paid < bill;
        missing.textContent = paid < bill ? `Falta ${written(bill - paid)}` : 'Pronto, pode pagar!';
      };
      for (const value of wallet) {
        const button = money(value, () => {
          const placed = onCounter.findIndex((piece) => piece.button === button);
          if (placed >= 0) {
            onCounter.splice(placed, 1);
            hand.append(button);
          } else {
            onCounter.push({ value, button });
            counter.append(button);
          }
          replayAnimation(button, 'is-tapped');
          refresh();
        });
        hand.append(button);
      }
      refresh();
      this.body.replaceChildren(
        h(
          'ul',
          { className: 'pay__bill' },
          lines.map((line) =>
            h('li', { className: 'pay__line' }, [
              h('span', { text: `${line.icon} ${line.name}` }),
              h('span', { text: written(line.price) }),
            ]),
          ),
        ),
        h('p', { className: 'pay__total', text: `Total: ${written(bill)}` }),
        h('p', { className: 'pay__label', text: '👛 Na sua mão' }),
        hand,
        h('p', { className: 'pay__label', text: '🧾 No balcão' }),
        counter,
        missing,
        go,
      );
      this.element.classList.add('is-visible');
    });
  }

  /**
   * The cashier gives the change and the child checks it. At the simple level
   * the sum is shown in things: what was paid, with what the price takes away.
   */
  checkChange(
    paid: Cents,
    bill: Cents,
    options: readonly Cents[],
    simple: boolean,
    onWrong: () => void,
  ): Promise<void> {
    const change = paid - bill;
    return new Promise((resolve) => {
      const tiles = options.map((value) => {
        const tile = h('button', {
          className: 'tile challenge__tile',
          attrs: { type: 'button', 'aria-label': spoken(value) },
          onTap: () => {
            if (value === change) {
              this.close();
              resolve();
              return;
            }
            onWrong();
            for (const other of tiles) {
              other.classList.toggle('is-dimmed', other !== right);
            }
            right?.classList.add('is-hinted');
          },
        });
        tile.append(
          h('span', {
            className: 'pictogram pictogram--big challenge__face challenge__face--long',
            text: written(value),
          }),
        );
        return tile;
      });
      const right = tiles[options.indexOf(change)];
      const reais = Math.round(paid / 100);
      const dots = h(
        'div',
        { className: 'pay__sum', attrs: { 'aria-hidden': 'true' } },
        Array.from({ length: reais }, (_, index) =>
          h('span', { className: `pay__dot${index < Math.round(bill / 100) ? ' is-gone' : ''}` }),
        ),
      );
      this.body.replaceChildren(
        h('p', {
          className: 'pay__total',
          text: `Você deu ${written(paid)}. Custou ${written(bill)}.`,
        }),
        ...(simple ? [dots] : []),
        h('p', { className: 'instruction__text', text: 'Quanto voltou de troco?' }),
        h('div', { className: 'mission__shelf challenge__options' }, tiles),
      );
      this.element.classList.add('is-visible');
    });
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }
}
