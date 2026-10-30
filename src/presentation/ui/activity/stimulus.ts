import type { Stimulus } from '@domain/activity/activity';
import { h, picture } from '@presentation/ui/dom';

const repeated = (card: { pictogram: string; image?: string }, count: number): HTMLElement[] =>
  Array.from({ length: count }, () => picture(card, 'pictogram stimulus__object'));

/** What is shown big above the answers. The same pictures a mission card would use. */
export function renderStimulus(stimulus: Stimulus): HTMLElement | null {
  switch (stimulus.kind) {
    case 'none':
      return null;
    case 'word':
      return h('p', { className: 'stimulus stimulus--word', text: stimulus.text });
    case 'picture':
      return h('div', { className: 'stimulus' }, [
        picture(stimulus.picture, 'pictogram stimulus__picture'),
      ]);
    case 'objects':
      return h(
        'div',
        { className: 'stimulus' },
        stimulus.groups.map((count) =>
          h('span', { className: 'stimulus__group' }, repeated(stimulus.picture, count)),
        ),
      );
    case 'sum':
      return h('div', { className: 'stimulus' }, [
        h('span', { className: 'stimulus__group' }, repeated(stimulus.picture, stimulus.a)),
        h('span', { className: 'stimulus__sign', text: '+' }),
        h('span', { className: 'stimulus__group' }, repeated(stimulus.picture, stimulus.b)),
      ]);
    case 'price':
      return h('div', { className: 'stimulus' }, [
        picture(stimulus.picture, 'pictogram stimulus__picture'),
        h('span', { className: 'stimulus__sign', text: `= ${stimulus.price}` }),
        h('span', { className: 'pictogram stimulus__picture', text: '🪙' }),
      ]);
  }
}
