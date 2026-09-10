import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { EarnedBadgeDto } from '../gamification/dto/gamification.dto';
import { levelForXp } from '../gamification/gamification.service';
import {
  LeaderboardPeriod,
  LeaderboardQueryDto,
} from './dto/leaderboard-query.dto';
import {
  LeaderboardClassDto,
  LeaderboardEntryDto,
  LeaderboardPageDto,
  LeaderboardPeriodDto,
} from './dto/leaderboard.dto';

const KYIV_TIME_ZONE = 'Europe/Kyiv';
const nameCollator = new Intl.Collator('uk', {
  numeric: true,
  sensitivity: 'base',
});

type ClassRecord = { id: string; name: string };
type StudentRecord = {
  id: string;
  profile: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(
    user: AuthUser,
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardPageDto> {
    this.assertRole(user, UserRole.STUDENT);
    const student = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        studentClass: { select: { id: true, name: true } },
      },
    });
    const period = this.toPeriod(query.period);
    if (!student?.studentClass) {
      return new LeaderboardPageDto({
        class: null,
        period,
        entries: [],
        selfEntry: null,
        nextCursor: null,
      });
    }
    return this.buildPage(student.studentClass, query, user.id, user.id);
  }

  async getTeacherClass(
    user: AuthUser,
    classId: string,
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardPageDto> {
    this.assertRole(user, UserRole.TEACHER);
    const classroom = await this.prisma.class.findFirst({
      where: { id: classId, teacherId: user.id },
      select: { id: true, name: true },
    });
    if (!classroom) {
      throw new NotFoundException({
        code: 'LEADERBOARD_CLASS_NOT_FOUND',
        message: 'Leaderboard class not found',
      });
    }
    return this.buildPage(classroom, query, null, user.id);
  }

  private async buildPage(
    classroom: ClassRecord,
    query: LeaderboardQueryDto,
    currentStudentId: string | null,
    viewerId: string,
  ): Promise<LeaderboardPageDto> {
    const period = this.toPeriod(query.period);
    const students = await this.prisma.user.findMany({
      where: { studentClassId: classroom.id, role: UserRole.STUDENT },
      select: {
        id: true,
        profile: { select: { displayName: true, avatarUrl: true } },
      },
    });
    const studentIds = students.map(({ id }) => id);
    const [allTimeGroups, showcaseAwards, viewerLocale] = await Promise.all([
      this.prisma.xPLedger.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds } },
        _sum: { amount: true },
        _max: { createdAt: true },
      }),
      this.prisma.userBadge.findMany({
        where: {
          studentId: { in: studentIds },
          showcasePosition: { not: null },
        },
        include: { badge: { include: { translations: true } } },
        orderBy: [{ studentId: 'asc' }, { showcasePosition: 'asc' }],
      }),
      this.findViewerLocale(viewerId),
    ]);
    const periodGroups =
      period.type === LeaderboardPeriod.ALL_TIME
        ? allTimeGroups
        : await this.prisma.xPLedger.groupBy({
            by: ['studentId'],
            where: {
              studentId: { in: studentIds },
              createdAt: {
                gte: period.startAt ?? undefined,
                lt: period.endAt ?? undefined,
              },
            },
            _sum: { amount: true },
            _max: { createdAt: true },
          });

    const allTimeByStudent = new Map(
      allTimeGroups.map((group) => [group.studentId, group] as const),
    );
    const periodByStudent = new Map(
      periodGroups.map((group) => [group.studentId, group] as const),
    );
    const showcaseByStudent = new Map<string, EarnedBadgeDto[]>();
    for (const award of showcaseAwards) {
      const translation =
        award.badge.translations.find(
          ({ locale }) => locale === viewerLocale,
        ) ??
        award.badge.translations.find(({ locale }) => locale === Locale.UK) ??
        award.badge.translations[0];
      const badges = showcaseByStudent.get(award.studentId) ?? [];
      badges.push(
        new EarnedBadgeDto({
          id: award.badge.id,
          key: award.badge.key,
          iconKey: award.badge.iconKey,
          name: translation?.name ?? award.badge.key,
          description: translation?.description ?? '',
          earnedAt: award.earnedAt,
          showcasePosition: award.showcasePosition,
        }),
      );
      showcaseByStudent.set(award.studentId, badges);
    }

    const ranked = students
      .map((student) => {
        const total = allTimeByStudent.get(student.id);
        const selectedPeriod = periodByStudent.get(student.id);
        return {
          student,
          totalXp: total?._sum.amount ?? 0,
          periodXp: selectedPeriod?._sum.amount ?? 0,
          lastXpAt: selectedPeriod?._max.createdAt ?? null,
        };
      })
      .sort(compareRankedStudents)
      .map(
        (item, index) =>
          new LeaderboardEntryDto({
            rank: index + 1,
            id: item.student.id,
            displayName: item.student.profile?.displayName ?? 'Student',
            avatarUrl: item.student.profile?.avatarUrl ?? null,
            periodXp: item.periodXp,
            totalXp: item.totalXp,
            level: levelForXp(item.totalXp),
            showcase: showcaseByStudent.get(item.student.id) ?? [],
            lastXpAt: item.lastXpAt,
            isCurrentUser: item.student.id === currentStudentId,
          }),
      );

    const startIndex = query.cursor
      ? this.cursorStartIndex(ranked, query.cursor)
      : 0;
    const limit = query.limit ?? 50;
    const entries = ranked.slice(startIndex, startIndex + limit);
    const hasNextPage = startIndex + entries.length < ranked.length;
    const lastEntry = entries.at(-1);

    return new LeaderboardPageDto({
      class: new LeaderboardClassDto({
        ...classroom,
        studentCount: ranked.length,
      }),
      period,
      entries,
      selfEntry:
        currentStudentId === null
          ? null
          : (ranked.find(({ id }) => id === currentStudentId) ?? null),
      nextCursor: hasNextPage && lastEntry ? encodeCursor(lastEntry.id) : null,
    });
  }

  private toPeriod(period = LeaderboardPeriod.WEEK): LeaderboardPeriodDto {
    if (period === LeaderboardPeriod.ALL_TIME) {
      return new LeaderboardPeriodDto({
        type: period,
        startAt: null,
        endAt: null,
      });
    }
    const bounds = getKyivWeekBounds(new Date());
    return new LeaderboardPeriodDto({ type: period, ...bounds });
  }

  private cursorStartIndex(
    entries: LeaderboardEntryDto[],
    cursor: string,
  ): number {
    const id = decodeCursor(cursor);
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) {
      throw new BadRequestException({
        code: 'LEADERBOARD_CURSOR_INVALID',
        message: 'Leaderboard cursor is invalid',
      });
    }
    return index + 1;
  }

  private async findViewerLocale(userId: string): Promise<Locale> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profile: { select: { preferredLocale: true } } },
    });
    return user?.profile?.preferredLocale ?? Locale.UK;
  }

  private assertRole(user: AuthUser, role: UserRole): void {
    if (user.role !== role) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: `Only ${role.toLowerCase()} accounts can access this leaderboard`,
      });
    }
  }
}

type RankedStudent = {
  student: StudentRecord;
  periodXp: number;
  totalXp: number;
  lastXpAt: Date | null;
};

export function compareRankedStudents(
  left: RankedStudent,
  right: RankedStudent,
): number {
  if (left.periodXp !== right.periodXp) return right.periodXp - left.periodXp;
  if (left.lastXpAt && right.lastXpAt) {
    const timeDifference = left.lastXpAt.getTime() - right.lastXpAt.getTime();
    if (timeDifference !== 0) return timeDifference;
  } else if (left.lastXpAt) {
    return -1;
  } else if (right.lastXpAt) {
    return 1;
  }
  const nameDifference = nameCollator.compare(
    left.student.profile?.displayName ?? '',
    right.student.profile?.displayName ?? '',
  );
  return nameDifference || left.student.id.localeCompare(right.student.id);
}

export function getKyivWeekBounds(now: Date): {
  startAt: Date;
  endAt: Date;
} {
  const local = zonedParts(now, KYIV_TIME_ZONE);
  const weekday = new Date(
    Date.UTC(local.year, local.month - 1, local.day),
  ).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const monday = new Date(
    Date.UTC(local.year, local.month - 1, local.day - daysSinceMonday),
  );
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
  return {
    startAt: zonedMidnightToUtc(
      monday.getUTCFullYear(),
      monday.getUTCMonth() + 1,
      monday.getUTCDate(),
      KYIV_TIME_ZONE,
    ),
    endAt: zonedMidnightToUtc(
      nextMonday.getUTCFullYear(),
      nextMonday.getUTCMonth() + 1,
      nextMonday.getUTCDate(),
      KYIV_TIME_ZONE,
    ),
  };
}

function zonedMidnightToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const localAsUtc = Date.UTC(year, month - 1, day);
  let result = localAsUtc;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = zonedParts(new Date(result), timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    result -= represented - localAsUtc;
  }
  return new Date(result);
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function encodeCursor(studentId: string): string {
  return Buffer.from(JSON.stringify({ studentId }), 'utf8').toString(
    'base64url',
  );
}

function decodeCursor(cursor: string): string {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { studentId?: unknown }).studentId !== 'string'
    ) {
      throw new Error('Invalid cursor');
    }
    return (parsed as { studentId: string }).studentId;
  } catch {
    throw new BadRequestException({
      code: 'LEADERBOARD_CURSOR_INVALID',
      message: 'Leaderboard cursor is invalid',
    });
  }
}
