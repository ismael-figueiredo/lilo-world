import type { AvatarDefinition } from '@domain/avatar/avatar';
import type { WardrobeItem } from '@domain/avatar/wardrobe-item';
import type { Mission, MissionVariant } from '@domain/mission/mission';
import type { World } from '@domain/world/world';

/**
 * Initial game content (Phase 1). Pictograms are emoji placeholders; they will be
 * replaced by ARASAAC pictograms so children see the same images used in therapy.
 */
export const worlds: readonly World[] = [
  {
    id: 'city',
    name: 'Cidade',
    requiredStars: 0,
    missionIds: ['city-market', 'city-bakery', 'city-bus', 'city-crosswalk'],
    color: 0x4fa3e0,
  },
  {
    id: 'nature',
    name: 'Natureza',
    requiredStars: 3,
    missionIds: ['nature-animals', 'nature-garden', 'nature-recycling'],
    color: 0x6cc070,
  },
  {
    id: 'home',
    name: 'Casa',
    requiredStars: 6,
    missionIds: ['home-hygiene', 'home-dressing', 'home-table'],
    color: 0xf2a65a,
  },
  { id: 'school', name: 'Escola e Parque', requiredStars: 9, missionIds: [], color: 0xb08ee6 },
  { id: 'emotions', name: 'Emoções', requiredStars: 12, missionIds: [], color: 0xf07a9a },
];

/** Things on the market shelves, with how the mascot names them ("a maçã"). */
const groceries = {
  apple: ['maçã', '🍎', 'a maçã'],
  banana: ['banana', '🍌', 'a banana'],
  milk: ['leite', '🥛', 'o leite'],
  bread: ['pão', '🍞', 'o pão'],
  carrot: ['cenoura', '🥕', 'a cenoura'],
  cheese: ['queijo', '🧀', 'o queijo'],
  eggs: ['ovos', '🥚', 'os ovos'],
  flour: ['farinha', '🌾', 'a farinha'],
  lettuce: ['alface', '🥬', 'a alface'],
  tomato: ['tomate', '🍅', 'o tomate'],
  potato: ['batata', '🥔', 'a batata'],
  onion: ['cebola', '🧅', 'a cebola'],
  strawberry: ['morango', '🍓', 'o morango'],
  chocolate: ['chocolate', '🍫', 'o chocolate'],
  rice: ['arroz', '🍚', 'o arroz'],
  beans: ['feijão', '🫘', 'o feijão'],
  orange: ['laranja', '🍊', 'a laranja'],
  corn: ['milho', '🌽', 'o milho'],
  butter: ['manteiga', '🧈', 'a manteiga'],
} as const;

type Grocery = keyof typeof groceries;

/** Coins at the cashier: each thing costs one coin. */
const MAX_PAY = 6;

/** A shopping trip for a recipe: pick each ingredient, then pay one coin per item. */
function recipe(
  id: string,
  dish: string,
  result: string,
  items: readonly Grocery[],
): MissionVariant {
  const count = items.length;
  return {
    id,
    title: `Compras para ${dish}`,
    introduction: `Vamos fazer ${dish}! Olhe a lista.`,
    steps: [
      ...items.map((item, index) => ({
        targetId: item,
        prompt: `${index === 0 ? 'Pegue' : 'Agora, pegue'} ${groceries[item][2]}.`,
      })),
      {
        targetId: `pay-${count}`,
        prompt: `Vamos ao caixa. São ${count} coisas: pague ${count} moedas.`,
      },
    ],
    farewell: `Obrigado! Bom apetite!`,
    result,
  };
}

/** Something to ask for at the bakery, always with "por favor". */
function snack(id: string, item: string, name: string, result: string): MissionVariant {
  return {
    id,
    introduction: `Vamos pedir ${name}! Monte a frase.`,
    steps: [
      { targetId: 'i-want', prompt: 'Toque em: eu quero.' },
      { targetId: item, prompt: `Agora, toque em ${name}.` },
      { targetId: 'please', prompt: 'E para terminar, com educação: por favor.' },
    ],
    result,
  };
}

/** Farm animals and the sound each one makes. */
const animals = {
  cow: ['vaca', '🐮', 'Muuu!'],
  pig: ['porco', '🐷', 'Oinc, oinc!'],
  sheep: ['ovelha', '🐑', 'Méééé!'],
  horse: ['cavalo', '🐴', 'Hiiiin!'],
  chick: ['pintinho', '🐥', 'Piu, piu!'],
  dog: ['cachorro', '🐶', 'Au, au!'],
  cat: ['gato', '🐱', 'Miau!'],
  duck: ['pato', '🦆', 'Quá, quá!'],
} as const;

type Animal = keyof typeof animals;

function animalQuiz(id: string, asked: readonly Animal[]): MissionVariant {
  return {
    id,
    introduction: 'Vamos ouvir os animais da fazenda!',
    steps: asked.map((animal, index) => ({
      targetId: animal,
      prompt: `${index === 0 ? 'Escute' : 'E agora'}: ${animals[animal][2]} Quem faz assim?`,
      show: `🔊 ${animals[animal][2]}`,
    })),
  };
}

/** Recycling bins, with the colors used in Brazil. */
const bins = {
  paper: ['papel', '🟦'],
  plastic: ['plástico', '🟥'],
  glass: ['vidro', '🟩'],
  metal: ['metal', '🟨'],
  food: ['comida', '🟫'],
} as const;

type Bin = keyof typeof bins;

const trash: readonly (readonly [string, string, Bin])[] = [
  ['a caixa', '📦', 'paper'],
  ['o jornal', '📰', 'paper'],
  ['a garrafa de plástico', '🧴', 'plastic'],
  ['o pote de vidro', '🫙', 'glass'],
  ['a lata', '🥫', 'metal'],
  ['a casca de banana', '🍌', 'food'],
  ['o miolo da maçã', '🍎', 'food'],
];

function sorting(id: string, items: readonly number[]): MissionVariant {
  return {
    id,
    introduction: 'Vamos separar o lixo! Cada coisa na sua cor.',
    steps: items.map((index, step) => {
      const [name, picture, bin] = trash[index] ?? trash[0] ?? ['a lata', '🥫', 'metal'];
      return {
        targetId: bin,
        prompt: `${step === 0 ? 'Onde' : 'E agora, onde'} jogamos ${name}?`,
        show: picture,
      };
    }),
  };
}

/** Clothes for the weather, as the child would pick them before going out. */
const clothes = {
  coat: ['casaco', '🧥'],
  shorts: ['bermuda', '🩳'],
  umbrella: ['guarda-chuva', '☂️'],
  scarf: ['cachecol', '🧣'],
  cap: ['boné', '🧢'],
  boots: ['botas', '🥾'],
  sandals: ['chinelo', '🩴'],
  sunglasses: ['óculos de sol', '🕶️'],
} as const;

type Clothing = keyof typeof clothes;

const weather: Readonly<Record<string, readonly [string, string, Clothing]>> = {
  cold: ['Está frio', '🥶 ❄️', 'coat'],
  rain: ['Está chovendo', '🌧️', 'umbrella'],
  hot: ['Está calor', '🥵 ☀️', 'shorts'],
  sunny: ['O sol está forte', '😎 ☀️', 'cap'],
  windy: ['Está ventando e frio', '🌬️', 'scarf'],
  beach: ['Vamos à praia', '🏖️', 'sandals'],
  puddle: ['Tem muita lama lá fora', '🌧️ 🟫', 'boots'],
};

function dressing(id: string, days: readonly string[]): MissionVariant {
  return {
    id,
    introduction: 'Vamos nos vestir! Olhe o tempo lá fora.',
    steps: days.map((day, index) => {
      const [sentence, picture, answer] = weather[day] ?? ['Está frio', '❄️', 'coat'];
      return {
        targetId: answer,
        prompt: `${index === 0 ? '' : 'E agora: '}${sentence}. O que vamos usar?`,
        show: picture,
      };
    }),
  };
}

/** Things to set the table with. */
const tableware = {
  plate: ['prato', '🍽️', 'o prato'],
  fork: ['garfo', '🍴', 'o garfo'],
  spoon: ['colher', '🥄', 'a colher'],
  glass: ['copo', '🥛', 'o copo'],
  cup: ['xícara', '☕', 'a xícara'],
  napkin: ['guardanapo', '🧻', 'o guardanapo'],
  bowl: ['tigela', '🥣', 'a tigela'],
} as const;

type Tableware = keyof typeof tableware;

function settingTable(id: string, meal: string, items: readonly Tableware[]): MissionVariant {
  return {
    id,
    title: `Pôr a mesa do ${meal}`,
    introduction: `Hora do ${meal}! Vamos pôr a mesa. Olhe a lista.`,
    steps: items.map((item, index) => ({
      targetId: item,
      prompt: `${index === 0 ? 'Pegue' : 'Agora, pegue'} ${tableware[item][2]}.`,
    })),
    farewell: 'A mesa está pronta! Bom apetite!',
  };
}

export const missions: readonly Mission[] = [
  {
    id: 'city-market',
    kind: 'pick-items',
    worldId: 'city',
    title: 'Compras no mercado',
    introduction: 'Vamos ao mercado! Olhe a lista.',
    choices: [
      ...Object.entries(groceries).map(([id, [label, pictogram]]) => ({ id, label, pictogram })),
      // At the cashier: count the coins to pay.
      ...Array.from({ length: MAX_PAY }, (_, index) => ({
        id: `pay-${index + 1}`,
        label: index === 0 ? '1 moeda' : `${index + 1} moedas`,
        pictogram: '🪙'.repeat(index + 1),
        group: 'cashier',
      })),
    ],
    steps: [
      { targetId: 'apple', prompt: 'Pegue a maçã.' },
      { targetId: 'milk', prompt: 'Agora, pegue o leite.' },
      { targetId: 'bread', prompt: 'Agora, pegue o pão.' },
      { targetId: 'pay-3', prompt: 'Vamos ao caixa. São 3 coisas: pague 3 moedas.' },
    ],
    variants: [
      recipe('cake', 'um bolo', '🎂', ['eggs', 'milk', 'flour', 'chocolate']),
      recipe('salad', 'uma salada', '🥗', ['lettuce', 'tomato', 'carrot']),
      recipe('sandwich', 'um sanduíche', '🥪', ['bread', 'cheese', 'tomato']),
      recipe('soup', 'uma sopa', '🍲', ['carrot', 'potato', 'onion']),
      recipe('smoothie', 'uma vitamina', '🥤', ['banana', 'milk', 'strawberry']),
      recipe('juice', 'um suco', '🧃', ['orange', 'apple']),
      recipe('lunch', 'arroz com feijão', '🍛', ['rice', 'beans', 'onion']),
      recipe('breakfast', 'o café da manhã', '☕', ['bread', 'butter', 'milk']),
      recipe('popcorn', 'pipoca', '🍿', ['corn', 'butter']),
    ],
    distractors: 3,
    reward: { coins: 10, stars: 1 },
    farewell: 'Obrigado! Volte sempre!',
  },
  {
    // AAC: the child builds the request with cards and the game says it aloud.
    id: 'city-bakery',
    kind: 'build-sentence',
    worldId: 'city',
    title: 'Pedir na padaria',
    introduction: 'Vamos pedir um lanche! Monte a frase.',
    choices: [
      { id: 'i-want', label: 'eu quero', pictogram: '🙋' },
      { id: 'bread', label: 'pão', pictogram: '🍞' },
      { id: 'cake', label: 'bolo', pictogram: '🍰' },
      { id: 'juice', label: 'suco', pictogram: '🧃' },
      { id: 'cheese-bread', label: 'pão de queijo', pictogram: '🧀' },
      { id: 'milk', label: 'leite', pictogram: '🥛' },
      { id: 'please', label: 'por favor', pictogram: '🙏' },
    ],
    steps: [
      { targetId: 'i-want', prompt: 'Toque em: eu quero.' },
      { targetId: 'bread', prompt: 'Agora, toque no pão.' },
    ],
    variants: [
      snack('bread', 'bread', 'pão', '🍞'),
      snack('cake', 'cake', 'bolo', '🍰'),
      snack('juice', 'juice', 'suco', '🧃'),
      snack('cheese-bread', 'cheese-bread', 'pão de queijo', '🧀'),
    ],
    distractors: 2,
    reward: { coins: 10, stars: 1 },
    farewell: 'Aqui está! Obrigado!',
  },
  {
    id: 'city-bus',
    kind: 'sequence',
    worldId: 'city',
    title: 'Andar de ônibus',
    introduction: 'Vamos pegar o ônibus!',
    choices: [
      { id: 'wait', label: 'esperar no ponto', pictogram: '🧍' },
      { id: 'board', label: 'entrar no ônibus', pictogram: '🚌' },
      { id: 'card', label: 'passar o cartão', pictogram: '💳' },
      { id: 'sit', label: 'sentar', pictogram: '💺' },
      { id: 'stop-button', label: 'apertar o botão', pictogram: '🔔' },
    ],
    steps: [
      { targetId: 'wait', prompt: 'Primeiro, esperamos no ponto.' },
      { targetId: 'board', prompt: 'O ônibus chegou. Agora?' },
      { targetId: 'sit', prompt: 'Entramos. E depois?' },
      { targetId: 'stop-button', prompt: 'Chegando. O que fazemos?' },
    ],
    variants: [
      {
        id: 'short',
        introduction: 'Vamos pegar o ônibus!',
        steps: [
          { targetId: 'wait', prompt: 'O que vem primeiro?' },
          { targetId: 'board', prompt: 'O ônibus chegou. Agora?' },
          { targetId: 'sit', prompt: 'Entramos. E depois?' },
          { targetId: 'stop-button', prompt: 'Chegando. O que fazemos?' },
        ],
      },
      {
        id: 'with-card',
        introduction: 'Vamos de ônibus, com o cartão!',
        steps: [
          { targetId: 'wait', prompt: 'O que vem primeiro?' },
          { targetId: 'board', prompt: 'O ônibus chegou. Agora?' },
          { targetId: 'card', prompt: 'Entramos. O que fazemos com o cartão?' },
          { targetId: 'sit', prompt: 'Pronto! E agora?' },
          { targetId: 'stop-button', prompt: 'Chegando. O que fazemos?' },
        ],
      },
    ],
    distractors: 0,
    reward: { coins: 10, stars: 1 },
  },
  {
    // Played in the 3D street: the game reports what the child does.
    id: 'city-crosswalk',
    kind: 'world-task',
    worldId: 'city',
    title: 'Atravessar a rua',
    introduction: 'Vamos atravessar na faixa.',
    choices: [
      { id: 'wait-green', label: 'esperar o boneco verde', pictogram: '🟢' },
      { id: 'cross', label: 'atravessar', pictogram: '🚶' },
    ],
    steps: [
      { targetId: 'wait-green', prompt: 'Fique na calçada e espere o boneco verde.' },
      { targetId: 'cross', prompt: 'Verde! Pode atravessar na faixa.' },
    ],
    reward: { coins: 10, stars: 1 },
  },
  {
    id: 'nature-animals',
    kind: 'quiz',
    worldId: 'nature',
    title: 'Sons da fazenda',
    introduction: 'Vamos ouvir os animais da fazenda!',
    choices: Object.entries(animals).map(([id, [label, pictogram]]) => ({ id, label, pictogram })),
    steps: animalQuiz('first', ['cow', 'pig', 'sheep']).steps,
    variants: [
      animalQuiz('a', ['cow', 'pig', 'sheep']),
      animalQuiz('b', ['horse', 'chick', 'cow']),
      animalQuiz('c', ['dog', 'duck', 'pig']),
      animalQuiz('d', ['sheep', 'cat', 'horse']),
      animalQuiz('e', ['chick', 'cow', 'duck']),
      animalQuiz('f', ['cat', 'dog', 'sheep']),
    ],
    distractors: 2,
    reward: { coins: 10, stars: 1 },
    farewell: 'Os animais adoraram sua visita!',
  },
  {
    id: 'nature-garden',
    kind: 'sequence',
    worldId: 'nature',
    title: 'Plantar uma flor',
    introduction: 'Vamos plantar uma flor!',
    choices: [
      { id: 'dig', label: 'cavar um buraco', pictogram: '🕳️' },
      { id: 'seed', label: 'pôr a semente', pictogram: '🌱' },
      { id: 'cover', label: 'cobrir com terra', pictogram: '🤲' },
      { id: 'water', label: 'regar', pictogram: '💧' },
      { id: 'sun', label: 'esperar o sol', pictogram: '☀️' },
    ],
    steps: [
      { targetId: 'dig', prompt: 'O que vem primeiro?' },
      { targetId: 'seed', prompt: 'O buraco está pronto. E agora?' },
      { targetId: 'cover', prompt: 'A semente está no buraco. E agora?' },
      { targetId: 'water', prompt: 'A plantinha tem sede. E agora?' },
      { targetId: 'sun', prompt: 'Para crescer, ela precisa de luz. E agora?' },
    ],
    reward: { coins: 10, stars: 1 },
    farewell: 'Olha a flor que nasceu!',
    result: '🌻',
  },
  {
    id: 'nature-recycling',
    kind: 'quiz',
    worldId: 'nature',
    title: 'Separar o lixo',
    introduction: 'Vamos separar o lixo! Cada coisa na sua cor.',
    choices: Object.entries(bins).map(([id, [label, pictogram]]) => ({ id, label, pictogram })),
    steps: sorting('first', [0, 2, 4]).steps,
    variants: [
      sorting('a', [0, 2, 4]),
      sorting('b', [1, 3, 5]),
      sorting('c', [2, 4, 6]),
      sorting('d', [3, 5, 0]),
      sorting('e', [6, 1, 2]),
    ],
    reward: { coins: 10, stars: 1 },
    farewell: 'A natureza agradece!',
    result: '♻️',
  },
  {
    id: 'home-hygiene',
    kind: 'sequence',
    worldId: 'home',
    title: 'Cuidar de mim',
    introduction: 'Vamos escovar os dentes!',
    choices: [
      { id: 'brush', label: 'pegar a escova', pictogram: '🪥' },
      { id: 'paste', label: 'pôr a pasta', pictogram: '🧴' },
      { id: 'scrub', label: 'escovar os dentes', pictogram: '🦷' },
      { id: 'rinse', label: 'enxaguar a boca', pictogram: '🚰' },
      { id: 'wet', label: 'molhar as mãos', pictogram: '💧' },
      { id: 'soap', label: 'pôr sabonete', pictogram: '🧼' },
      { id: 'rub', label: 'esfregar as mãos', pictogram: '👐' },
      { id: 'dry', label: 'secar na toalha', pictogram: '🧻' },
    ],
    steps: [
      { targetId: 'brush', prompt: 'O que vem primeiro?' },
      { targetId: 'paste', prompt: 'Com a escova na mão. E agora?' },
      { targetId: 'scrub', prompt: 'A pasta está na escova. E agora?' },
      { targetId: 'rinse', prompt: 'Dentes limpinhos! Para terminar?' },
    ],
    variants: [
      {
        id: 'teeth',
        title: 'Escovar os dentes',
        introduction: 'Vamos escovar os dentes!',
        steps: [
          { targetId: 'brush', prompt: 'O que vem primeiro?' },
          { targetId: 'paste', prompt: 'Com a escova na mão. E agora?' },
          { targetId: 'scrub', prompt: 'A pasta está na escova. E agora?' },
          { targetId: 'rinse', prompt: 'Dentes limpinhos! Para terminar?' },
        ],
        farewell: 'Que sorriso bonito!',
        result: '😁',
      },
      {
        id: 'hands',
        title: 'Lavar as mãos',
        introduction: 'Vamos lavar as mãos!',
        steps: [
          { targetId: 'wet', prompt: 'O que vem primeiro?' },
          { targetId: 'soap', prompt: 'As mãos estão molhadas. E agora?' },
          { targetId: 'rub', prompt: 'Tem sabonete. E agora?' },
          { targetId: 'rinse', prompt: 'Muita espuma! E agora?' },
          { targetId: 'dry', prompt: 'Sem sabão. Para terminar?' },
        ],
        farewell: 'Mãos limpinhas!',
        result: '🙌',
      },
    ],
    distractors: 0,
    reward: { coins: 10, stars: 1 },
  },
  {
    id: 'home-dressing',
    kind: 'quiz',
    worldId: 'home',
    title: 'Roupa para o tempo',
    introduction: 'Vamos nos vestir! Olhe o tempo lá fora.',
    choices: Object.entries(clothes).map(([id, [label, pictogram]]) => ({ id, label, pictogram })),
    steps: dressing('first', ['cold', 'rain', 'hot']).steps,
    variants: [
      dressing('a', ['cold', 'rain', 'hot']),
      dressing('b', ['sunny', 'windy', 'rain']),
      dressing('c', ['beach', 'cold', 'puddle']),
      dressing('d', ['hot', 'puddle', 'windy']),
      dressing('e', ['rain', 'beach', 'sunny']),
    ],
    distractors: 2,
    reward: { coins: 10, stars: 1 },
    farewell: 'Pronto para sair!',
    result: '👕',
  },
  {
    id: 'home-table',
    kind: 'pick-items',
    worldId: 'home',
    title: 'Pôr a mesa',
    introduction: 'Vamos pôr a mesa! Olhe a lista.',
    choices: Object.entries(tableware).map(([id, [label, pictogram]]) => ({
      id,
      label,
      pictogram,
    })),
    steps: settingTable('first', 'almoço', ['plate', 'fork', 'glass']).steps,
    variants: [
      settingTable('lunch', 'almoço', ['plate', 'fork', 'glass', 'napkin']),
      settingTable('breakfast', 'café da manhã', ['cup', 'spoon', 'napkin']),
      settingTable('soup', 'jantar', ['bowl', 'spoon', 'glass']),
    ],
    distractors: 2,
    reward: { coins: 10, stars: 1 },
    result: '🍽️',
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
