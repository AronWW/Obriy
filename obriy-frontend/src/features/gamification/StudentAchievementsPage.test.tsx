import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { useSessionStore } from '../auth/model/session.store'
import type { StudentAchievements } from './model/gamification.types'
import { StudentAchievementsPage } from './StudentAchievementsPage'

describe('Student achievements', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({
      accessToken: 'student-token',
      status: 'authenticated',
      user: {
        id: 'student-1',
        email: 'student@example.com',
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerifiedAt: '2026-09-01T10:00:00.000Z',
        profile: {
          displayName: 'Marta',
          avatarUrl: null,
          bio: null,
          gradeLevel: 8,
          subjectArea: null,
          preferredLocale: 'EN',
        },
      },
    })
  })

  it('shows earned and locked progress, filters the collection, and updates showcase', async () => {
    const selected: string[][] = []
    server.use(
      http.get(`${API_BASE_URL}/gamification/me/achievements`, () =>
        HttpResponse.json(achievementsFixture()),
      ),
      http.patch(`${API_BASE_URL}/gamification/me/showcase`, async ({ request }) => {
        const body = (await request.json()) as { badgeIds: string[] }
        selected.push(body.badgeIds)
        return HttpResponse.json({
          progress: achievementsFixture().progress,
          showcase: achievementsFixture().showcase,
          badges: achievementsFixture().badges
            .filter((badge) => badge.status === 'EARNED')
            .map((badge) => ({ ...badge, earnedAt: badge.earnedAt ?? '' })),
        })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Achievements' })).toBeInTheDocument()
    expect(await screen.findByText('2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'First Step' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Steady Path' })).toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progress toward Steady Path' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    )

    await user.click(screen.getByRole('button', { name: 'Locked' }))
    expect(screen.queryByRole('heading', { name: 'First Step' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Steady Path' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Customize showcase' }))
    await user.click(screen.getByRole('button', { name: /Perfect Result/ }))
    await user.click(screen.getByRole('button', { name: 'Save showcase' }))
    await waitFor(() => expect(selected).toEqual([['badge-1', 'badge-2']]))
  })

  it('shows a recoverable error state', async () => {
    server.use(
      http.get(`${API_BASE_URL}/gamification/me/achievements`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    renderPage()

    expect(await screen.findByText('Could not load achievements.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StudentAchievementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function achievementsFixture(): StudentAchievements {
  const first = earnedBadge('badge-1', 'First Step', 'footprints', 1)
  const perfect = earnedBadge('badge-2', 'Perfect Result', 'sparkles', null)
  return {
    progress: {
      totalXp: 700,
      level: 2,
      levelStartXp: 500,
      nextLevelXp: 1500,
      xpIntoLevel: 200,
      xpForNextLevel: 1000,
    },
    summary: { earnedCount: 2, totalCount: 3 },
    showcase: [first],
    badges: [
      first,
      perfect,
      {
        id: 'badge-3',
        key: 'STEADY_PATH',
        iconKey: 'compass',
        name: 'Steady Path',
        description: 'Pass five different tests.',
        status: 'LOCKED',
        criteriaType: 'PASSED_TEST_COUNT',
        progress: { current: 3, target: 5, percent: 60 },
        earnedAt: null,
        showcasePosition: null,
      },
    ],
  }
}

function earnedBadge(
  id: string,
  name: string,
  iconKey: string,
  showcasePosition: number | null,
) {
  return {
    id,
    key: name.toUpperCase().replaceAll(' ', '_'),
    iconKey,
    name,
    description: `${name} description.`,
    status: 'EARNED' as const,
    criteriaType: 'PASSED_TEST_COUNT' as const,
    progress: { current: 1, target: 1, percent: 100 },
    earnedAt: '2026-09-10T10:00:00.000Z',
    showcasePosition,
  }
}
