import { h } from '@presentation/ui/dom';

export interface Picture {
  readonly icon: string;
  readonly label: string;
}

export interface Choice extends Picture {
  readonly id: string;
  /** Already used: stays visible, but cannot be chosen again. */
  readonly used?: boolean;
}

/**
 * The bottom of the screen during something done at home: the steps in pictures,
 * or a few choices. The scene above stays visible.
 */
export class HomeSheet {
  readonly element = h('section', {
    className: 'home-sheet',
    attrs: { 'aria-label': 'O que fazer agora' },
  });

  /** Shows the steps with `current` lit, and waits for the one big button. */
  press(steps: readonly Picture[], current: number): Promise<void> {
    return new Promise((resolve) => {
      const step = steps[current];
      this.element.replaceChildren(
        h(
          'div',
          { className: 'home-sheet__steps' },
          steps.map((picture, index) =>
            h(
              'div',
              {
                className: `home-step${index === current ? ' is-now' : ''}${index < current ? ' is-done' : ''}`,
              },
              [
                h('span', { className: 'home-step__icon', text: picture.icon }),
                h('span', { className: 'home-step__label', text: picture.label }),
              ],
            ),
          ),
        ),
        h('button', {
          className: 'big-button big-button--green home-sheet__go',
          text: `${step?.icon ?? ''} ${step?.label ?? ''}`,
          attrs: { type: 'button' },
          onTap: () => {
            this.hide();
            resolve();
          },
        }),
      );
      this.element.classList.add('is-visible');
    });
  }

  /** Shows the choices and answers with the id of the one that was chosen. */
  choose(title: string, choices: readonly Choice[]): Promise<string> {
    return new Promise((resolve) => {
      this.element.replaceChildren(
        h('h2', { className: 'home-sheet__title', text: title }),
        h(
          'div',
          { className: 'home-sheet__choices' },
          choices.map((choice) =>
            h(
              'button',
              {
                className: `home-choice${choice.used === true ? ' is-used' : ''}`,
                attrs: {
                  type: 'button',
                  'aria-label': choice.label,
                  ...(choice.used === true ? { disabled: 'true' } : {}),
                },
                onTap: () => {
                  this.hide();
                  resolve(choice.id);
                },
              },
              [
                h('span', { className: 'home-step__icon', text: choice.icon }),
                h('span', { className: 'home-step__label', text: choice.label }),
              ],
            ),
          ),
        ),
      );
      this.element.classList.add('is-visible');
    });
  }

  hide(): void {
    this.element.classList.remove('is-visible');
  }
}
