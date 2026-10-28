import { beforeEach, describe, expect, it } from 'vitest';
import { AnswerChallenge, challengePhrases } from '@application/use-cases/answer-challenge';
import { GetAlbum } from '@application/use-cases/get-album';
import { StartChallenge } from '@application/use-cases/start-challenge';
import type { ChallengeSession } from '@domain/learning/challenge-session';
import { PlayerProgress } from '@domain/progress/player-progress';
import { seededRandom } from '@domain/shared/random';
import { stickerId } from '@domain/stickers/sticker';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';
import { content, FakeSpeech } from '../support/fixtures';

describe('learning station use cases', () => {
  let speech: FakeSpeech;
  let progress: InMemoryProgressRepository;
  let start: StartChallenge;
  let answer: AnswerChallenge;

  beforeEach(() => {
    speech = new FakeSpeech();
    progress = new InMemoryProgressRepository();
    const catalog = new StaticContentCatalog(content);
    const random = seededRandom(21);
    start = new StartChallenge(catalog, progress, speech, random);
    answer = new AnswerChallenge(catalog, progress, speech, random);
  });

  const right = (session: ChallengeSession) => answer.execute(session, session.challenge.answerId);

  it('starts at the saved level and asks the question aloud', async () => {
    await progress.save(
      PlayerProgress.fromSnapshot({
        ...PlayerProgress.createNew().toSnapshot(),
        skillLevels: { numbers: 2 },
      }),
    );
    const session = await start.execute('numbers');
    expect(session.level).toBe(2);
    expect(speech.spoken).toEqual([session.challenge.question]);
  });

  it('gives a coin per right answer, and a sticker and a star the first time', async () => {
    const session = await start.execute('letters');
    const first = await right(session);
    expect(first.reward).toEqual({ coins: 1, stars: 1 });
    expect(first.sticker?.id).toBe(stickerId('letters', 1));
    expect(speech.spoken.at(-1)).toContain(challengePhrases.sticker);

    const second = await right(first.session);
    expect(second.reward).toEqual({ coins: 1, stars: 0 });
    expect(second.sticker).toBeUndefined();

    const saved = await progress.load();
    expect(saved.coins.amount).toBe(2);
    expect(saved.stars).toBe(1);
    expect(saved.letters.length).toBeGreaterThan(0);
  });

  it('saves a new level with its sticker and star', async () => {
    let session = await start.execute('coins');
    for (let i = 0; i < 2; i += 1) session = (await right(session)).session;
    const levelUp = await right(session);
    expect(levelUp.outcome).toMatchObject({ reachedLevel: 2 });
    expect(levelUp.sticker?.id).toBe(stickerId('coins', 2));
    expect(speech.spoken.at(-1)).toContain(challengePhrases.levelUp);
    const saved = await progress.load();
    expect(saved.levelOf('coins')).toBe(2);
    expect(saved.stars).toBe(2);
  });

  it('only hints on a wrong card, without saving anything', async () => {
    const session = await start.execute('numbers');
    const wrongId = session.challenge.options.find((o) => o.id !== session.challenge.answerId)?.id;
    const result = await answer.execute(session, wrongId ?? '');
    expect(result.outcome).toEqual({ kind: 'hint', hintLevel: 1 });
    expect(result.reward).toEqual({ coins: 0, stars: 0 });
    expect(speech.spoken.at(-1)).toBe(`${challengePhrases.hint} ${session.challenge.question}`);
    expect((await progress.load()).coins.amount).toBe(0);
  });

  it('shows earned stickers and letters in the album', async () => {
    const session = await start.execute('letters');
    await right(session);
    const album = await new GetAlbum(progress).execute();
    expect(album.stickers.find((s) => s.id === stickerId('letters', 1))?.earned).toBe(true);
    expect(album.stickers.filter((s) => s.earned)).toHaveLength(1);
    expect(album.letters.filter((l) => l.earned)).toHaveLength(1);
    expect(album.letters).toHaveLength(26);
  });
});
