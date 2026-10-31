import type { Random } from '@domain/shared/random';

/** The feelings taught here. A face, a word and something that helps, never a score. */
export type Feeling = 'happy' | 'sad' | 'angry' | 'scared' | 'surprised';

export const feelingNames: Readonly<Record<Feeling, string>> = {
  happy: 'Feliz',
  sad: 'Triste',
  angry: 'Com raiva',
  scared: 'Com medo',
  surprised: 'Surpreso',
};

export type HelpId = 'help' | 'adult' | 'space' | 'join';

/** Something the child can do, and how the friend feels afterwards. */
export interface Help {
  readonly id: HelpId;
  readonly icon: string;
  readonly label: string;
  /** What is seen and said after choosing it: the result, never a judgement. */
  readonly result: string;
  readonly after: Feeling | 'calm';
}

/** A short scene. Order of teaching: see it, notice body and face, name it, what helps. */
export interface FeelingScene {
  readonly id: string;
  /** A thing that appears in the scene. */
  readonly prop: string;
  /** What happens, in one short sentence. */
  readonly happens: string;
  readonly feeling: Feeling;
  /** What the body shows, seen before any word for the feeling. */
  readonly body: string;
  /** The other face offered. Always clearly different. */
  readonly other: Feeling;
  readonly helps: readonly Help[];
}

const giveTime: Help = {
  id: 'space',
  icon: '🤫',
  label: 'Dar um tempo',
  result: 'Você ficou por perto, sem falar. Seu colega foi se acalmando.',
  after: 'calm',
};

const callAdult: Help = {
  id: 'adult',
  icon: '🧑',
  label: 'Chamar um adulto',
  result: 'O adulto veio ajudar. Seu colega ficou mais tranquilo.',
  after: 'calm',
};

const offer = (result: string, after: Feeling | 'calm' = 'happy'): Help => ({
  id: 'help',
  icon: '🤝',
  label: 'Oferecer ajuda',
  result,
  after,
});

const join = (result: string): Help => ({
  id: 'join',
  icon: '🎉',
  label: 'Brincar junto',
  result,
  after: 'happy',
});

/** A proposal, in docs/roteiro-sentimentos.md, waiting for a speech therapist's review. */
export const feelingScenes: readonly FeelingScene[] = [
  {
    id: 'ice-cream',
    prop: '🍦',
    happens: 'O sorvete do seu colega caiu no chão.',
    feeling: 'sad',
    body: 'Olhe: os ombros caíram e a boca virou para baixo.',
    other: 'happy',
    helps: [offer('Vocês dividiram um lanche. Seu colega sorriu.'), giveTime, callAdult],
  },
  {
    id: 'lent-toy',
    prop: '🧸',
    happens: 'Pegaram o brinquedo do seu colega sem pedir.',
    feeling: 'angry',
    body: 'Olhe: as sobrancelhas desceram e o corpo ficou duro.',
    other: 'happy',
    helps: [giveTime, callAdult, offer('Vocês pediram o brinquedo de volta juntos.', 'calm')],
  },
  {
    id: 'goal',
    prop: '⚽',
    happens: 'Seu colega fez um gol!',
    feeling: 'happy',
    body: 'Olhe: a boca abriu num sorriso e os braços subiram.',
    other: 'sad',
    helps: [join('Vocês comemoraram juntos.'), giveTime],
  },
  {
    id: 'thunder',
    prop: '⛈️',
    happens: 'Fez um barulho alto de trovão.',
    feeling: 'scared',
    body: 'Olhe: os olhos abriram bem e o corpo se encolheu.',
    other: 'happy',
    helps: [callAdult, offer('Você ficou ao lado. Passou mais rápido.', 'calm'), giveTime],
  },
  {
    id: 'alone',
    prop: '🪑',
    happens: 'Seu colega está sozinho no recreio.',
    feeling: 'sad',
    body: 'Olhe: a cabeça baixou e ele ficou parado.',
    other: 'surprised',
    helps: [join('Vocês foram brincar. Seu colega sorriu.'), giveTime],
  },
  {
    id: 'gift',
    prop: '🎁',
    happens: 'Seu colega abriu um presente que não esperava.',
    feeling: 'surprised',
    body: 'Olhe: as sobrancelhas subiram e a boca abriu.',
    other: 'angry',
    helps: [join('Vocês olharam o presente juntos.')],
  },
  {
    id: 'broken-tower',
    prop: '🧱',
    happens: 'A torre que seu colega fez caiu.',
    feeling: 'sad',
    body: 'Olhe: a boca virou para baixo e ele olhou para o chão.',
    other: 'happy',
    helps: [offer('Vocês montaram de novo, juntos.'), giveTime],
  },
  {
    id: 'cut-in-line',
    prop: '🧍',
    happens: 'Alguém passou na frente da fila.',
    feeling: 'angry',
    body: 'Olhe: a testa franziu e as mãos fecharam.',
    other: 'surprised',
    helps: [callAdult, giveTime],
  },
  {
    id: 'drawing',
    prop: '🖍️',
    happens: 'A professora elogiou o desenho do seu colega.',
    feeling: 'happy',
    body: 'Olhe: o rosto abriu num sorriso.',
    other: 'scared',
    helps: [join('Vocês foram desenhar juntos.')],
  },
  {
    id: 'big-dog',
    prop: '🐕',
    happens: 'Um cachorro grande chegou correndo.',
    feeling: 'scared',
    body: 'Olhe: ele deu um passo para trás e os olhos abriram.',
    other: 'happy',
    helps: [callAdult, offer('Vocês foram para perto de um adulto juntos.', 'calm')],
  },
  {
    id: 'lost-pencil',
    prop: '✏️',
    happens: 'Seu colega perdeu o lápis preferido.',
    feeling: 'sad',
    body: 'Olhe: ele procura com o rosto caído.',
    other: 'surprised',
    helps: [offer('Vocês procuraram juntos e acharam.'), callAdult],
  },
  {
    id: 'balloon-pop',
    prop: '🎈',
    happens: 'Um balão estourou de repente.',
    feeling: 'surprised',
    body: 'Olhe: ele levou um susto e os olhos abriram.',
    other: 'sad',
    helps: [giveTime, offer('Você perguntou se estava tudo bem.', 'calm')],
  },
];

/** A scene not seen lately. The same day always has the same one, so a replay can be planned. */
export function sceneOfDay(dayNumber: number, scenes: readonly FeelingScene[]): FeelingScene {
  const scene = scenes[(dayNumber - 1) % scenes.length];
  if (scene === undefined) throw new Error('No scenes');
  return scene;
}

/** The two faces to compare, in an order that does not tell which is right. */
export function namingChoices(scene: FeelingScene, random: Random): readonly [Feeling, Feeling] {
  return random() < 0.5 ? [scene.feeling, scene.other] : [scene.other, scene.feeling];
}
