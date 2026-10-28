import type { Mission, MissionChoice } from '@domain/mission/mission';
import { pick, shuffled, type Random } from '@domain/shared/random';

const MAIN_GROUP = 'main';
/** Wrong cards at a second counter (the cashier): few, and close to the answer. */
const SIDE_DISTRACTORS = 2;

const groupOf = (choice: MissionChoice): string => choice.group ?? MAIN_GROUP;

/**
 * Turns a mission into the one played now: picks a variant and the cards on
 * the shelf. The right cards are always there; the others change each time.
 * On a side counter (coins at the cashier) the other cards are the ones next
 * to the answer, so 3 coins is shown with 2 and 4. Pure: same random, same mission.
 */
export function prepareMission(mission: Mission, random: Random): Mission {
  const { variants, distractors, ...base } = mission;
  const variant =
    variants === undefined || variants.length === 0 ? undefined : pick(random, variants);
  const played: Mission =
    variant === undefined
      ? base
      : {
          ...base,
          title: variant.title ?? base.title,
          introduction: variant.introduction,
          steps: variant.steps,
          ...(variant.farewell === undefined ? {} : { farewell: variant.farewell }),
          ...(variant.result === undefined ? {} : { result: variant.result }),
        };

  if (distractors === undefined) return played;

  const targets = new Set(played.steps.map((step) => step.targetId));
  const groups = new Set(played.choices.filter((choice) => targets.has(choice.id)).map(groupOf));
  const shown = new Set<string>(targets);
  for (const group of groups) {
    const inGroup = played.choices.filter((choice) => groupOf(choice) === group);
    const others = inGroup.filter((choice) => !targets.has(choice.id));
    if (group === MAIN_GROUP) {
      for (const choice of shuffled(random, others).slice(0, distractors)) shown.add(choice.id);
      continue;
    }
    const answers = inGroup
      .map((choice, index) => (targets.has(choice.id) ? index : -1))
      .filter((index) => index >= 0);
    const nearest = others
      .map((choice) => ({
        choice,
        distance: Math.min(...answers.map((a) => Math.abs(inGroup.indexOf(choice) - a))),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, SIDE_DISTRACTORS);
    for (const { choice } of nearest) shown.add(choice.id);
  }

  const onShelf = played.choices.filter((choice) => shown.has(choice.id));
  // Shopping shelves change order; AAC boards keep each card where it always is.
  const main = onShelf.filter((choice) => groupOf(choice) === MAIN_GROUP);
  const side = onShelf.filter((choice) => groupOf(choice) !== MAIN_GROUP);
  const shuffles = played.kind === 'pick-items' || played.kind === 'quiz';
  const choices = shuffles ? [...shuffled(random, main), ...side] : onShelf;
  return { ...played, choices };
}
