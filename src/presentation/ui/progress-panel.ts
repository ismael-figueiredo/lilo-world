import type { ProgressSummary } from '@application/use-cases/get-progress-summary';
import { h } from '@presentation/ui/dom';

/** What the child has achieved, shown with pictures and big numbers. */
export class ProgressPanel {
  readonly element: HTMLElement;
  private readonly body = h('div', { className: 'progress__body' });
  private readonly title = h('h2', { className: 'sheet__title' });

  constructor(onClose: () => void) {
    this.element = h(
      'section',
      { className: 'overlay', attrs: { 'aria-label': 'Meu progresso' } },
      [
        h('div', { className: 'sheet sheet--wide' }, [
          h('div', { className: 'sheet__header' }, [
            this.title,
            h('button', {
              className: 'panel__close',
              text: '✕',
              attrs: { type: 'button', 'aria-label': 'Fechar' },
              onTap: onClose,
            }),
          ]),
          this.body,
        ]),
      ],
    );
  }

  open(playerName: string, summary: ProgressSummary): void {
    this.title.textContent = `⭐ Progresso de ${playerName}`;
    const stat = (icon: string, value: string, label: string) =>
      h('div', { className: 'stat' }, [
        h('span', { className: 'stat__icon', text: icon }),
        h('span', { className: 'stat__value', text: value }),
        h('span', { className: 'stat__label', text: label }),
      ]);

    this.body.replaceChildren(
      h('div', { className: 'stats' }, [
        stat('⭐', String(summary.stars), 'estrelas'),
        stat('🪙', String(summary.coins), 'moedas'),
        stat('👕', `${summary.itemsOwned}/${summary.itemsTotal}`, 'roupas'),
        stat('🌍', `${summary.worldsOpen}/${summary.worldsTotal}`, 'mundos'),
      ]),
      h('h3', { className: 'settings__heading', text: '🎯 Missões' }),
      h(
        'ul',
        { className: 'mission-list' },
        summary.missions.map((mission) =>
          h('li', { className: `mission-row${mission.done ? ' is-done' : ''}` }, [
            h('span', { className: 'mission-row__check', text: mission.done ? '✅' : '⬜' }),
            h('span', { className: 'mission-row__title', text: mission.title }),
            h('span', {
              className: 'mission-row__meta',
              text:
                mission.stats.attempts === 0
                  ? 'Ainda não jogou'
                  : `Jogou ${mission.stats.attempts}×`,
            }),
          ]),
        ),
      ),
      h('div', { className: 'album-teaser' }, [
        h('span', { className: 'pictogram pictogram--big', text: '📒' }),
        h('span', { text: 'Álbum de figurinhas: chegando em breve!' }),
      ]),
    );
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }
}
