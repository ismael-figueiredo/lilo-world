/** Short stories for bed: nothing scary, always the same calm ending. */
export interface Story {
  readonly title: string;
  readonly icon: string;
  readonly lines: readonly string[];
}

export const stories: readonly Story[] = [
  {
    title: 'A estrela pequena',
    icon: '⭐',
    lines: [
      'Era uma vez uma estrela bem pequena.',
      'Ela brilhava devagar, lá no alto.',
      'A lua disse: você também ilumina a noite.',
      'A estrela sorriu e ficou quietinha no céu.',
    ],
  },
  {
    title: 'O barquinho',
    icon: '⛵',
    lines: [
      'Um barquinho navegava em um lago calmo.',
      'A água balançava devagar, para lá e para cá.',
      'Quando a noite chegou, ele parou na margem.',
      'E o barquinho descansou até de manhã.',
    ],
  },
  {
    title: 'O ursinho e a manta',
    icon: '🧸',
    lines: [
      'Um ursinho procurava a sua manta.',
      'Olhou na cadeira, olhou na mesa.',
      'A manta estava bem na cama dele.',
      'O ursinho se cobriu e fechou os olhos.',
    ],
  },
  {
    title: 'A chuva boa',
    icon: '🌧️',
    lines: [
      'A chuva caiu mansinha no jardim.',
      'As plantas beberam, gota por gota.',
      'Depois a chuva foi embora, sem pressa.',
      'E o jardim dormiu, todo molhado e feliz.',
    ],
  },
];

/** The same day always has the same story: repeating it is part of the comfort. */
export function storyOfDay(dayNumber: number): Story {
  const story = stories[(dayNumber - 1) % stories.length];
  if (story === undefined) throw new Error('No stories');
  return story;
}
