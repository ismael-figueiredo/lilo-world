import { phrases } from '@application/phrases';
import {
  eyeColors,
  genders,
  guardians,
  hairColors,
  hairStyles,
  skinTones,
  type ChildChoices,
  type ChildLook,
  type Gender,
  type Swatch,
} from '@domain/avatar/child';
import { childPerson, guardianPerson } from '@presentation/actors/cast';
import type { ChildStudio } from '@presentation/ui/child-studio';
import { h, toCssColor } from '@presentation/ui/dom';

export interface ChildCreatorCallbacks {
  onSpeak(text: string): void;
}

/** The hair most children of that choice would try first; it can be changed right after. */
const firstHair: Readonly<Record<Gender, ChildLook['hairStyle']>> = {
  girl: 'long',
  boy: 'short',
  neutral: 'short',
};

interface Option {
  readonly key: string;
  readonly name: string;
  readonly selected: boolean;
  readonly picture?: string;
  readonly swatch?: number;
  choose(): void;
}

interface Step {
  readonly title: string;
  readonly say: string;
  sections(): readonly (readonly Option[])[];
}

/**
 * "Who are you?" One question at a time, with the child in 3D beside the answers.
 * Nothing here is right or wrong, and everything can be changed later.
 */
export class ChildCreator {
  readonly element: HTMLElement;
  private readonly preview = h('div', { className: 'creator__preview' });
  private readonly title = h('h2', { className: 'creator__title' });
  private readonly dots = h('div', {
    className: 'creator__dots',
    attrs: { 'aria-hidden': 'true' },
  });
  private readonly choices = h('div', { className: 'creator__choices' });
  private readonly actions = h('div', { className: 'creator__actions' });
  private readonly steps: readonly Step[];
  private child: ChildChoices | undefined;
  private index = 0;
  private finishLabel = '';
  private onDone: (choices: ChildChoices) => void = () => undefined;
  private onCancel: () => void = () => undefined;

  constructor(
    private readonly studio: ChildStudio,
    private readonly callbacks: ChildCreatorCallbacks,
  ) {
    this.steps = [
      { title: 'Quem é você?', say: phrases.creatorWho, sections: () => [this.genderOptions()] },
      { title: 'Sua pele', say: phrases.creatorSkin, sections: () => [this.skinOptions()] },
      {
        title: 'Seu cabelo',
        say: phrases.creatorHair,
        sections: () => [this.hairStyleOptions(), this.hairColorOptions()],
      },
      { title: 'Seus olhos', say: phrases.creatorEyes, sections: () => [this.eyeOptions()] },
      {
        title: 'Quem cuida de você em casa?',
        say: phrases.creatorGuardian,
        sections: () => [this.guardianOptions()],
      },
    ];
    this.element = h(
      'section',
      { className: 'creator', attrs: { 'aria-label': 'Criar a criança' } },
      [
        h('div', { className: 'creator__sheet' }, [
          this.preview,
          h('div', { className: 'creator__side' }, [
            this.title,
            this.dots,
            this.choices,
            this.actions,
          ]),
        ]),
      ],
    );
  }

  get isOpen(): boolean {
    return this.child !== undefined;
  }

  /** `done` gets the choices; going back from the first step calls `cancel`. */
  open(
    initial: ChildChoices,
    finishLabel: string,
    done: (choices: ChildChoices) => void,
    cancel: () => void,
  ): void {
    this.child = initial;
    this.index = 0;
    this.finishLabel = finishLabel;
    this.onDone = done;
    this.onCancel = cancel;
    this.element.classList.add('is-visible');
    this.render(true);
  }

  close(): void {
    this.child = undefined;
    this.element.classList.remove('is-visible');
    this.studio.stop();
  }

  back(): void {
    if (this.index > 0) {
      this.index -= 1;
      this.render(true);
      return;
    }
    const cancel = this.onCancel;
    this.close();
    cancel();
  }

  private next(): void {
    const { child } = this;
    if (child === undefined) return;
    if (this.index < this.steps.length - 1) {
      this.index += 1;
      this.render(true);
      return;
    }
    const done = this.onDone;
    this.close();
    done(child);
  }

  private change(changes: Partial<ChildChoices>): void {
    if (this.child === undefined) return;
    this.child = { ...this.child, ...changes };
    this.render(false);
  }

  private changeLook(changes: Partial<ChildLook>): void {
    if (this.child !== undefined) this.change({ look: { ...this.child.look, ...changes } });
  }

  private render(entering: boolean): void {
    const { child } = this;
    const step = this.steps[this.index];
    if (child === undefined || step === undefined) return;
    this.title.textContent = step.title;
    this.dots.replaceChildren(
      ...this.steps.map((_, index) =>
        h('span', { className: `creator__dot${index === this.index ? ' is-active' : ''}` }),
      ),
    );
    const focused = document.activeElement;
    const focusedKey = focused instanceof HTMLElement ? focused.dataset.key : undefined;
    this.choices.replaceChildren(
      ...step.sections().map((options) =>
        h(
          'div',
          { className: 'creator__options', attrs: { role: 'radiogroup' } },
          options.map((option) => this.card(option)),
        ),
      ),
    );
    if (focusedKey !== undefined) {
      this.choices.querySelector<HTMLElement>(`[data-key="${focusedKey}"]`)?.focus();
    }
    const last = this.index === this.steps.length - 1;
    this.actions.replaceChildren(
      h('button', {
        className: 'big-button big-button--light',
        text: '← Voltar',
        attrs: { type: 'button' },
        onTap: () => {
          this.back();
        },
      }),
      h('button', {
        className: 'big-button big-button--green',
        text: last ? this.finishLabel : 'Próximo →',
        attrs: { type: 'button' },
        onTap: () => {
          this.next();
        },
      }),
    );
    const shown =
      this.index === this.steps.length - 1
        ? guardianPerson(child.guardian, child.look)
        : childPerson(child.look, child.outfit);
    this.studio.show(this.preview, shown, entering);
    if (entering) this.callbacks.onSpeak(step.say);
  }

  private card(option: Option): HTMLElement {
    return h(
      'button',
      {
        className: `creator-card${option.selected ? ' is-selected' : ''}`,
        attrs: {
          type: 'button',
          role: 'radio',
          'aria-checked': String(option.selected),
          'aria-label': option.name,
          'data-key': option.key,
        },
        onTap: () => {
          option.choose();
          this.callbacks.onSpeak(option.name);
        },
      },
      [
        option.picture === undefined
          ? null
          : h('img', {
              className: 'creator-card__picture',
              attrs: { src: option.picture, alt: '', draggable: 'false' },
            }),
        option.swatch === undefined
          ? null
          : h('span', {
              className: 'creator-card__swatch',
              attrs: { style: `background:${toCssColor(option.swatch)}` },
            }),
        h('span', { className: 'creator-card__name', text: option.name }),
      ],
    );
  }

  private get choices_(): ChildChoices {
    if (this.child === undefined) throw new Error('The creator is closed');
    return this.child;
  }

  private colorOptions(
    prefix: string,
    swatches: readonly Swatch[],
    current: number,
    choose: (color: number) => void,
  ): Option[] {
    return swatches.map(({ name, color }) => ({
      key: `${prefix}-${color}`,
      name,
      selected: color === current,
      swatch: color,
      choose: () => {
        choose(color);
      },
    }));
  }

  private genderOptions(): Option[] {
    const { look, outfit } = this.choices_;
    return genders.map(({ id, name }) => {
      const hairStyle = look.hairStyle === firstHair[look.gender] ? firstHair[id] : look.hairStyle;
      return {
        key: `gender-${id}`,
        name,
        selected: id === look.gender,
        picture: this.studio.picture(
          childPerson({ ...look, gender: id, hairStyle }, outfit),
          'face',
        ),
        choose: () => {
          this.changeLook({ gender: id, hairStyle });
        },
      };
    });
  }

  private skinOptions(): Option[] {
    const { look } = this.choices_;
    return this.colorOptions('skin', skinTones, look.skin, (skin) => {
      this.changeLook({ skin });
    });
  }

  private hairStyleOptions(): Option[] {
    const { look, outfit } = this.choices_;
    return hairStyles.map(({ id, name }) => ({
      key: `style-${id}`,
      name,
      selected: id === look.hairStyle,
      picture: this.studio.picture(childPerson({ ...look, hairStyle: id }, outfit), 'face'),
      choose: () => {
        this.changeLook({ hairStyle: id });
      },
    }));
  }

  private hairColorOptions(): Option[] {
    const { look } = this.choices_;
    return this.colorOptions('hair', hairColors, look.hair, (hair) => {
      this.changeLook({ hair });
    });
  }

  private eyeOptions(): Option[] {
    const { look } = this.choices_;
    return this.colorOptions('eyes', eyeColors, look.eyes, (eyes) => {
      this.changeLook({ eyes });
    });
  }

  private guardianOptions(): Option[] {
    const { look, guardian } = this.choices_;
    return guardians.map(({ id, name }) => ({
      key: `guardian-${id}`,
      name,
      selected: id === guardian,
      picture: this.studio.picture(guardianPerson(id, look), 'face'),
      choose: () => {
        this.change({ guardian: id });
      },
    }));
  }
}
