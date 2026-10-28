import { h } from '@presentation/ui/dom';

export type MenuChoice = 'continue' | 'map' | 'progress' | 'settings' | 'switch-player';

const choices: readonly { id: MenuChoice; icon: string; label: string; tone: string }[] = [
  { id: 'continue', icon: '▶️', label: 'Continuar', tone: 'green' },
  { id: 'map', icon: '🗺️', label: 'Mapa', tone: 'sky' },
  { id: 'progress', icon: '⭐', label: 'Meu progresso', tone: 'sun' },
  { id: 'settings', icon: '⚙️', label: 'Ajustes', tone: 'grape' },
  { id: 'switch-player', icon: '👤', label: 'Trocar jogador', tone: 'coral' },
];

/** Pause menu: few, big, always-the-same choices. */
export class MenuPanel {
  readonly element: HTMLElement;
  private readonly title = h('h2', { className: 'sheet__title' });

  constructor(onChoose: (choice: MenuChoice) => void) {
    this.element = h('section', { className: 'overlay', attrs: { 'aria-label': 'Menu' } }, [
      h('div', { className: 'sheet sheet--menu' }, [
        this.title,
        h(
          'div',
          { className: 'menu__grid' },
          choices.map((choice) =>
            h(
              'button',
              {
                className: `menu__tile menu__tile--${choice.tone}`,
                attrs: { type: 'button' },
                onTap: () => {
                  onChoose(choice.id);
                },
              },
              [
                h('span', { className: 'menu__icon', text: choice.icon }),
                h('span', { text: choice.label }),
              ],
            ),
          ),
        ),
      ]),
    ]);
  }

  open(playerName: string): void {
    this.title.textContent = `Olá, ${playerName}!`;
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }
}
