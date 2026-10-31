import { MARKET_INTERIOR } from '@presentation/world/market-position';
import { EMOTIONS_GARDEN, NATURE_CAMP, SCHOOL_AREA } from '@presentation/world/zones/anchors';
import type { Zone, ZoneContext, ZoneEntry } from '@presentation/world/zones/zone';

export const ZoneId = {
  camp: 'camp',
  school: 'school',
  emotions: 'emotions',
  market: 'market',
} as const;

/** Every zone of the game. A new place of the world starts here. */
export const zoneEntries: readonly ZoneEntry[] = [
  {
    id: ZoneId.camp,
    area: NATURE_CAMP,
    models: ['cow', 'pig', 'sheep', 'horse', 'chick'],
    onIsland: true,
    build: async ({ assets }: ZoneContext): Promise<Zone> => {
      const { NatureCamp } = await import('@presentation/world/nature-camp');
      return new NatureCamp(assets);
    },
  },
  {
    id: ZoneId.school,
    area: SCHOOL_AREA,
    models: [],
    onIsland: true,
    build: async ({ assets }: ZoneContext): Promise<Zone> => {
      const { SchoolArea } = await import('@presentation/world/school-area');
      return new SchoolArea(assets);
    },
  },
  {
    id: ZoneId.emotions,
    area: EMOTIONS_GARDEN,
    models: [],
    onIsland: true,
    build: async ({ assets }: ZoneContext): Promise<Zone> => {
      const { EmotionsGarden } = await import('@presentation/world/emotions-garden');
      return new EmotionsGarden(assets);
    },
  },
  {
    id: ZoneId.market,
    area: { ...MARKET_INTERIOR, radius: 20 },
    models: [],
    onIsland: false,
    build: async ({ heightAt }: ZoneContext): Promise<Zone> => {
      const { MarketInterior } = await import('@presentation/world/market-interior');
      return new MarketInterior(heightAt(MARKET_INTERIOR.x, MARKET_INTERIOR.z));
    },
  },
];
