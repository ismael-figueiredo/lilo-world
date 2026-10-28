import { describe, expect, it } from 'vitest';
import { ApplySettings } from '@application/use-cases/apply-settings';
import { ChangeAvatar } from '@application/use-cases/change-avatar';
import { ListAvatars } from '@application/use-cases/list-avatars';
import { CheckSessionTime } from '@application/use-cases/check-session-time';
import { CreateProfile } from '@application/use-cases/create-profile';
import { DeleteProfile } from '@application/use-cases/delete-profile';
import { GetActiveProfile } from '@application/use-cases/get-active-profile';
import { GetProgressSummary } from '@application/use-cases/get-progress-summary';
import { GetSettings } from '@application/use-cases/get-settings';
import { ListProfiles } from '@application/use-cases/list-profiles';
import { LoadSession } from '@application/use-cases/load-session';
import { RenameProfile } from '@application/use-cases/rename-profile';
import { SaveSession } from '@application/use-cases/save-session';
import { SelectProfile } from '@application/use-cases/select-profile';
import { UpdateSettings } from '@application/use-cases/update-settings';
import { PlayerProgress } from '@domain/progress/player-progress';
import { defaultSettings } from '@domain/settings/settings';
import { StaticContentCatalog } from '@infrastructure/catalog/static-content-catalog';
import { InMemoryProgressRepository } from '@infrastructure/persistence/in-memory-progress-repository';
import {
  InMemoryProfileRepository,
  InMemorySessionRepository,
  InMemorySettingsRepository,
} from '@infrastructure/persistence/in-memory-repositories';
import {
  content,
  FakeAudio,
  FakeSpeech,
  FixedClock,
  hat,
  mission,
  SequentialIds,
} from '../support/fixtures';

describe('profile use cases', () => {
  const setup = () => {
    const profiles = new InMemoryProfileRepository();
    const clock = new FixedClock(100);
    return {
      profiles,
      clock,
      create: new CreateProfile(profiles, new SequentialIds(), clock),
      select: new SelectProfile(profiles, clock),
      list: new ListProfiles(profiles),
      active: new GetActiveProfile(profiles),
    };
  };

  it('creates a profile and makes it active', async () => {
    const { create, active } = setup();
    const result = await create.execute(' Ana ', 'robot');
    expect(result.ok && result.value).toMatchObject({ id: 'id-1', name: 'Ana' });
    expect((await active.execute())?.name).toBe('Ana');
  });

  it('rejects an invalid name without saving', async () => {
    const { create, list } = setup();
    expect((await create.execute('', 'robot')).ok).toBe(false);
    expect(await list.execute()).toHaveLength(0);
  });

  it('selects a profile, moving it to the top of the list', async () => {
    const { create, select, list, clock } = setup();
    await create.execute('Ana', 'robot');
    await create.execute('Leo', 'robot');
    clock.time = 500;
    const selected = await select.execute('id-1');
    expect(selected.ok && selected.value.lastPlayedAt).toBe(500);
    expect((await list.execute()).map((p) => p.name)).toEqual(['Ana', 'Leo']);
    expect((await select.execute('missing')).ok).toBe(false);
  });

  it('renames and deletes profiles', async () => {
    const { profiles, create, active } = setup();
    await create.execute('Ana', 'robot');
    const rename = new RenameProfile(profiles);
    expect((await rename.execute('id-1', 'Aninha')).ok).toBe(true);
    expect((await rename.execute('missing', 'X')).ok).toBe(false);

    await new DeleteProfile(profiles).execute('id-1');
    expect(profiles.removed).toEqual(['id-1']);
    expect(await active.execute()).toBeUndefined();
  });

  it('has no active profile at first', async () => {
    expect(await setup().active.execute()).toBeUndefined();
  });
});

describe('settings use cases', () => {
  it('saves a change and applies volumes and voice right away', async () => {
    const repository = new InMemorySettingsRepository();
    const audio = new FakeAudio();
    const speech = new FakeSpeech();
    const apply = new ApplySettings(repository, audio, speech);
    const update = new UpdateSettings(repository, apply);

    await update.execute({ masterVolume: 0.5, musicVolume: 1, voiceSpeed: 'slow' });

    expect((await new GetSettings(repository).execute()).masterVolume).toBe(0.5);
    expect(audio.volumes?.music).toBeCloseTo(0.5);
    expect(speech.options).toMatchObject({ enabled: true, rate: 0.75 });
  });

  it('applies the stored settings at start', async () => {
    const audio = new FakeAudio();
    const settings = await new ApplySettings(
      new InMemorySettingsRepository({ ...defaultSettings, effectsVolume: 0 }),
      audio,
      new FakeSpeech(),
    ).execute();
    expect(settings.effectsVolume).toBe(0);
    expect(audio.volumes?.effects).toBe(0);
  });

  it('checks the session time against the limit', async () => {
    const check = new CheckSessionTime(
      new InMemorySettingsRepository({ ...defaultSettings, sessionLimitMinutes: 10 }),
    );
    expect(await check.execute(11 * 60_000, false)).toEqual({ kind: 'time-to-rest' });
  });
});

describe('session use cases', () => {
  it('saves and restores the position with a timestamp', async () => {
    const repository = new InMemorySessionRepository();
    await new SaveSession(repository, new FixedClock(42)).execute({
      x: 1,
      y: 2,
      z: 3,
      facing: 0.5,
      cameraYaw: 1,
    });
    expect(await new LoadSession(repository).execute()).toEqual({
      x: 1,
      y: 2,
      z: 3,
      facing: 0.5,
      cameraYaw: 1,
      savedAt: 42,
    });
  });
});

describe('GetProgressSummary', () => {
  it('summarizes coins, stars, items, worlds and missions', async () => {
    const bought = PlayerProgress.fromSnapshot({
      coins: 20,
      stars: 0,
      ownedItemIds: [],
      equipped: {},
      completedMissionIds: [],
    }).buy(hat);
    if (!bought.ok) throw new Error('setup failed');
    const progress = bought.value.completeMission(mission, { mistakes: 2, at: 9 }).progress;

    const summary = await new GetProgressSummary(
      new StaticContentCatalog(content),
      new InMemoryProgressRepository(progress),
    ).execute();

    expect(summary).toMatchObject({
      coins: 25,
      stars: 1,
      itemsOwned: 1,
      itemsTotal: 3,
      worldsOpen: 1,
      worldsTotal: 2,
    });
    expect(summary.missions).toEqual([
      {
        id: mission.id,
        title: mission.title,
        worldName: 'Cidade',
        done: true,
        stats: { attempts: 1, completions: 1, mistakes: 2, lastPlayedAt: 9 },
      },
    ]);
  });
});

describe('avatar use cases', () => {
  it('lists avatars and changes the avatar of a profile', async () => {
    const profiles = new InMemoryProfileRepository();
    const catalog = new StaticContentCatalog(content);
    await new CreateProfile(profiles, new SequentialIds(), new FixedClock()).execute(
      'Ana',
      'robot',
    );

    expect((await new ListAvatars(catalog).execute()).map((a) => a.id)).toEqual(['robot', 'bunny']);
    const changed = await new ChangeAvatar(profiles, catalog).execute('id-1', 'bunny');
    expect(changed.ok && changed.value.avatarId).toBe('bunny');
    expect((await profiles.list())[0]?.avatarId).toBe('bunny');
  });

  it('rejects unknown avatars and profiles', async () => {
    const profiles = new InMemoryProfileRepository();
    const change = new ChangeAvatar(profiles, new StaticContentCatalog(content));
    expect((await change.execute('id-1', 'dragon')).ok).toBe(false);
    expect((await change.execute('missing', 'bunny')).ok).toBe(false);
  });
});
