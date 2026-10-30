import { beforeEach, describe, expect, it } from 'vitest';
import { phrases } from '@application/phrases';
import { AnswerActivity } from '@application/use-cases/answer-activity';
import { GetAlbum } from '@application/use-cases/get-album';
import { StartActivity } from '@application/use-cases/start-activity';
import { answerOf } from '@domain/activity/activity';
import { ROUND_LENGTH, type ActivityRound } from '@domain/activity/activity-round';
import { PlayerProgress } from '@domain/progress/player-progress';
import { seededRandom } from '@domain/shared/random';
import { stickerId } from '@domain/stickers/sticker';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';
import { content, FakeSpeech, FixedClock } from '../support/fixtures';

const wrongAnswer = ({ item: { interaction } }: ActivityRound): string =>
  interaction.kind === 'tap'
    ? (interaction.options.find((o) => o.id !== interaction.answerId)?.id ?? '')
    : String(interaction.goal + 1);

describe('activity use cases', () => {
  let speech: FakeSpeech;
  let progress: InMemoryProgressRepository;
  let start: StartActivity;
  let answer: AnswerActivity;

  beforeEach(() => {
    speech = new FakeSpeech();
    progress = new InMemoryProgressRepository();
    const catalog = new StaticContentCatalog(content);
    const random = seededRandom(21);
    start = new StartActivity(catalog, progress, speech, random);
    answer = new AnswerActivity(catalog, progress, speech, random, new FixedClock(5_000));
  });

  const right = (session: ActivityRound) =>
    answer.execute(session, answerOf(session.item.interaction));

  it('starts at the saved level and asks the question aloud', async () => {
    await progress.save(
      PlayerProgress.fromSnapshot({
        ...PlayerProgress.createNew().toSnapshot(),
        skillLevels: { numbers: 2 },
      }),
    );
    const session = await start.execute('numbers');
    expect(session.level).toBe(2);
    expect(speech.spoken).toEqual([session.item.prompt.text]);
  });

  it('gives a coin per right answer, and a sticker and a star the first time', async () => {
    const session = await start.execute('letters');
    const first = await right(session);
    expect(first.reward).toEqual({ coins: 1, stars: 1 });
    expect(first.sticker?.id).toBe(stickerId('letters', 1));
    expect(speech.spoken.at(-1)).toContain(phrases.sticker);

    const second = await right(first.round);
    expect(second.reward).toEqual({ coins: 1, stars: 0 });
    // Praise only: the next question is said when its cards are on the screen.
    expect(speech.spoken.at(-1)).toBe(phrases.correct);
    expect(second.sticker).toBeUndefined();

    const saved = await progress.load();
    expect(saved.coins.amount).toBe(2);
    expect(saved.stars).toBe(1);
    expect(saved.letters.length).toBeGreaterThan(0);
  });

  it('saves a new level at the end of a good round, with its sticker and star', async () => {
    let session = await start.execute('coins');
    let last = await right(session);
    for (let i = 1; i < ROUND_LENGTH; i += 1) {
      session = last.round;
      last = await right(session);
    }
    expect(last.outcome).toMatchObject({ summary: { score: ROUND_LENGTH, reachedLevel: 2 } });
    expect(last.sticker?.id).toBe(stickerId('coins', 2));
    expect(speech.spoken.at(-1)).toContain(phrases.levelUp);
    const saved = await progress.load();
    expect(saved.levelOf('coins')).toBe(2);
    expect(saved.stars).toBe(2);
  });

  it('shows the answer on a wrong card, saving nothing', async () => {
    const session = await start.execute('numbers');
    const wrongId = wrongAnswer(session);
    const result = await answer.execute(session, wrongId);
    expect(result.outcome).toEqual({ kind: 'model', answerId: answerOf(session.item.interaction) });
    expect(result.reward).toEqual({ coins: 0, stars: 0 });
    expect(speech.spoken.at(-1)).toBe(session.item.teach.text);
    expect((await progress.load()).coins.amount).toBe(0);
  });

  it('gives no coin for pressing the answer that was shown', async () => {
    const session = await start.execute('numbers');
    const wrongId = wrongAnswer(session);
    const shown = await answer.execute(session, wrongId);
    const pressed = await answer.execute(shown.round, answerOf(session.item.interaction));
    expect(pressed.outcome.kind).toBe('practiced');
    expect(pressed.reward.coins).toBe(0);
    expect(pressed.sticker).toBeUndefined();
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

  it('remembers each skill, but not a demonstration or a returning question', async () => {
    const session = await start.execute('numbers');
    await right(session);
    const saved = await progress.load();
    expect(saved.skillRecord(session.item.skillId)?.recent).toEqual([true]);

    const shown = await start.execute('coins');
    await right(shown.demonstrate());
    expect((await progress.load()).skillRecord(shown.item.skillId)).toBeUndefined();
  });
});
