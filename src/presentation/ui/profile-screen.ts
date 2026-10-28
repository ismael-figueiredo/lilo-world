import type { AvatarDefinition } from '@domain/avatar/avatar';
import {
  DEFAULT_AVATAR_ID,
  MAX_NAME_LENGTH,
  type PlayerProfile,
} from '@domain/profile/player-profile';
import { h } from '@presentation/ui/dom';
import { holdButton } from '@presentation/ui/hold-button';

export interface ProfileScreenCallbacks {
  onSelect(profile: PlayerProfile): void;
  onCreate(name: string, avatarId: string): void;
  /** The child is looking at a character: start loading it. */
  onPreviewAvatar?(avatarId: string): void;
  onRename(profile: PlayerProfile, name: string): void;
  onDelete(profile: PlayerProfile): void;
}

const cardColors = ['#3fa9f5', '#3fae5a', '#ff7a6b', '#9b6bf2', '#ffb02e', '#2ec4b6'];

const colorFor = (id: string): string => {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return cardColors[hash % cardColors.length] ?? '#3fa9f5';
};

/**
 * "Who is playing?" Big cards with each child's name. Editing and removing
 * live behind the parents' area (hold for 3 seconds).
 */
export class ProfileScreen {
  readonly element: HTMLElement;
  private readonly body = h('div', { className: 'profiles__body' });
  private readonly status = h('p', { className: 'start__status', text: 'Preparando o mundo…' });
  private profiles: readonly PlayerProfile[] = [];
  private editing = false;
  private avatars: readonly AvatarDefinition[] = [];
  private pictureOf: (avatarId: string) => string = () => '';

  constructor(private readonly callbacks: ProfileScreenCallbacks) {
    this.element = h('div', { className: 'start' }, [
      h('div', { className: 'start__card' }, [
        h('div', { className: 'start__logo', attrs: { 'aria-hidden': 'true' } }, [
          h('span', { className: 'dialog__eye' }),
          h('span', { className: 'dialog__eye' }),
          h('span', { className: 'dialog__beak' }),
        ]),
        h('h1', { className: 'start__title', text: 'Lilo World' }),
        this.status,
        this.body,
      ]),
    ]);
  }

  setAvatars(avatars: readonly AvatarDefinition[], pictureOf: (avatarId: string) => string): void {
    this.avatars = avatars;
    this.pictureOf = pictureOf;
  }

  setLoading(message: string): void {
    this.status.textContent = message;
    this.body.replaceChildren();
  }

  show(profiles: readonly PlayerProfile[]): void {
    this.profiles = profiles;
    this.element.classList.remove('is-leaving', 'is-hidden');
    if (profiles.length === 0) {
      this.showForm();
      return;
    }
    this.status.textContent = this.editing ? 'Área dos pais' : 'Quem vai jogar?';
    const cards = profiles.map((profile) => this.card(profile));
    const addCard = h(
      'button',
      {
        className: 'profile-card profile-card--new',
        attrs: { type: 'button' },
        onTap: () => {
          this.showForm();
        },
      },
      [
        h('span', { className: 'profile-card__avatar', text: '+' }),
        h('span', { className: 'profile-card__name', text: 'Novo jogador' }),
      ],
    );

    const parents = this.editing
      ? h('button', {
          className: 'big-button',
          text: '✓ Pronto',
          attrs: { type: 'button' },
          onTap: () => {
            this.editing = false;
            this.show(this.profiles);
          },
        })
      : holdButton(
          '👪 Área dos pais',
          () => {
            this.editing = true;
            this.show(this.profiles);
          },
          { className: 'hold--subtle' },
        );

    this.body.replaceChildren(
      h('div', { className: 'profiles__grid' }, [...cards, this.editing ? null : addCard]),
      h('div', { className: 'profiles__footer' }, [parents]),
    );
  }

  hide(): void {
    this.element.classList.add('is-leaving');
    window.setTimeout(() => {
      this.element.classList.add('is-hidden');
    }, 600);
  }

  private card(profile: PlayerProfile): HTMLElement {
    const avatar = h(
      'span',
      {
        className: 'profile-card__avatar',
        attrs: { style: `background:${colorFor(profile.id)}` },
      },
      [
        h('img', {
          className: 'avatar-picture',
          attrs: { src: this.pictureOf(profile.avatarId), alt: '', draggable: 'false' },
        }),
      ],
    );
    if (!this.editing) {
      return h(
        'button',
        {
          className: 'profile-card',
          attrs: { type: 'button', 'aria-label': `Jogar como ${profile.name}` },
          onTap: () => {
            this.callbacks.onSelect(profile);
          },
        },
        [avatar, h('span', { className: 'profile-card__name', text: profile.name })],
      );
    }
    return h('div', { className: 'profile-card profile-card--editing' }, [
      avatar,
      h('span', { className: 'profile-card__name', text: profile.name }),
      h('button', {
        className: 'small-button',
        text: '✏️ Renomear',
        attrs: { type: 'button' },
        onTap: () => {
          this.showForm(profile);
        },
      }),
      holdButton(
        '🗑️ Remover',
        () => {
          this.callbacks.onDelete(profile);
        },
        { className: 'hold--danger' },
      ),
    ]);
  }

  /** New player (or rename). The name is usually typed by an adult. */
  private showForm(existing?: PlayerProfile): void {
    this.status.textContent = existing === undefined ? 'Qual é o seu nome?' : 'Novo nome';
    const input = h('input', {
      className: 'name-input',
      attrs: {
        type: 'text',
        maxlength: String(MAX_NAME_LENGTH),
        autocomplete: 'off',
        autocapitalize: 'words',
        enterkeyhint: 'done',
        'aria-label': 'Nome do jogador',
        placeholder: 'Nome',
      },
    });
    if (existing !== undefined) input.value = existing.name;

    let chosen = existing?.avatarId ?? this.avatars[0]?.id ?? DEFAULT_AVATAR_ID;
    const picker = h('div', {
      className: 'avatar-picker',
      attrs: { role: 'radiogroup', 'aria-label': 'Personagem' },
    });
    const renderPicker = () => {
      picker.replaceChildren(
        ...this.avatars.map((avatarOption) =>
          h(
            'button',
            {
              className: `avatar-option${avatarOption.id === chosen ? ' is-selected' : ''}`,
              attrs: {
                type: 'button',
                role: 'radio',
                'aria-checked': String(avatarOption.id === chosen),
                'aria-label': avatarOption.name,
              },
              onTap: () => {
                chosen = avatarOption.id;
                this.callbacks.onPreviewAvatar?.(chosen);
                renderPicker();
              },
            },
            [
              h('img', {
                className: 'avatar-picture',
                attrs: { src: this.pictureOf(avatarOption.id), alt: '', draggable: 'false' },
              }),
              h('span', { className: 'avatar-option__name', text: avatarOption.name }),
            ],
          ),
        ),
      );
    };
    renderPicker();

    const submit = () => {
      const name = input.value.trim();
      if (name.length === 0) {
        input.focus();
        input.classList.add('is-empty');
        return;
      }
      if (existing === undefined) this.callbacks.onCreate(name, chosen);
      else this.callbacks.onRename(existing, name);
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });

    const back =
      this.profiles.length > 0
        ? h('button', {
            className: 'big-button big-button--light',
            text: '← Voltar',
            attrs: { type: 'button' },
            onTap: () => {
              this.show(this.profiles);
            },
          })
        : null;

    this.body.replaceChildren(
      h('div', { className: 'profiles__form' }, [
        input,
        existing === undefined
          ? h('p', { className: 'profiles__hint', text: 'Escolha o seu personagem:' })
          : null,
        existing === undefined ? picker : null,
        h('div', { className: 'profiles__actions' }, [
          back,
          h('button', {
            className: 'big-button big-button--green',
            text: existing === undefined ? '▶ Começar' : '✓ Salvar',
            attrs: { type: 'button' },
            onTap: submit,
          }),
        ]),
      ]),
    );
    window.setTimeout(() => {
      input.focus();
    }, 50);
  }
}
