import {
  askFact,
  matchPairs,
  orderSteps,
  sortIntoGroups,
  type Fact,
  type Pairing,
  type Sequence,
  type Sorting,
} from '@domain/activity/knowledge-generators';
import { skill, type SkillDefinition } from '@domain/curriculum/skill';

const track = 'knowledge';
const station = 'world';
const games = ['explorer'] as const;

const body: readonly Fact[] = [
  {
    question: 'Com o que a gente vê?',
    answer: { name: 'olhos', pictogram: '👀' },
    wrong: [
      { name: 'orelha', pictogram: '👂' },
      { name: 'pé', pictogram: '🦶' },
    ],
    teach: 'A gente vê com os olhos.',
  },
  {
    question: 'Com o que a gente ouve?',
    answer: { name: 'orelha', pictogram: '👂' },
    wrong: [
      { name: 'nariz', pictogram: '👃' },
      { name: 'mão', pictogram: '✋' },
    ],
    teach: 'A gente ouve com as orelhas.',
  },
  {
    question: 'Com o que a gente sente o cheiro?',
    answer: { name: 'nariz', pictogram: '👃' },
    wrong: [
      { name: 'olhos', pictogram: '👀' },
      { name: 'pé', pictogram: '🦶' },
    ],
    teach: 'A gente sente o cheiro com o nariz.',
  },
  {
    question: 'Com o que a gente anda?',
    answer: { name: 'pé', pictogram: '🦶' },
    wrong: [
      { name: 'nariz', pictogram: '👃' },
      { name: 'orelha', pictogram: '👂' },
    ],
    teach: 'A gente anda com os pés.',
  },
  {
    question: 'Com o que a gente mastiga?',
    answer: { name: 'dente', pictogram: '🦷' },
    wrong: [
      { name: 'mão', pictogram: '✋' },
      { name: 'olhos', pictogram: '👀' },
    ],
    teach: 'A gente mastiga com os dentes.',
  },
];

const animals: readonly Sorting[] = [
  {
    prompt: 'Quem vive na água? Quem vive na terra?',
    groups: [
      {
        group: { name: 'água', pictogram: '🌊' },
        members: [
          { name: 'peixe', pictogram: '🐟' },
          { name: 'baleia', pictogram: '🐋' },
          { name: 'polvo', pictogram: '🐙' },
          { name: 'tubarão', pictogram: '🦈' },
        ],
      },
      {
        group: { name: 'terra', pictogram: '🌳' },
        members: [
          { name: 'cachorro', pictogram: '🐶' },
          { name: 'vaca', pictogram: '🐮' },
          { name: 'leão', pictogram: '🦁' },
          { name: 'elefante', pictogram: '🐘' },
        ],
      },
    ],
    teach: 'Peixes vivem na água. Cachorros vivem na terra.',
  },
  {
    prompt: 'Quem voa? Quem anda?',
    groups: [
      {
        group: { name: 'voa', pictogram: '☁️' },
        members: [
          { name: 'pássaro', pictogram: '🐦' },
          { name: 'borboleta', pictogram: '🦋' },
          { name: 'abelha', pictogram: '🐝' },
          { name: 'coruja', pictogram: '🦉' },
        ],
      },
      {
        group: { name: 'anda', pictogram: '🌳' },
        members: [
          { name: 'gato', pictogram: '🐱' },
          { name: 'cavalo', pictogram: '🐴' },
          { name: 'tartaruga', pictogram: '🐢' },
          { name: 'porco', pictogram: '🐷' },
        ],
      },
    ],
    teach: 'Pássaros voam. Gatos andam.',
  },
];

const animalGifts: readonly Pairing[] = [
  {
    prompt: 'O que cada animal dá? Ligue.',
    pairs: [
      [
        { name: 'vaca', pictogram: '🐮' },
        { name: 'leite', pictogram: '🥛' },
      ],
      [
        { name: 'galinha', pictogram: '🐔' },
        { name: 'ovo', pictogram: '🥚' },
      ],
      [
        { name: 'abelha', pictogram: '🐝' },
        { name: 'mel', pictogram: '🍯' },
      ],
      [
        { name: 'ovelha', pictogram: '🐑' },
        { name: 'lã', pictogram: '🧶' },
      ],
    ],
    teach: 'A vaca dá leite, a galinha dá ovo e a abelha faz mel.',
  },
];

const plants: readonly Sequence[] = [
  {
    prompt: 'Como a planta cresce? Coloque em ordem.',
    steps: [
      { name: 'semente', pictogram: '🌰' },
      { name: 'broto', pictogram: '🌱' },
      { name: 'planta', pictogram: '🌿' },
      { name: 'flor', pictogram: '🌻' },
    ],
    teach: 'Primeiro a semente, depois o broto, a planta e a flor.',
  },
  {
    prompt: 'Como nasce a borboleta? Coloque em ordem.',
    steps: [
      { name: 'ovo', pictogram: '🥚' },
      { name: 'lagarta', pictogram: '🐛' },
      { name: 'borboleta', pictogram: '🦋' },
    ],
    teach: 'Primeiro o ovo, depois a lagarta e a borboleta.',
  },
  {
    prompt: 'Como cresce a galinha? Coloque em ordem.',
    steps: [
      { name: 'ovo', pictogram: '🥚' },
      { name: 'pintinho', pictogram: '🐥' },
      { name: 'galinha', pictogram: '🐔' },
    ],
    teach: 'Primeiro o ovo, depois o pintinho e a galinha.',
  },
];

const plantFacts: readonly Fact[] = [
  {
    question: 'Do que a planta precisa para crescer?',
    answer: { name: 'água', pictogram: '💧' },
    wrong: [
      { name: 'bola', pictogram: '⚽' },
      { name: 'carro', pictogram: '🚗' },
    ],
    teach: 'A planta precisa de água e de sol.',
  },
  {
    question: 'Onde nasce a maçã?',
    answer: { name: 'árvore', pictogram: '🌳' },
    wrong: [
      { name: 'carro', pictogram: '🚗' },
      { name: 'peixe', pictogram: '🐟' },
    ],
    teach: 'A maçã nasce na árvore.',
  },
  {
    question: 'Qual parte da planta fica embaixo da terra?',
    answer: { name: 'raiz', word: true },
    wrong: [
      { name: 'flor', word: true },
      { name: 'folha', word: true },
    ],
    teach: 'A raiz fica embaixo da terra.',
  },
  {
    question: 'O que nasce depois da flor?',
    answer: { name: 'fruta', pictogram: '🍎' },
    wrong: [
      { name: 'pedra', pictogram: '🪨' },
      { name: 'carro', pictogram: '🚗' },
    ],
    teach: 'Depois da flor nasce a fruta.',
  },
];

const weather: readonly Pairing[] = [
  {
    prompt: 'O que usar em cada tempo? Ligue.',
    pairs: [
      [
        { name: 'chuva', pictogram: '🌧️' },
        { name: 'guarda-chuva', pictogram: '☂️' },
      ],
      [
        { name: 'sol', pictogram: '☀️' },
        { name: 'chapéu', pictogram: '👒' },
      ],
      [
        { name: 'frio', pictogram: '❄️' },
        { name: 'casaco', pictogram: '🧥' },
      ],
      [
        { name: 'noite', pictogram: '🌙' },
        { name: 'pijama', pictogram: '🛏️' },
      ],
      [
        { name: 'praia', pictogram: '🏖️' },
        { name: 'maiô', pictogram: '🩱' },
      ],
    ],
    teach: 'Cada tempo pede uma roupa diferente.',
  },
];

const jobs: readonly Pairing[] = [
  {
    prompt: 'O que cada pessoa usa no trabalho? Ligue.',
    pairs: [
      [
        { name: 'médica', pictogram: '🧑‍⚕️' },
        { name: 'estetoscópio', pictogram: '🩺' },
      ],
      [
        { name: 'cozinheiro', pictogram: '🧑‍🍳' },
        { name: 'panela', pictogram: '🍳' },
      ],
      [
        { name: 'bombeira', pictogram: '🧑‍🚒' },
        { name: 'caminhão', pictogram: '🚒' },
      ],
      [
        { name: 'professor', pictogram: '🧑‍🏫' },
        { name: 'livro', pictogram: '📚' },
      ],
      [
        { name: 'agricultora', pictogram: '🧑‍🌾' },
        { name: 'broto', pictogram: '🌱' },
      ],
    ],
    teach: 'Cada trabalho tem as suas ferramentas.',
  },
];

const brazil: readonly Fact[] = [
  {
    question: 'Qual destas cores tem na bandeira do Brasil?',
    answer: { name: 'verde', pictogram: '🟢' },
    wrong: [
      { name: 'roxo', pictogram: '🟣' },
      { name: 'vermelho', pictogram: '🔴' },
    ],
    teach: 'A bandeira do Brasil tem verde, amarelo, azul e branco.',
  },
  {
    question: 'Qual é a capital do Brasil?',
    answer: { name: 'Brasília', word: true },
    wrong: [
      { name: 'Paris', word: true },
      { name: 'Lisboa', word: true },
    ],
    teach: 'A capital do Brasil é Brasília.',
  },
  {
    question: 'Qual destes bichos vive nas matas do Brasil?',
    answer: { name: 'arara', pictogram: '🦜' },
    wrong: [
      { name: 'pinguim', pictogram: '🐧' },
      { name: 'camelo', pictogram: '🐫' },
    ],
    teach: 'A arara vive nas matas do Brasil.',
  },
  {
    question: 'O que tem no litoral do Brasil?',
    answer: { name: 'praia', pictogram: '🏖️' },
    wrong: [
      { name: 'neve', pictogram: '❄️' },
      { name: 'deserto', pictogram: '🏜️' },
    ],
    teach: 'O Brasil tem muitas praias.',
  },
];

const care: readonly Fact[] = [
  {
    question: 'O que a gente usa para lavar as mãos?',
    answer: { name: 'sabonete', pictogram: '🧼' },
    wrong: [
      { name: 'lápis', pictogram: '✏️' },
      { name: 'bola', pictogram: '⚽' },
    ],
    teach: 'A gente lava as mãos com água e sabonete.',
  },
  {
    question: 'O que a gente usa para escovar os dentes?',
    answer: { name: 'escova', pictogram: '🪥' },
    wrong: [
      { name: 'garfo', pictogram: '🍴' },
      { name: 'livro', pictogram: '📚' },
    ],
    teach: 'A gente escova os dentes com escova e pasta.',
  },
  {
    question: 'Machucou. Quem pode ajudar?',
    answer: { name: 'um adulto', pictogram: '🧑' },
    wrong: [
      { name: 'o gato', pictogram: '🐱' },
      { name: 'a bola', pictogram: '⚽' },
    ],
    teach: 'Quando machucar, conte para um adulto.',
  },
];

const washing: readonly Sequence[] = [
  {
    prompt: 'Como lavar as mãos? Coloque em ordem.',
    steps: [
      { name: 'molhar', pictogram: '💧' },
      { name: 'sabonete', pictogram: '🧼' },
      { name: 'esfregar', pictogram: '👐' },
      { name: 'secar', pictogram: '🧻' },
    ],
    teach: 'Molhar, passar sabonete, esfregar e secar.',
  },
  {
    prompt: 'Como escovar os dentes? Coloque em ordem.',
    steps: [
      { name: 'pasta', pictogram: '🧴' },
      { name: 'escovar', pictogram: '🪥' },
      { name: 'enxaguar', pictogram: '💧' },
    ],
    teach: 'Pôr a pasta, escovar e enxaguar.',
  },
  {
    prompt: 'Como plantar? Coloque em ordem.',
    steps: [
      { name: 'semente', pictogram: '🌰' },
      { name: 'terra', pictogram: '🪴' },
      { name: 'regar', pictogram: '💧' },
    ],
    teach: 'Pegar a semente, pôr na terra e regar.',
  },
];

/** Trail C1: what a child sees around them. A proposal, to be reviewed before reaching children. */
export const knowledge: readonly SkillDefinition[] = [
  skill('know.body', {
    name: 'O corpo',
    track,
    station,
    level: 1,
    interaction: 'tap',
    games,
    activity: askFact({ facts: body }),
  }),
  skill('know.animals.sort', {
    name: 'Onde os bichos vivem',
    track,
    station,
    level: 1,
    interaction: 'sort',
    games,
    activity: sortIntoGroups({ sortings: animals, each: 2 }),
  }),
  skill('know.care', {
    name: 'Cuidar de si',
    requires: ['know.body'],
    track,
    station,
    level: 1,
    interaction: 'tap',
    games,
    activity: askFact({ facts: care }),
  }),
  skill('know.weather', {
    name: 'O tempo',
    requires: ['know.body'],
    track,
    station,
    level: 2,
    interaction: 'match',
    games,
    activity: matchPairs({ pairings: weather, count: 3 }),
  }),
  skill('know.plants', {
    name: 'As plantas',
    requires: ['know.animals.sort'],
    track,
    station,
    level: 2,
    interaction: 'order',
    games,
    activity: orderSteps({ sequences: plants }),
  }),
  skill('know.plants.facts', {
    name: 'Do que a planta precisa',
    requires: ['know.plants'],
    track,
    station,
    level: 2,
    interaction: 'tap',
    games,
    activity: askFact({ facts: plantFacts }),
  }),
  skill('know.animals.gifts', {
    name: 'O que os bichos dão',
    requires: ['know.animals.sort'],
    track,
    station,
    level: 3,
    interaction: 'match',
    games,
    activity: matchPairs({ pairings: animalGifts, count: 3 }),
  }),
  skill('know.jobs', {
    name: 'As profissões',
    requires: ['know.weather'],
    track,
    station,
    level: 3,
    interaction: 'match',
    games,
    activity: matchPairs({ pairings: jobs, count: 3 }),
  }),
  skill('know.brazil', {
    name: 'O Brasil',
    requires: ['know.plants'],
    track,
    station,
    level: 3,
    interaction: 'tap',
    games,
    activity: askFact({ facts: brazil }),
  }),
  skill('know.steps', {
    name: 'Passo a passo',
    requires: ['know.care'],
    track,
    station,
    level: 3,
    interaction: 'order',
    games,
    activity: orderSteps({ sequences: washing }),
  }),
];
