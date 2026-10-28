import { h, replayAnimation } from '@presentation/ui/dom';

/** Coins and stars, always in the same corner so the child knows where to look. */
export class Hud {
  readonly element: HTMLElement;
  private readonly coins = h('span', { className: 'hud__value', text: '0' });
  private readonly stars = h('span', { className: 'hud__value', text: '0' });
  private readonly coinPill: HTMLElement;
  private readonly starPill: HTMLElement;

  constructor() {
    this.coinPill = h('div', { className: 'hud__pill', attrs: { 'aria-label': 'Moedas' } }, [
      h('span', { className: 'hud__icon', text: '🪙' }),
      this.coins,
    ]);
    this.starPill = h('div', { className: 'hud__pill', attrs: { 'aria-label': 'Estrelas' } }, [
      h('span', { className: 'hud__icon', text: '⭐' }),
      this.stars,
    ]);
    this.element = h('div', { className: 'hud' }, [this.coinPill, this.starPill]);
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
}
