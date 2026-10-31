import {
  BUS_INTERIOR,
  MARKET_INTERIOR,
  SCHOOL_BUILDING,
  ZOO_PARK,
} from '@presentation/world/market-position';
import { EMOTIONS_GARDEN, NATURE_CAMP, SCHOOL_AREA } from '@presentation/world/zones/anchors';
import type { Zone, ZoneContext, ZoneEntry } from '@presentation/world/zones/zone';

export const ZoneId = {
  camp: 'camp',
  school: 'school',
  emotions: 'emotions',
  market: 'market',
  bus: 'bus',
  schoolBuilding: 'school-building',
  zoo: 'zoo',
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
    id: ZoneId.bus,
    area: { ...BUS_INTERIOR, radius: 12 },
    models: [],
    onIsland: false,
    build: async (): Promise<Zone> => {
      const { BusInterior } = await import('@presentation/world/bus-interior');
      return new BusInterior();
    },
  },
  {
    id: ZoneId.schoolBuilding,
    area: { ...SCHOOL_BUILDING, radius: 34 },
    models: [],
    onIsland: false,
    build: async (): Promise<Zone> => {
      const { SchoolBuilding } = await import('@presentation/world/school-building');
      return new SchoolBuilding();
    },
  },
  {
    id: ZoneId.zoo,
    area: { ...ZOO_PARK, radius: 30 },
    models: [],
    onIsland: false,
    build: async (): Promise<Zone> => {
      const { ZooPark } = await import('@presentation/world/zoo-park');
      return new ZooPark();
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
