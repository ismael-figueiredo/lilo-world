import {
  BAKERY_INTERIOR,
  BEACH_PARK,
  BUS_INTERIOR,
  FARM_PARK,
  MARKET_INTERIOR,
  SCHOOL_BUILDING,
  ZOO_PARK,
} from '@presentation/world/market-position';
import { EMOTIONS_GARDEN } from '@presentation/world/zones/anchors';
import type { Zone, ZoneContext, ZoneEntry } from '@presentation/world/zones/zone';

export const ZoneId = {
  emotions: 'emotions',
  market: 'market',
  bus: 'bus',
  schoolBuilding: 'school-building',
  zoo: 'zoo',
  beach: 'beach',
  farm: 'farm',
  bakery: 'bakery',
} as const;

/** Every zone of the game. A new place of the world starts here. */
export const zoneEntries: readonly ZoneEntry[] = [
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
    id: ZoneId.beach,
    area: { ...BEACH_PARK, radius: 30 },
    models: [],
    onIsland: false,
    build: async (): Promise<Zone> => {
      const { BeachPark } = await import('@presentation/world/beach-park');
      return new BeachPark();
    },
  },
  {
    id: ZoneId.farm,
    area: { ...FARM_PARK, radius: 30 },
    models: ['cow', 'pig', 'sheep', 'horse', 'chick'],
    onIsland: false,
    build: async ({ assets }: ZoneContext): Promise<Zone> => {
      const { FarmPark } = await import('@presentation/world/farm-park');
      return new FarmPark(assets);
    },
  },
  {
    id: ZoneId.bakery,
    area: { ...BAKERY_INTERIOR, radius: 12 },
    models: [],
    onIsland: false,
    build: async (): Promise<Zone> => {
      const { BakeryInterior } = await import('@presentation/world/bakery-interior');
      return new BakeryInterior();
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
