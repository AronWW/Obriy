import {
  compareRankedStudents,
  getKyivWeekBounds,
} from '../../../src/leaderboard/leaderboard.service';

describe('leaderboard ranking', () => {
  it('sorts by XP, earliest achievement time, name, and id', () => {
    const entries = [
      ranked('d', 'Beta', 100, '2026-09-09T12:00:00.000Z'),
      ranked('c', 'Alpha', 0, null),
      ranked('b', 'Beta', 100, '2026-09-09T10:00:00.000Z'),
      ranked('a', 'Alpha', 100, '2026-09-09T10:00:00.000Z'),
      ranked('e', 'Beta', 0, null),
    ].sort(compareRankedStudents);

    expect(entries.map(({ student }) => student.id)).toEqual([
      'a',
      'b',
      'd',
      'c',
      'e',
    ]);
    expect(entries.map((_, index) => index + 1)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Kyiv leaderboard week', () => {
  it('starts on local Monday and ends exclusively on the next Monday', () => {
    const bounds = getKyivWeekBounds(new Date('2026-09-10T12:00:00.000Z'));
    expect(bounds).toEqual({
      startAt: new Date('2026-09-06T21:00:00.000Z'),
      endAt: new Date('2026-09-13T21:00:00.000Z'),
    });
  });

  it('honours a daylight-saving transition inside the week', () => {
    const bounds = getKyivWeekBounds(new Date('2026-03-25T12:00:00.000Z'));
    expect(bounds).toEqual({
      startAt: new Date('2026-03-22T22:00:00.000Z'),
      endAt: new Date('2026-03-29T21:00:00.000Z'),
    });
    expect(bounds.endAt.getTime() - bounds.startAt.getTime()).toBe(
      167 * 60 * 60 * 1000,
    );
  });
});

function ranked(
  id: string,
  displayName: string,
  periodXp: number,
  lastXpAt: string | null,
) {
  return {
    student: { id, profile: { displayName, avatarUrl: null } },
    periodXp,
    totalXp: periodXp,
    lastXpAt: lastXpAt ? new Date(lastXpAt) : null,
  };
}
