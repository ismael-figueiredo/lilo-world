/**
 * The recording script: every fixed sentence of the game, with its id and where
 * it is used. Run with `pnpm voice:script`; it writes docs/roteiro-gravacao.csv.
 * Sentences with something that changes get a marker like {1}: those are
 * recorded in parts, or stay with the synthetic voice.
 */
import { writeFileSync } from 'node:fs';
import { outfitTips, phrases, stepTips, weatherTips } from '../src/application/phrases.ts';

type Phrase = string | ((...values: string[]) => string);

const quoted = (text: string): string => `"${text.replaceAll('"', '""')}"`;

const lines = (group: string, entries: Readonly<Record<string, Phrase>>): string[] =>
  Object.entries(entries).map(([id, phrase]) => {
    const text = typeof phrase === 'string' ? phrase : phrase('{1}', '{2}');
    const kind = typeof phrase === 'string' ? 'fixa' : 'com parte variável';
    return [`${group}.${id}`, group, kind, quoted(text)].join(',');
  });

const rows = [
  'id,grupo,tipo,texto',
  ...lines('frases', phrases),
  ...lines('dia', stepTips),
  ...lines('tempo', weatherTips),
  ...lines('roupa', outfitTips),
];

writeFileSync('docs/roteiro-gravacao.csv', `${rows.join('\n')}\n`);
console.log(`${rows.length - 1} frases em docs/roteiro-gravacao.csv`);
