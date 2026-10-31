/**
 * How each avatar model is set up in 3D. The models live in
 * public/models/avatars (built by `pnpm assets`) and share standard animation
 * names: idle, walk, run, jump, wave, yes (the robot also has dance, thumbs).
 */
export interface AvatarRig {
  /** Height in world units (children are a bit shorter than the robot). */
  readonly height: number;
  /** Material tinted by the wardrobe "color" items, if any. */
  readonly bodyMaterial?: string;
  /** Material tinted by the wardrobe "details" items, if any. */
  readonly trimMaterial?: string;
  /** Starting body color when nothing is chosen (keeps the model's own when absent). */
  readonly defaultBody?: number;
  readonly defaultTrim?: number;
  /** Untextured models look best faceted; textured ones keep smooth shading. */
  readonly flatShading: boolean;
  /**
   * Manual accessory fit, as fractions of the height, for heads that cannot be
   * measured well (long ears, wide hair): top of the head, eye line, head width.
   */
  readonly fit?: { readonly headTop: number; readonly eyes: number; readonly headWidth: number };
}

const kid: AvatarRig = { height: 1.55, flatShading: false };
const bunnyFit = { headTop: 0.77, eyes: 0.6, headWidth: 0.4 } as const;

export const avatarRigs: Readonly<Record<string, AvatarRig>> = {
  child: { height: 1.4, flatShading: false, fit: { headTop: 1, eyes: 0.82, headWidth: 0.39 } },
  adult: { height: 1.85, flatShading: false, fit: { headTop: 1, eyes: 0.88, headWidth: 0.26 } },
  robot: {
    height: 1.9,
    bodyMaterial: 'Main',
    trimMaterial: 'Grey',
    defaultBody: 0xffc93c,
    defaultTrim: 0xdfe6ee,
    flatShading: true,
  },
  anne: kid,
  lis: kid,
  sam: kid,
  shaun: kid,
  'bunny-pigtails': { height: 1.6, flatShading: false, fit: bunnyFit },
  'bunny-cyan': { height: 1.6, flatShading: false, fit: bunnyFit },
  panda: { height: 1.5, flatShading: false },
  frog: {
    height: 1.45,
    bodyMaterial: 'Frog_Main',
    trimMaterial: 'Frog_Secondary',
    flatShading: true,
  },
};

export const rigFor = (avatarId: string): AvatarRig => avatarRigs[avatarId] ?? kid;

export const avatarModelUrl = (baseUrl: string, avatarId: string): string =>
  `${baseUrl}models/avatars/${avatarId}.glb`;

export const avatarPictureUrl = (baseUrl: string, avatarId: string): string =>
  `${baseUrl}avatars/${avatarId}.png`;
