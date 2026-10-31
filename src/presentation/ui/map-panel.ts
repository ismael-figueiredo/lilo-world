import { h } from '@presentation/ui/dom';
import type { Interactable } from '@presentation/world/interactable';
import { arrowRotation, toMap } from '@presentation/world/map-projection';

export interface MapPanelCallbacks {
  onSelect(place: Interactable): void;
  onClose(): void;
}

const groupNames: Readonly<Record<string, { icon: string; name: string }>> = {};

/** One pin per place, except grouped places (the portals) which share one pin in the middle. */
function mapPins(
  places: readonly Interactable[],
): { place: Interactable; icon: string; name: string }[] {
  const pins: { place: Interactable; icon: string; name: string }[] = [];
  const groups = new Map<string, Interactable[]>();
  for (const place of places) {
    if (place.mapGroup === undefined) pins.push({ place, icon: place.icon, name: place.name });
    else groups.set(place.mapGroup, [...(groups.get(place.mapGroup) ?? []), place]);
  }
  for (const [group, members] of groups) {
    const middle = members[Math.floor(members.length / 2)];
    const label = groupNames[group] ?? { icon: '📍', name: group };
    if (middle !== undefined) pins.push({ place: middle, ...label });
  }
  return pins;
}

/** Island map: tap a place and the golden arrow shows the way there. */
export class MapPanel {
  readonly element: HTMLElement;
  private readonly board = h('div', { className: 'map__board' });
  private readonly picture = h('img', {
    className: 'map__picture',
    attrs: { alt: 'Mapa da ilha' },
  });
  private readonly you = h('div', {
    className: 'map__you',
    attrs: { 'aria-label': 'Você está aqui' },
  });

  constructor(private readonly callbacks: MapPanelCallbacks) {
    this.element = h('section', { className: 'overlay', attrs: { 'aria-label': 'Mapa' } }, [
      h('div', { className: 'sheet sheet--map' }, [
        h('div', { className: 'sheet__header' }, [
          h('h2', { className: 'sheet__title', text: '🗺️ Mapa' }),
          h('p', { className: 'map__hint', text: 'Toque num lugar para ir até lá.' }),
          h('button', {
            className: 'panel__close',
            text: '✕',
            attrs: { type: 'button', 'aria-label': 'Fechar mapa' },
            onTap: () => {
              callbacks.onClose();
            },
          }),
        ]),
        this.board,
      ]),
    ]);
  }

  setPicture(canvas: HTMLCanvasElement): void {
    this.picture.src = canvas.toDataURL('image/jpeg', 0.85);
  }

  open(
    places: readonly Interactable[],
    player: { x: number; z: number; facing: number },
    goalId?: string,
  ): void {
    const pins = mapPins(places).map(({ place, icon, name }) => {
      const { u, v } = toMap(place.position.x, place.position.z);
      return h(
        'button',
        {
          className: `map__pin${place.id === goalId ? ' is-goal' : ''}${place.position.z < 0 ? ' map__pin--above' : ' map__pin--below'}`,
          attrs: {
            type: 'button',
            style: `left:${u * 100}%; top:${v * 100}%`,
            'aria-label': name,
          },
          onTap: () => {
            this.callbacks.onSelect(place);
          },
        },
        [
          h('span', { className: 'map__pin-icon', text: icon }),
          h('span', { className: 'map__pin-label', text: name }),
        ],
      );
    });
    const { u, v } = toMap(player.x, player.z);
    this.you.style.left = `${u * 100}%`;
    this.you.style.top = `${v * 100}%`;
    this.you.style.transform = `translate(-50%, -50%) rotate(${arrowRotation(player.facing)}deg)`;
    this.board.replaceChildren(this.picture, ...pins, this.you);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }
}
