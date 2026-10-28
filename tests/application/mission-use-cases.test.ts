import { beforeEach, describe, expect, it } from 'vitest';
import { ChooseMissionAnswer, phrases } from '@application/use-cases/choose-mission-answer';
import { StartMission } from '@application/use-cases/start-mission';
import type { MissionAttempt } from '@domain/mission/mission-attempt';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';
import { LeaveMission } from '@application/use-cases/leave-mission';
import { content, FakeSpeech, FixedClock, mission } from '../support/fixtures';

describe('mission use cases', () => {
  let speech: FakeSpeech;
  let progress: InMemoryProgressRepository;
  let startMission: StartMission;
  let chooseAnswer: ChooseMissionAnswer;

  beforeEach(() => {
    speech = new FakeSpeech();
    progress = new InMemoryProgressRepository();
    startMission = new StartMission(new StaticContentCatalog(content), speech);
    chooseAnswer = new ChooseMissionAnswer(progress, speech, new FixedClock(5_000));
  });

  const start = async (): Promise<MissionAttempt> => {
    const result = await startMission.execute(mission.id);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };

  it('starts a mission and says the introduction with the first instruction', async () => {
    const attempt = await start();
    expect(attempt.currentStep?.targetId).toBe('apple');
    expect(speech.spoken).toEqual(['Vamos ao mercado! Pegue a maçã.']);
  });

  it('reports an unknown mission', async () => {
    const result = await startMission.execute('missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-found');
  });

  it('repeats the instruction kindly after a mistake', async () => {
    const result = await chooseAnswer.execute(await start(), 'bread');
    expect(result.ok && result.value.outcome.kind).toBe('hint');
    expect(speech.spoken.at(-1)).toBe(`${phrases.hint} Pegue a maçã.`);
  });

  it('praises and gives the next instruction after a correct choice', async () => {
    const result = await chooseAnswer.execute(await start(), 'apple');
    expect(result.ok && result.value.outcome.kind).toBe('correct');
    expect(speech.spoken.at(-1)).toBe(`${phrases.correct} Pegue o leite.`);
  });

  it('saves the reward when the mission is completed', async () => {
    const first = await chooseAnswer.execute(await start(), 'apple');
    if (!first.ok) throw new Error('setup failed');
    const last = await chooseAnswer.execute(first.value.attempt, 'milk');

    expect(last.ok && last.value.reward).toEqual({ coins: 10, stars: 1 });
    const saved = await progress.load();
    expect(saved.coins.amount).toBe(10);
    expect(saved.stars).toBe(1);
    expect(speech.spoken.at(-1)).toBe(phrases.completed);
  });

  it('passes on domain errors without saving', async () => {
    const first = await chooseAnswer.execute(await start(), 'apple');
    if (!first.ok) throw new Error('setup failed');
    const last = await chooseAnswer.execute(first.value.attempt, 'milk');
    if (!last.ok) throw new Error('setup failed');

    const again = await chooseAnswer.execute(last.value.attempt, 'milk');
    expect(again.ok).toBe(false);
    expect((await progress.load()).coins.amount).toBe(10);
  });

  it('records mistakes and play time in the mission stats', async () => {
    const mistake = await chooseAnswer.execute(await start(), 'bread');
    if (!mistake.ok) throw new Error('setup failed');
    const first = await chooseAnswer.execute(mistake.value.attempt, 'apple');
    if (!first.ok) throw new Error('setup failed');
    await chooseAnswer.execute(first.value.attempt, 'milk');

    expect((await progress.load()).statsFor(mission.id)).toEqual({
      attempts: 1,
      completions: 1,
      mistakes: 1,
      lastPlayedAt: 5_000,
    });
  });

  it('records a mission left early as practice, without a reward', async () => {
    const leave = new LeaveMission(progress, new FixedClock(7_000));
    const first = await chooseAnswer.execute(await start(), 'apple');
    if (!first.ok) throw new Error('setup failed');
    await leave.execute(first.value.attempt);

    const saved = await progress.load();
    expect(saved.statsFor(mission.id)).toMatchObject({ attempts: 1, completions: 0 });
    expect(saved.coins.amount).toBe(0);
  });

  it('does not record a finished mission twice when leaving', async () => {
    const leave = new LeaveMission(progress, new FixedClock());
    const first = await chooseAnswer.execute(await start(), 'apple');
    if (!first.ok) throw new Error('setup failed');
    const last = await chooseAnswer.execute(first.value.attempt, 'milk');
    if (!last.ok) throw new Error('setup failed');
    await leave.execute(last.value.attempt);
    expect((await progress.load()).statsFor(mission.id).attempts).toBe(1);
  });
});
