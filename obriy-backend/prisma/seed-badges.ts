import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { BadgeCriteriaType, Locale, PrismaClient } from '@prisma/client';
import { getDatabaseAdapterConfig } from './database-config';

export const BUILT_IN_BADGES = [
  {
    key: 'FIRST_STEP',
    iconKey: 'footprints',
    criteriaType: BadgeCriteriaType.PASSED_TEST_COUNT,
    criteriaValue: 1,
    translations: {
      [Locale.UK]: {
        name: 'Перший крок',
        description: 'Успішно скласти перший тест.',
      },
      [Locale.EN]: {
        name: 'First Step',
        description: 'Successfully pass your first test.',
      },
    },
  },
  {
    key: 'STEADY_PATH',
    iconKey: 'compass',
    criteriaType: BadgeCriteriaType.PASSED_TEST_COUNT,
    criteriaValue: 5,
    translations: {
      [Locale.UK]: {
        name: 'Впевнений шлях',
        description: 'Успішно скласти п’ять різних тестів.',
      },
      [Locale.EN]: {
        name: 'Steady Path',
        description: 'Successfully pass five different tests.',
      },
    },
  },
  {
    key: 'TEN_COMPLETED',
    iconKey: 'medal',
    criteriaType: BadgeCriteriaType.PASSED_TEST_COUNT,
    criteriaValue: 10,
    translations: {
      [Locale.UK]: {
        name: 'Десятка',
        description: 'Успішно скласти десять різних тестів.',
      },
      [Locale.EN]: {
        name: 'Ten Strong',
        description: 'Successfully pass ten different tests.',
      },
    },
  },
  {
    key: 'PERFECT_RESULT',
    iconKey: 'sparkles',
    criteriaType: BadgeCriteriaType.PERFECT_SCORE_COUNT,
    criteriaValue: 1,
    translations: {
      [Locale.UK]: {
        name: 'Бездоганний результат',
        description: 'Отримати 100% за тест після остаточного оцінювання.',
      },
      [Locale.EN]: {
        name: 'Perfect Result',
        description: 'Earn 100% on a test after final grading.',
      },
    },
  },
] as const;

type BadgeSeeder = Pick<PrismaClient, 'badge' | 'badgeTranslation'>;

export async function seedBadges(prisma: BadgeSeeder): Promise<void> {
  for (const badge of BUILT_IN_BADGES) {
    const saved = await prisma.badge.upsert({
      where: { key: badge.key },
      create: {
        key: badge.key,
        iconKey: badge.iconKey,
        criteriaType: badge.criteriaType,
        criteriaValue: badge.criteriaValue,
      },
      update: {
        iconKey: badge.iconKey,
        criteriaType: badge.criteriaType,
        criteriaValue: badge.criteriaValue,
        isActive: true,
      },
    });
    const translations = Object.entries(badge.translations) as Array<
      [Locale, { name: string; description: string }]
    >;
    for (const [locale, translation] of translations) {
      await prisma.badgeTranslation.upsert({
        where: {
          badgeId_locale: { badgeId: saved.id, locale },
        },
        create: {
          badgeId: saved.id,
          locale,
          ...translation,
        },
        update: translation,
      });
    }
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(getDatabaseAdapterConfig()),
  });
  try {
    await seedBadges(prisma);
    console.log(`Badges are ready: ${BUILT_IN_BADGES.length}`);
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
