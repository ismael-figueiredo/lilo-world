import type { Wardrobe, WardrobeEntry } from '@application/use-cases/get-wardrobe';
import type { AvatarDefinition } from '@domain/avatar/avatar';
import { CHILD_AVATAR_ID, outfits, type OutfitId } from '@domain/avatar/child';
import type { WardrobeLook, WardrobeSlot } from '@domain/avatar/wardrobe-item';
import { h, toCssColor } from '@presentation/ui/dom';

export interface WardrobePanelCallbacks {
  onSelect(entry: WardrobeEntry): void;
  onSelectAvatar(avatar: AvatarDefinition): void;
  onSelectOutfit(outfit: OutfitId): void;
  onEditChild(): void;
  onClose(): void;
}

export interface WardrobeView {
  readonly wardrobe: Wardrobe;
  readonly avatars: readonly AvatarDefinition[];
  readonly avatarId: string;
  readonly outfit: OutfitId;
  readonly pictureOf: (avatarId: string) => string;
  readonly outfitPicture: (outfit: OutfitId) => string;
  /** Good for today's weather: a small mark, never a rule. */
  readonly fitsToday: (outfit: OutfitId) => boolean;
}

type Tab = WardrobeSlot | 'avatar' | 'outfit';

const tabs: readonly {
  tab: Tab;
  icon: string;
  label: string;
  needsColors?: boolean;
  onlyChild?: boolean;
}[] = [
  { tab: 'outfit', icon: '👕', label: 'Roupas', onlyChild: true },
  { tab: 'avatar', icon: '🙂', label: 'Personagem' },
  { tab: 'body', icon: '🎨', label: 'Cor', needsColors: true },
  { tab: 'hat', icon: '🧢', label: 'Chapéus' },
  { tab: 'accessory', icon: '🎒', label: 'Acessórios' },
  { tab: 'trim', icon: '✨', label: 'Detalhes', needsColors: true },
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

/** Side sheet with big cards. The character in the 3D view changes live. */
export class WardrobePanel {
  readonly element: HTMLElement;
  private readonly tabBar = h('div', { className: 'wardrobe__tabs', attrs: { role: 'tablist' } });
  private readonly grid = h('div', { className: 'wardrobe__grid' });
  private readonly coins = h('span', { className: 'wardrobe__coins' });
  private tab: Tab = 'outfit';
  private view: WardrobeView | undefined;

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

  open(view: WardrobeView): void {
    this.show(view);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }

  show(view: WardrobeView): void {
    this.view = view;
    const recolorable = view.avatars.find((a) => a.id === view.avatarId)?.recolorable ?? false;
    const isChild = view.avatarId === CHILD_AVATAR_ID;
    const visibleTabs = tabs.filter(
      (t) => (recolorable || t.needsColors !== true) && (isChild || t.onlyChild !== true),
    );
    if (!visibleTabs.some((t) => t.tab === this.tab)) this.tab = 'avatar';

    this.coins.textContent = `🪙 ${view.wardrobe.coins}`;
    // Up to four fit on one line; more would cut their names.
    const columns = visibleTabs.length > 4 ? 3 : visibleTabs.length;
    this.tabBar.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    this.tabBar.replaceChildren(
      ...visibleTabs.map((t) =>
        h(
          'button',
          {
            className: `wardrobe__tab${t.tab === this.tab ? ' is-active' : ''}`,
            attrs: { type: 'button', role: 'tab', 'aria-selected': String(t.tab === this.tab) },
            onTap: () => {
              this.tab = t.tab;
              if (this.view !== undefined) this.show(this.view);
            },
          },
          [
            h('span', { className: 'wardrobe__tab-icon', text: t.icon }),
            h('span', { text: t.label }),
          ],
        ),
      ),
    );

    this.grid.replaceChildren(...this.cards(view));
  }

  private cards(view: WardrobeView): HTMLElement[] {
    if (this.tab === 'outfit') return outfits.map((outfit) => this.outfitCard(outfit, view));
    if (this.tab === 'avatar') {
      const change = h(
        'button',
        {
          className: 'item-card',
          attrs: { type: 'button', 'aria-label': 'Mudar como eu sou' },
          onTap: () => {
            this.callbacks.onEditChild();
          },
        },
        [
          h('span', { className: 'pictogram pictogram--big', text: '✏️' }),
          h('span', { className: 'item-card__name', text: 'Mudar como eu sou' }),
        ],
      );
      return [...view.avatars.map((avatar) => this.avatarCard(avatar, view)), change];
    }
    return view.wardrobe.entries
      .filter((entry) => entry.item.slot === this.tab)
      .map((entry) => this.card(entry));
  }

  private outfitCard(
    outfit: { readonly id: OutfitId; readonly name: string },
    view: WardrobeView,
  ): HTMLElement {
    const selected = outfit.id === view.outfit;
    return h(
      'button',
      {
        className: `item-card${selected ? ' is-equipped' : ''}`,
        attrs: { type: 'button', 'aria-label': outfit.name, 'aria-pressed': String(selected) },
        onTap: () => {
          this.callbacks.onSelectOutfit(outfit.id);
        },
      },
      [
        h('img', {
          className: 'avatar-picture',
          attrs: { src: view.outfitPicture(outfit.id), alt: '', draggable: 'false' },
        }),
        h('span', { className: 'item-card__name', text: outfit.name }),
        selected ? h('span', { className: 'item-card__status', text: '✅ Usando' }) : null,
        !selected && view.fitsToday(outfit.id)
          ? h('span', { className: 'item-card__status', text: '🌤️ Bom para hoje' })
          : null,
      ],
    );
  }

  private avatarCard(avatar: AvatarDefinition, view: WardrobeView): HTMLElement {
    const selected = avatar.id === view.avatarId;
    return h(
      'button',
      {
        className: `item-card${selected ? ' is-equipped' : ''}`,
        attrs: { type: 'button', 'aria-label': avatar.name, 'aria-pressed': String(selected) },
        onTap: () => {
          this.callbacks.onSelectAvatar(avatar);
        },
      },
      [
        h('img', {
          className: 'avatar-picture',
          attrs: { src: view.pictureOf(avatar.id), alt: '', draggable: 'false' },
        }),
        h('span', { className: 'item-card__name', text: avatar.name }),
        selected ? h('span', { className: 'item-card__status', text: '✅ Você' }) : null,
      ],
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
