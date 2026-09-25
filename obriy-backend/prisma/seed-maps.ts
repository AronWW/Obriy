import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { BUILT_IN_MAP_PRESETS } from './map-presets.data';
import { getDatabaseAdapterConfig } from './database-config';

type MapPresetSeeder = Pick<PrismaClient, 'mapPreset'>;

export async function seedMapPresets(prisma: MapPresetSeeder): Promise<void> {
  for (const preset of BUILT_IN_MAP_PRESETS) {
    const data = {
      ...preset,
      bounds: preset.bounds as Prisma.InputJsonObject,
      defaultViewport: preset.defaultViewport as Prisma.InputJsonObject,
    };
    await prisma.mapPreset.upsert({
      where: { key: preset.key },
      create: data,
      update: data,
    });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(getDatabaseAdapterConfig()),
  });
  try {
    await seedMapPresets(prisma);
    console.log(`Map presets are ready: ${BUILT_IN_MAP_PRESETS.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(message);
    process.exitCode = 1;
  });
}
