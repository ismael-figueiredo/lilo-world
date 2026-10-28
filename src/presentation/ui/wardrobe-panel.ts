import type { Wardrobe, WardrobeEntry } from '@application/use-cases/get-wardrobe';
import type { WardrobeLook, WardrobeSlot } from '@domain/avatar/wardrobe-item';
import { h, toCssColor } from '@presentation/ui/dom';

export interface WardrobePanelCallbacks {
  onSelect(entry: WardrobeEntry): void;
  onClose(): void;
}

const tabs: readonly { slot: WardrobeSlot; icon: string; label: string }[] = [
  { slot: 'body', icon: '🎨', label: 'Cor' },
  { slot: 'hat', icon: '🧢', label: 'Chapéus' },
  { slot: 'accessory', icon: '🎒', label: 'Acessórios' },
  { slot: 'trim', icon: '✨', label: 'Detalhes' },
];

const lookIcons: Record<WardrobeLook, string> = {
  color: '',
  cap: '🧢',
  'party-hat': '🥳',
  beanie: '🧶',
  crown: '👑',
  glasses: '👓',
  backpack: '🎒',
  headphones: '🎧',
};

/** Side sheet with big item cards. The character in the 3D view changes live. */
export class WardrobePanel {
  readonly element: HTMLElement;
  private readonly tabBar = h('div', { className: 'wardrobe__tabs', attrs: { role: 'tablist' } });
  private readonly grid = h('div', { className: 'wardrobe__grid' });
  private readonly coins = h('span', { className: 'wardrobe__coins' });
  private slot: WardrobeSlot = 'body';
  private wardrobe: Wardrobe | undefined;

  constructor(private readonly callbacks: WardrobePanelCallbacks) {
    this.element = h(
      'section',
      { className: 'wardrobe', attrs: { 'aria-label': 'Guarda-roupa' } },
      [
        h('div', { className: 'wardrobe__header' }, [
          h('h2', { className: 'wardrobe__title', text: '👕 Guarda-roupa' }),
          this.coins,
          h('button', {
            className: 'panel__close',
            text: '✕',
            attrs: { type: 'button', 'aria-label': 'Fechar guarda-roupa' },
            onTap: () => {
              callbacks.onClose();
            },
          }),
        ]),
        this.tabBar,
        this.grid,
      ],
    );
  }

  open(wardrobe: Wardrobe): void {
    this.show(wardrobe);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }

  show(wardrobe: Wardrobe): void {
    this.wardrobe = wardrobe;
    this.coins.textContent = `🪙 ${wardrobe.coins}`;
    this.tabBar.replaceChildren(
      ...tabs.map((tab) =>
        h(
          'button',
          {
            className: `wardrobe__tab${tab.slot === this.slot ? ' is-active' : ''}`,
            attrs: { type: 'button', role: 'tab', 'aria-selected': String(tab.slot === this.slot) },
            onTap: () => {
              this.slot = tab.slot;
              if (this.wardrobe !== undefined) this.show(this.wardrobe);
            },
          },
          [
            h('span', { className: 'wardrobe__tab-icon', text: tab.icon }),
            h('span', { text: tab.label }),
          ],
        ),
      ),
    );
    this.grid.replaceChildren(
      ...wardrobe.entries
        .filter((entry) => entry.item.slot === this.slot)
        .map((entry) => this.card(entry)),
    );
  }

  private card(entry: WardrobeEntry): HTMLElement {
    const { item } = entry;
    const status = entry.equipped
      ? '✅ Usando'
      : entry.owned
        ? 'Vestir'
        : item.price === 0
          ? 'Grátis'
          : `🪙 ${item.price}`;
    const preview =
      item.look === 'color'
        ? h('span', {
            className: 'swatch',
            attrs: { style: `background:${toCssColor(item.color)}` },
          })
        : h('span', { className: 'pictogram pictogram--big', text: lookIcons[item.look] });

    const classes = ['item-card'];
    if (entry.equipped) classes.push('is-equipped');
    if (!entry.owned && !entry.affordable) classes.push('is-locked');

    return h(
      'button',
      {
        className: classes.join(' '),
        attrs: { type: 'button', 'aria-label': `${item.name}: ${status}` },
        onTap: () => {
          this.callbacks.onSelect(entry);
        },
      },
      [
        preview,
        h('span', { className: 'item-card__name', text: item.name }),
        h('span', { className: 'item-card__status', text: status }),
      ],
    );
  }
}
