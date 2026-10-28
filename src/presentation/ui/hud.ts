import { h, replayAnimation } from '@presentation/ui/dom';

/** Coins, stars, time left and the menu, always in the same corner. */
export class Hud {
  readonly element: HTMLElement;
  private readonly coins = h('span', { className: 'hud__value', text: '0' });
  private readonly stars = h('span', { className: 'hud__value', text: '0' });
  private readonly coinPill: HTMLElement;
  private readonly starPill: HTMLElement;
  private readonly timer = h('div', { className: 'hud__pill hud__timer is-hidden' });

  constructor(onMenu: () => void) {
    this.coinPill = h('div', { className: 'hud__pill', attrs: { 'aria-label': 'Moedas' } }, [
      h('span', { className: 'hud__icon', text: '🪙' }),
      this.coins,
    ]);
    this.starPill = h('div', { className: 'hud__pill', attrs: { 'aria-label': 'Estrelas' } }, [
      h('span', { className: 'hud__icon', text: '⭐' }),
      this.stars,
    ]);
    const menu = h(
      'button',
      {
        className: 'hud__menu',
        attrs: { type: 'button', 'aria-label': 'Menu' },
        onTap: onMenu,
      },
      [
        h('span', { className: 'hud__burger' }),
        h('span', { className: 'hud__burger' }),
        h('span', { className: 'hud__burger' }),
      ],
    );
    this.element = h('div', { className: 'hud' }, [this.timer, this.coinPill, this.starPill, menu]);
  }

  set(coins: number, stars: number): void {
    if (this.coins.textContent !== String(coins)) {
      this.coins.textContent = String(coins);
      replayAnimation(this.coinPill, 'is-bumping');
    }
    if (this.stars.textContent !== String(stars)) {
      this.stars.textContent = String(stars);
      replayAnimation(this.starPill, 'is-bumping');
    }
  }

  /** Shows the minutes left (undefined hides the clock). */
  setTimeLeft(minutes: number | undefined, warning: boolean): void {
    this.timer.classList.toggle('is-hidden', minutes === undefined);
    this.timer.classList.toggle('is-warning', warning);
    if (minutes !== undefined) this.timer.textContent = `⏱️ ${minutes} min`;
  }
}
