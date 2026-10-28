import type { AvatarDefinition } from '@domain/avatar/avatar';
import type { WardrobeItem } from '@domain/avatar/wardrobe-item';
import type { Mission } from '@domain/mission/mission';
import type { World } from '@domain/world/world';

/**
 * Initial game content (Phase 1). Pictograms are emoji placeholders; they will be
 * replaced by ARASAAC pictograms so children see the same images used in therapy.
 */
export const worlds: readonly World[] = [
  { id: 'city', name: 'Cidade', requiredStars: 0, missionIds: ['city-market'], color: 0x4fa3e0 },
  { id: 'nature', name: 'Natureza', requiredStars: 3, missionIds: [], color: 0x6cc070 },
  { id: 'home', name: 'Casa', requiredStars: 6, missionIds: [], color: 0xf2a65a },
  { id: 'school', name: 'Escola e Parque', requiredStars: 9, missionIds: [], color: 0xb08ee6 },
  { id: 'emotions', name: 'Emoções', requiredStars: 12, missionIds: [], color: 0xf07a9a },
];

export const missions: readonly Mission[] = [
  {
    id: 'city-market',
    worldId: 'city',
    title: 'Compras no mercado',
    introduction: 'Vamos ao mercado! Olhe a lista.',
    choices: [
      { id: 'apple', label: 'maçã', pictogram: '🍎' },
      { id: 'banana', label: 'banana', pictogram: '🍌' },
      { id: 'milk', label: 'leite', pictogram: '🥛' },
      { id: 'bread', label: 'pão', pictogram: '🍞' },
      { id: 'carrot', label: 'cenoura', pictogram: '🥕' },
      { id: 'cheese', label: 'queijo', pictogram: '🧀' },
    ],
    steps: [
      { targetId: 'apple', prompt: 'Pegue a maçã.' },
      { targetId: 'milk', prompt: 'Agora, pegue o leite.' },
      { targetId: 'bread', prompt: 'Agora, pegue o pão.' },
    ],
    reward: { coins: 10, stars: 1 },
  },
];

export const wardrobeItems: readonly WardrobeItem[] = [
  { id: 'body-sun', name: 'Amarelo sol', slot: 'body', look: 'color', price: 0, color: 0xffc93c },
  { id: 'body-sky', name: 'Azul céu', slot: 'body', look: 'color', price: 5, color: 0x3fa9f5 },
  { id: 'body-leaf', name: 'Verde folha', slot: 'body', look: 'color', price: 5, color: 0x4cc26b },
  { id: 'body-grape', name: 'Roxo uva', slot: 'body', look: 'color', price: 10, color: 0x9b6bf2 },
  { id: 'body-coral', name: 'Coral', slot: 'body', look: 'color', price: 10, color: 0xff7a6b },
  { id: 'trim-silver', name: 'Prata', slot: 'trim', look: 'color', price: 0, color: 0xc9d1d9 },
  { id: 'trim-mint', name: 'Menta', slot: 'trim', look: 'color', price: 5, color: 0x7ee0c3 },
  { id: 'trim-gold', name: 'Dourado', slot: 'trim', look: 'color', price: 15, color: 0xf2b84b },
  {
    id: 'hat-bus-driver',
    name: 'Boné de motorista',
    slot: 'hat',
    look: 'cap',
    price: 10,
    color: 0x2e5fa8,
  },
  {
    id: 'hat-party',
    name: 'Chapéu de festa',
    slot: 'hat',
    look: 'party-hat',
    price: 5,
    color: 0xff5fa2,
  },
  { id: 'hat-beanie', name: 'Gorro', slot: 'hat', look: 'beanie', price: 10, color: 0xe0483e },
  { id: 'hat-crown', name: 'Coroa', slot: 'hat', look: 'crown', price: 20, color: 0xffcf33 },
  {
    id: 'glasses-round',
    name: 'Óculos redondos',
    slot: 'accessory',
    look: 'glasses',
    price: 10,
    color: 0x2d3142,
  },
  {
    id: 'backpack-green',
    name: 'Mochila verde',
    slot: 'accessory',
    look: 'backpack',
    price: 15,
    color: 0x3fae5a,
  },
  {
    id: 'headphones',
    name: 'Fones de ouvido',
    slot: 'accessory',
    look: 'headphones',
    price: 15,
    color: 0x5b6cff,
  },
];

/** Characters to play as (3D models by Quaternius, CC0). The first one is the default. */
export const avatars: readonly AvatarDefinition[] = [
  { id: 'robot', name: 'Robô', kind: 'robot', recolorable: true },
  { id: 'anne', name: 'Ana', kind: 'kid', recolorable: false },
  { id: 'lis', name: 'Lis', kind: 'kid', recolorable: false },
  { id: 'sam', name: 'Sam', kind: 'kid', recolorable: false },
  { id: 'shaun', name: 'Téo', kind: 'kid', recolorable: false },
  { id: 'bunny-pigtails', name: 'Coelhinha', kind: 'animal', recolorable: false },
  { id: 'bunny-cyan', name: 'Coelho', kind: 'animal', recolorable: false },
  { id: 'panda', name: 'Panda', kind: 'animal', recolorable: false },
  { id: 'frog', name: 'Sapo', kind: 'animal', recolorable: true },
];
