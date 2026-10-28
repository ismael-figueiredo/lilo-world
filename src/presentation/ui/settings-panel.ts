import { sessionLimits, type Settings } from '@domain/settings/settings';
import { h } from '@presentation/ui/dom';
import { holdButton } from '@presentation/ui/hold-button';

export interface SettingsPanelCallbacks {
  onChange(patch: Partial<Settings>, preview?: 'effects' | 'voice' | 'music'): void;
  onClose(): void;
}

type VolumeKey = 'masterVolume' | 'voiceVolume' | 'musicVolume' | 'effectsVolume';
type FlagKey = 'voiceEnabled' | 'softColors' | 'reducedMotion' | 'showMinimap';

/** Comfort settings with big controls. The time limit is for adults only. */
export class SettingsPanel {
  readonly element: HTMLElement;
  private readonly body = h('div', { className: 'settings__body' });
  private settings: Settings | undefined;
  private limitUnlocked = false;

  constructor(private readonly callbacks: SettingsPanelCallbacks) {
    this.element = h('section', { className: 'overlay', attrs: { 'aria-label': 'Ajustes' } }, [
      h('div', { className: 'sheet sheet--wide' }, [
        h('div', { className: 'sheet__header' }, [
          h('h2', { className: 'sheet__title', text: '⚙️ Ajustes' }),
          h('button', {
            className: 'panel__close',
            text: '✕',
            attrs: { type: 'button', 'aria-label': 'Fechar ajustes' },
            onTap: () => {
              callbacks.onClose();
            },
          }),
        ]),
        this.body,
      ]),
    ]);
  }

  open(settings: Settings): void {
    this.limitUnlocked = false;
    this.render(settings);
    this.element.classList.add('is-visible');
  }

  close(): void {
    this.element.classList.remove('is-visible');
  }

  render(settings: Settings): void {
    this.settings = settings;
    this.body.replaceChildren(
      this.section('🔊 Som', [
        this.slider('Volume geral', 'masterVolume', 'effects'),
        this.slider('Voz do Lilo', 'voiceVolume', 'voice'),
        this.slider('Música', 'musicVolume', 'music'),
        this.slider('Efeitos', 'effectsVolume', 'effects'),
        this.toggle('Lilo fala em voz alta', 'voiceEnabled'),
        this.choice(
          'Velocidade da voz',
          settings.voiceSpeed,
          [
            ['slow', '🐢 Devagar'],
            ['normal', '🙂 Normal'],
          ],
          (voiceSpeed) => ({ voiceSpeed }),
          'voice',
        ),
      ]),
      this.section('🎨 Tela e movimento', [
        this.toggle('Cores mais suaves', 'softColors'),
        this.toggle('Reduzir movimento', 'reducedMotion'),
        this.toggle('Mostrar minimapa', 'showMinimap'),
        this.choice(
          'Câmera',
          settings.cameraSensitivity,
          [
            ['low', 'Lenta'],
            ['normal', 'Normal'],
            ['high', 'Rápida'],
          ],
          (cameraSensitivity) => ({ cameraSensitivity }),
        ),
        this.choice(
          'Movimento na cidade',
          settings.worldActivity,
          [
            ['calm', '🌿 Calmo'],
            ['normal', '🚗 Normal'],
          ],
          (worldActivity) => ({ worldActivity }),
        ),
      ]),
      this.section('⏱️ Tempo de jogo', [
        this.limitUnlocked
          ? this.choice(
              'Limite por sessão',
              String(settings.sessionLimitMinutes),
              sessionLimits.map((m) => [String(m), m === 0 ? 'Sem limite' : `${m} min`] as const),
              (value) => ({
                sessionLimitMinutes: Number(value) as Settings['sessionLimitMinutes'],
              }),
            )
          : h('div', { className: 'settings__row' }, [
              h('span', {
                className: 'settings__label',
                text:
                  settings.sessionLimitMinutes === 0
                    ? 'Sem limite'
                    : `${settings.sessionLimitMinutes} minutos por sessão`,
              }),
              holdButton(
                '👪 Mudar',
                () => {
                  this.limitUnlocked = true;
                  if (this.settings !== undefined) this.render(this.settings);
                },
                { className: 'hold--subtle' },
              ),
            ]),
      ]),
    );
  }

  private section(title: string, rows: readonly HTMLElement[]): HTMLElement {
    return h('div', { className: 'settings__section' }, [
      h('h3', { className: 'settings__heading', text: title }),
      ...rows,
    ]);
  }

  private slider(
    label: string,
    key: VolumeKey,
    preview: 'effects' | 'voice' | 'music',
  ): HTMLElement {
    const value = Math.round((this.settings?.[key] ?? 0) * 10);
    const output = h('span', { className: 'settings__value', text: `${value * 10}%` });
    const input = h('input', {
      className: 'slider',
      attrs: {
        type: 'range',
        min: '0',
        max: '10',
        step: '1',
        value: String(value),
        'aria-label': label,
      },
    });
    input.addEventListener('input', () => {
      output.textContent = `${Number(input.value) * 10}%`;
    });
    input.addEventListener('change', () => {
      this.callbacks.onChange({ [key]: Number(input.value) / 10 }, preview);
    });
    return h('label', { className: 'settings__row' }, [
      h('span', { className: 'settings__label', text: label }),
      input,
      output,
    ]);
  }

  private toggle(label: string, key: FlagKey): HTMLElement {
    const on = this.settings?.[key] ?? false;
    return h('div', { className: 'settings__row' }, [
      h('span', { className: 'settings__label', text: label }),
      h(
        'button',
        {
          className: `switch${on ? ' is-on' : ''}`,
          attrs: {
            type: 'button',
            role: 'switch',
            'aria-checked': String(on),
            'aria-label': label,
          },
          onTap: () => {
            this.callbacks.onChange({ [key]: !on });
          },
        },
        [h('span', { className: 'switch__knob' })],
      ),
    ]);
  }

  private choice<T extends string>(
    label: string,
    current: T,
    options: readonly (readonly [T, string])[],
    toPatch: (value: T) => Partial<Settings>,
    preview?: 'effects' | 'voice' | 'music',
  ): HTMLElement {
    return h('div', { className: 'settings__row' }, [
      h('span', { className: 'settings__label', text: label }),
      h(
        'div',
        { className: 'segmented', attrs: { role: 'radiogroup', 'aria-label': label } },
        options.map(([value, text]) =>
          h('button', {
            className: `segmented__option${value === current ? ' is-active' : ''}`,
            text,
            attrs: { type: 'button', role: 'radio', 'aria-checked': String(value === current) },
            onTap: () => {
              this.callbacks.onChange(toPatch(value), preview);
            },
          }),
        ),
      ),
    ]);
  }
}
