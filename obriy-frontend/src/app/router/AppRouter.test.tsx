import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UserRole } from '../../features/auth/model/auth.types'
import { useSessionStore } from '../../features/auth/model/session.store'
import {
  getPendingParentInvitation,
  rememberParentInvitation,
} from '../../features/parent-links/model/parent-invitation-session'
import i18n from '../../i18n/config'
import { API_BASE_URL } from '../../shared/config/env'
import { server } from '../../test/server'
import { AppRouter } from './AppRouter'

const authenticatedUser = {
  id: 'user-1',
  email: 'student@example.com',
  role: 'STUDENT' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: '2026-07-18T12:00:00.000Z',
  hasPassword: true,
  profile: {
    displayName: 'Іван',
    avatarUrl: null,
    bio: null,
    subjectArea: null,
    preferredLocale: 'UK' as const,
  },
}

describe('AppRouter auth boundaries', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('uk')
    useSessionStore.setState({
      accessToken: 'access-token',
      status: 'authenticated',
      user: authenticatedUser,
    })
    server.use(
      http.get(`${API_BASE_URL}/users/me/children`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/parent-links/me/guardians`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/parent-links/invitation`, () =>
        HttpResponse.json(null),
      ),
      http.get(`${API_BASE_URL}/lessons`, () => HttpResponse.json([])),
      http.get(`${API_BASE_URL}/classes/me/lessons`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/teacher/dashboard`, () =>
        HttpResponse.json({
          stats: {
            classes: { total: 0, studentCount: 0 },
            lessons: { total: 0, drafts: 0 },
            assignments: { total: 0, drafts: 0 },
            tests: { total: 0, drafts: 0 },
            pendingReviews: 0,
          },
          pendingReviews: [],
          recent: { lessons: [], assignments: [], tests: [] },
        }),
      ),
      http.get(`${API_BASE_URL}/student/dashboard`, () =>
        HttpResponse.json({
          class: null,
          metrics: {
            requiredReleaseCount: 0,
            completedCount: 0,
            completionPercent: null,
            averagePercent: null,
            attentionCount: 0,
            nextDueAt: null,
          },
          attention: [],
          upcoming: [],
          continueLessons: [],
        }),
      ),
      http.get(`${API_BASE_URL}/student/tasks`, () =>
        HttpResponse.json({ class: null, items: [], nextCursor: null }),
      ),
      http.get(`${API_BASE_URL}/parent/dashboard`, () =>
        HttpResponse.json({ children: [] }),
      ),
    )
  })

  it('redirects an authenticated user away from guest-only pages', async () => {
    renderRouter('/auth/login')

    expect(
      await screen.findByRole('navigation', { name: 'Основна навігація' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'З поверненням' })).not.toBeInTheDocument()
  })

  it('redirects an authenticated user away from the public home page', async () => {
    renderRouter('/')

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent(
        '/app/student',
      )
    })
  })

  it('keeps email token routes reachable for an authenticated browser session', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/verify-email`, () =>
        HttpResponse.json(
          { code: 'EMAIL_VERIFIED', message: 'Email verified.' },
          { status: 201 },
        ),
      ),
    )

    renderRouter('/auth/verify-email?token=email-token')

    expect(
      await screen.findByRole('heading', { name: 'Пошту підтверджено' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['STUDENT', '/app/student'],
    ['TEACHER', '/app/teacher'],
    ['PARENT', '/app/parent'],
    ['ADMIN', '/app/admin'],
  ] satisfies [UserRole, string][])(
    'routes an authenticated %s from /app to the role home',
    async (role, expectedPath) => {
      useSessionStore.setState({
        user: { ...authenticatedUser, role },
      })

      renderRouter('/app')

      await waitFor(() => {
        expect(screen.getByTestId('current-location')).toHaveTextContent(
          expectedPath,
        )
      })
    },
  )

  it('redirects a user away from another role workspace', async () => {
    renderRouter('/app/teacher')

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent(
        '/app/student',
      )
    })
  })

  it('redirects an unknown app route to the current role home', async () => {
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'PARENT' },
    })

    renderRouter('/app/not-a-real-route')

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent(
        '/app/parent',
      )
    })
  })

  it('links the admin brand to the admin overview', async () => {
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'ADMIN' },
    })

    renderRouter('/app/admin')

    expect(await screen.findByRole('link', { name: 'Obriy' })).toHaveAttribute(
      'href',
      '/app/admin',
    )
  })

  it('renders the student menu and opens its workspace routes', async () => {
    const user = userEvent.setup()

    renderRouter('/app/student')

    expect(await screen.findByRole('link', { name: 'Obriy' })).toHaveAttribute(
      'href',
      '/app/student',
    )
    expect(
      await screen.findByRole('heading', { name: 'Огляд', level: 1 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'Відкрити профіль' }),
    ).toHaveAttribute('href', '/app/student/profile')
    expect(
      screen.getByRole('heading', { name: 'Спершу приєднайся до класу' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/XP/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Рівень/i)).not.toBeInTheDocument()

    const expectedLinks = [
      ['Огляд', '/app/student'],
      ['Мої класи', '/app/student/classes'],
      ['Мої завдання', '/app/student/tasks'],
      ['Досягнення', '/app/student/achievements'],
      ['Рейтинг', '/app/student/leaderboard'],
      ['Профіль', '/app/student/profile'],
    ]
    const primaryNavigation = screen.getByRole('navigation', {
      name: 'Основна навігація',
    })

    for (const [name, href] of expectedLinks) {
      expect(
        await within(primaryNavigation).findByRole('link', { name }),
      ).toHaveAttribute('href', href)
    }

    await user.click(
      within(primaryNavigation).getByRole('link', {
        name: 'Мої завдання',
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Мої завдання' }),
    ).toBeInTheDocument()
    expect(
      within(primaryNavigation).getByRole('link', {
        name: 'Мої завдання',
      }),
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/app/student/tasks',
    )
  })

  it('renders and updates the student profile inside the student sidebar', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown
    server.use(
      http.patch(
        `${API_BASE_URL}/users/me/profile`,
        async ({ request }) => {
          receivedBody = await request.json()

          return HttpResponse.json({
            ...authenticatedUser,
            profile: {
              ...authenticatedUser.profile,
              displayName: 'Іван Дослідник',
              bio: 'Найбільше цікавлюся історією українського козацтва.',
            },
          })
        },
      ),
    )

    renderRouter('/app/student/profile')

    expect(
      await screen.findByRole('heading', { name: 'Іван', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('navigation', { name: 'Основна навігація' }),
      ).getByRole('link', { name: 'Профіль' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('heading', { name: 'Вибрані значки' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/XP/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Рівень/i)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Налаштувати профіль' }),
    )

    const nameInput = screen.getByRole('textbox', {
      name: 'Ім’я у профілі',
    })
    await user.clear(nameInput)
    await user.type(nameInput, 'І')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(
      await screen.findByText(
        'Ім’я має містити щонайменше 2 символи.',
      ),
    ).toBeInTheDocument()
    expect(receivedBody).toBeUndefined()

    await user.clear(nameInput)
    await user.type(nameInput, 'Іван Дослідник')
    await user.type(
      screen.getByRole('textbox', { name: 'Коротко про себе' }),
      'Найбільше цікавлюся історією українського козацтва.',
    )
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Іван Дослідник',
        level: 1,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Профіль оновлено.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Найбільше цікавлюся історією українського козацтва.',
      ),
    ).toBeInTheDocument()
    expect(receivedBody).toEqual({
      bio: 'Найбільше цікавлюся історією українського козацтва.',
      displayName: 'Іван Дослідник',
    })
    expect(useSessionStore.getState().user?.profile).toMatchObject({
      bio: 'Найбільше цікавлюся історією українського козацтва.',
      displayName: 'Іван Дослідник',
    })
  })

  it('renders the teacher menu and opens its placeholder routes', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'TEACHER' },
    })

    renderRouter('/app/teacher')

    expect(await screen.findByRole('link', { name: 'Obriy' })).toHaveAttribute(
      'href',
      '/app/teacher',
    )
    const expectedLinks = [
      ['Огляд', '/app/teacher'],
      ['Мої класи', '/app/teacher/classes'],
      ['Мої уроки', '/app/teacher/lessons'],
      ['Завдання', '/app/teacher/tasks'],
      ['Аналітика', '/app/teacher/analytics'],
      ['Профіль', '/app/teacher/profile'],
    ]

    for (const [name, href] of expectedLinks) {
      expect(
        await screen.findByRole('link', { name }),
      ).toHaveAttribute('href', href)
    }

    expect(
      screen.queryByRole('link', { name: 'Досягнення' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Мої уроки' }))

    expect(
      await screen.findByRole('heading', { name: 'Мої уроки' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Мої уроки' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/app/teacher/lessons',
    )
  })

  it('lets a teacher create a class and reveals the invitation code once', async () => {
    const user = userEvent.setup()
    let classes: Array<Record<string, unknown>> = []
    let receivedBody: unknown
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'TEACHER' },
    })
    server.use(
      http.get(`${API_BASE_URL}/classes`, () => HttpResponse.json(classes)),
      http.post(`${API_BASE_URL}/classes`, async ({ request }) => {
        receivedBody = await request.json()
        const classroom = {
          id: 'class-1',
          name: '8-А',
          studentCount: 0,
          createdAt: '2026-07-28T12:00:00.000Z',
          updatedAt: '2026-07-28T12:00:00.000Z',
        }
        classes = [classroom]

        return HttpResponse.json(
          {
            class: classroom,
            invite: {
              code: 'ABCD-EFGH',
            },
          },
          { status: 201 },
        )
      }),
    )

    renderRouter('/app/teacher/classes')

    expect(
      await screen.findByRole('heading', { name: 'Класів ще немає' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getAllByRole('button', { name: 'Створити клас' })[0],
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Назва класу' }),
      '8-А',
    )
    await user.click(
      screen.getByRole('button', { name: 'Створити й отримати код' }),
    )

    expect(await screen.findByText('ABCD-EFGH')).toBeInTheDocument()
    expect(receivedBody).toEqual({ name: '8-А' })
    expect(
      await screen.findByRole('link', { name: 'Відкрити клас' }),
    ).toHaveAttribute('href', '/app/teacher/classes/class-1')
  })

  it('shows only same-class students and opens a classmate profile', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_BASE_URL}/classes/me`, () =>
        HttpResponse.json({
          id: 'class-1',
          name: '8-А',
          studentCount: 2,
          createdAt: '2026-07-28T12:00:00.000Z',
          updatedAt: '2026-07-28T12:00:00.000Z',
          teacher: { id: 'teacher-1', displayName: 'Пані Олена' },
        }),
      ),
      http.get(`${API_BASE_URL}/classes/me/classmates`, () =>
        HttpResponse.json([
          {
            id: 'student-2',
            displayName: 'Марія',
            avatarUrl: null,
          },
        ]),
      ),
      http.get(`${API_BASE_URL}/classes/classmates/student-2`, () =>
        HttpResponse.json({
          id: 'student-2',
          displayName: 'Марія',
          avatarUrl: null,
          bio: 'Люблю досліджувати історію Київської Русі.',
          gamification: {
            progress: {
              totalXp: 700,
              level: 2,
              levelStartXp: 500,
              nextLevelXp: 1500,
              xpIntoLevel: 200,
              xpForNextLevel: 1000,
            },
            showcase: [],
            badges: [],
          },
        }),
      ),
    )

    renderRouter('/app/student/classes')

    expect(
      await screen.findByRole('heading', { name: '8-А', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Учитель: Пані Олена/)).toBeInTheDocument()
    await user.click(
      await screen.findByRole('link', { name: 'Відкрити профіль' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Марія', level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Люблю досліджувати історію Київської Русі.'),
    ).toBeInTheDocument()
    expect(screen.getByText('700 XP')).toBeInTheDocument()
    expect(screen.getByText('Рівень')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Оформлення' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Хто бачить профіль' })).not.toBeInTheDocument()
  })

  it('lets a student join with a teacher code and refreshes the class view', async () => {
    const user = userEvent.setup()
    let joined = false
    let receivedBody: unknown
    const joinedClass = {
      id: 'class-1',
      name: '7-Б',
      studentCount: 1,
      createdAt: '2026-07-28T12:00:00.000Z',
      updatedAt: '2026-07-28T12:00:00.000Z',
      teacher: { id: 'teacher-1', displayName: 'Пан Тарас' },
    }
    server.use(
      http.get(`${API_BASE_URL}/classes/me`, () =>
        joined
          ? HttpResponse.json(joinedClass)
          : new HttpResponse(null, { status: 200 }),
      ),
      http.get(`${API_BASE_URL}/classes/me/classmates`, () =>
        HttpResponse.json([]),
      ),
      http.post(`${API_BASE_URL}/classes/join`, async ({ request }) => {
        receivedBody = await request.json()
        joined = true
        return HttpResponse.json(joinedClass, { status: 201 })
      }),
    )

    renderRouter('/app/student/classes')

    expect(
      await screen.findByRole('heading', {
        name: 'Приєднатися до класу',
      }),
    ).toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: 'Код запрошення' }),
      'ABCD-EFGH',
    )
    await user.click(screen.getByRole('button', { name: 'Приєднатися' }))

    expect(
      await screen.findByRole('heading', { name: '7-Б', level: 1 }),
    ).toBeInTheDocument()
    expect(receivedBody).toEqual({ code: 'ABCD-EFGH' })
    expect(useSessionStore.getState().user?.profile.displayName).toBe('Іван')
  })

  it('keeps the real teacher profile inside the sidebar shell and saves it', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown
    const teacherUser = {
      ...authenticatedUser,
      email: 'teacher@example.com',
      role: 'TEACHER' as const,
    }
    useSessionStore.setState({ user: teacherUser })
    server.use(
      http.patch(
        `${API_BASE_URL}/users/me/profile`,
        async ({ request }) => {
          receivedBody = await request.json()

          return HttpResponse.json({
            ...teacherUser,
            profile: {
              ...teacherUser.profile,
              displayName: 'Олена Коваль',
              subjectArea: 'Історія України',
              bio: 'Допомагаю учням бачити зв’язки між подіями.',
            },
          })
        },
      ),
    )

    renderRouter('/app/teacher/profile')

    expect(
      await screen.findByRole('heading', { name: 'Профіль учителя' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Профіль' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('textbox', { name: 'Електронна пошта' }),
    ).toHaveValue('teacher@example.com')
    expect(
      screen.getByRole('textbox', { name: 'Електронна пошта' }),
    ).toHaveAttribute('readonly')

    const nameInput = screen.getByRole('textbox', {
      name: 'Ім’я та прізвище',
    })
    await user.clear(nameInput)
    await user.type(nameInput, 'О')
    await user.click(screen.getByRole('button', { name: 'Зберегти зміни' }))

    expect(
      await screen.findByText(
        'Ім’я має містити щонайменше 2 символи.',
      ),
    ).toBeInTheDocument()
    expect(receivedBody).toBeUndefined()

    await user.clear(nameInput)
    await user.type(nameInput, 'Олена Коваль')
    await user.type(
      screen.getByRole('textbox', {
        name: 'Предмет або спеціалізація',
      }),
      'Історія України',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Коротко про себе' }),
      'Допомагаю учням бачити зв’язки між подіями.',
    )
    await user.click(screen.getByRole('button', { name: 'Зберегти зміни' }))

    expect(await screen.findByText('Зміни збережено.')).toBeInTheDocument()
    expect(receivedBody).toEqual({
      bio: 'Допомагаю учням бачити зв’язки між подіями.',
      displayName: 'Олена Коваль',
      subjectArea: 'Історія України',
    })
    expect(useSessionStore.getState().user?.profile).toMatchObject({
      bio: 'Допомагаю учням бачити зв’язки між подіями.',
      displayName: 'Олена Коваль',
      subjectArea: 'Історія України',
    })
  })

  it('renders the parent onboarding without a sidebar when no child is linked', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'PARENT' },
    })

    renderRouter('/app/parent')

    expect(
      await screen.findByRole('link', { name: 'Батьківський простір Obriy' }),
    ).toHaveAttribute('href', '/app/parent')
    expect(
      await screen.findByRole('heading', {
        name: 'Підключіть профіль дитини',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Підключити дитину' }),
    ).toHaveAttribute('href', '/app/parent/connect')
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Основна навігація' }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('link', { name: 'Підключити дитину' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Немає активного запрошення',
      }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/app/parent/connect',
    )
  })

  it('creates a one-time parent invitation from the student profile', async () => {
    const user = userEvent.setup()
    const invitationToken = 'A'.repeat(43)
    let createRequestCount = 0
    server.use(
      http.get(`${API_BASE_URL}/parent-links/me/guardians`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/parent-links/invitation`, () =>
        HttpResponse.json(null),
      ),
      http.post(`${API_BASE_URL}/parent-links/invitation`, () => {
        createRequestCount += 1
        return HttpResponse.json(
          {
            token: invitationToken,
            expiresAt: '2026-08-02T12:00:00.000Z',
          },
          { status: 201 },
        )
      }),
    )

    renderRouter('/app/student/profile')

    expect(
      await screen.findByRole('heading', { name: 'Батьки та опікуни' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Створити запрошення' }),
    )

    expect(
      await screen.findByDisplayValue(
        `http://localhost:3000/parent-invite?token=${invitationToken}`,
      ),
    ).toBeInTheDocument()
    expect(createRequestCount).toBe(1)
  })

  it('preserves a parent invitation before authentication', async () => {
    const invitationToken = 'B'.repeat(43)
    useSessionStore.setState({
      accessToken: null,
      status: 'anonymous',
      user: null,
    })

    renderRouter(`/parent-invite?token=${invitationToken}`)

    expect(
      await screen.findByRole('heading', {
        name: 'Вас запросили до Obriy',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Увійти' })).toHaveAttribute(
      'href',
      '/auth/login',
    )
    expect(
      screen.getByRole('link', { name: /Створити профіль батька/ }),
    ).toHaveAttribute('href', '/auth/register/parent')
    expect(getPendingParentInvitation()).toBe(invitationToken)
  })

  it('returns an authenticated parent to the pending invitation', async () => {
    const invitationToken = 'D'.repeat(43)
    rememberParentInvitation(invitationToken)
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'PARENT' },
    })
    server.use(
      http.post(`${API_BASE_URL}/parent-links/invitation/preview`, () =>
        HttpResponse.json({
          child: {
            id: 'child-return',
            displayName: 'Софія',
            avatarUrl: null,
          },
          alreadyLinked: false,
        }),
      ),
    )

    renderRouter('/app')

    await waitFor(() => {
      expect(screen.getByTestId('current-location')).toHaveTextContent(
        '/app/parent/connect',
      )
    })
    expect(
      await screen.findByRole('heading', { name: 'Софія' }),
    ).toBeInTheDocument()
  })

  it('lets a parent confirm the stored invitation and opens the child overview', async () => {
    const user = userEvent.setup()
    const invitationToken = 'C'.repeat(43)
    const linkedChild = {
      id: 'child-invited',
      displayName: 'Марія',
      avatarUrl: null,
    }
    let children: typeof linkedChild[] = []
    rememberParentInvitation(invitationToken)
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'PARENT' },
    })
    server.use(
      http.get(`${API_BASE_URL}/users/me/children`, () =>
        HttpResponse.json(children),
      ),
      http.post(`${API_BASE_URL}/parent-links/invitation/preview`, () =>
        HttpResponse.json({
          child: {
            id: linkedChild.id,
            displayName: linkedChild.displayName,
            avatarUrl: linkedChild.avatarUrl,
          },
          alreadyLinked: false,
        }),
      ),
      http.post(`${API_BASE_URL}/parent-links/invitation/accept`, () => {
        children = [linkedChild]
        return HttpResponse.json(linkedChild, { status: 201 })
      }),
      http.get(`${API_BASE_URL}/parent/dashboard`, () =>
        HttpResponse.json({
          children: children.map((child) =>
            dashboardChild(child.id, child.displayName),
          ),
        }),
      ),
    )

    renderRouter('/app/parent/connect')

    expect(
      await screen.findByRole('heading', { name: 'Марія' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Підключити дитину' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Марія' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/app/parent',
    )
    expect(getPendingParentInvitation()).toBeNull()
  })

  it('opens the child overview from a single-child dashboard', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'PARENT' },
    })
    server.use(
      http.get(`${API_BASE_URL}/users/me/children`, () =>
        HttpResponse.json([
          {
            id: 'child-1',
            displayName: 'Марія',
            avatarUrl: null,
          },
        ]),
      ),
      http.get(`${API_BASE_URL}/parent/dashboard`, () =>
        HttpResponse.json({
          children: [dashboardChild('child-1', 'Марія')],
        }),
      ),
      http.get(`${API_BASE_URL}/parent/children/child-1/overview`, () =>
        HttpResponse.json(childOverview('child-1', 'Марія')),
      ),
      http.get(`${API_BASE_URL}/parent/children/child-1/progress`, () =>
        HttpResponse.json(childProgress('child-1', 'Марія')),
      ),
    )

    renderRouter('/app/parent')

    expect(
      await screen.findByRole('heading', { name: 'Навчання ваших дітей' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /Марія/ }))
    expect(
      await screen.findByRole('heading', { name: 'Марія', level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Потребує уваги' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Наступні роботи' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Докладний прогрес' }),
    ).toHaveAttribute('href', '/app/parent/child/child-1/progress')
    expect(
      screen.getByTestId('current-location'),
    ).toHaveTextContent('/app/parent/child/child-1')

    await user.click(
      screen.getByRole('link', { name: 'Докладний прогрес' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Прогрес: Марія' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/app/parent/child/child-1/progress',
    )
  })

  it('shows a family overview and child switcher for multiple linked children', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      user: { ...authenticatedUser, role: 'PARENT' },
    })
    server.use(
      http.get(`${API_BASE_URL}/users/me/children`, () =>
        HttpResponse.json([
          {
            id: 'child-1',
            displayName: 'Марія',
            avatarUrl: null,
          },
          {
            id: 'child-2',
            displayName: 'Остап',
            avatarUrl: null,
          },
        ]),
      ),
      http.get(`${API_BASE_URL}/parent/dashboard`, () =>
        HttpResponse.json({
          children: [
            dashboardChild('child-1', 'Марія'),
            dashboardChild('child-2', 'Остап'),
          ],
        }),
      ),
      http.get(`${API_BASE_URL}/parent/children/child-1/overview`, () =>
        HttpResponse.json(childOverview('child-1', 'Марія')),
      ),
    )

    renderRouter('/app/parent')

    expect(
      await screen.findByRole('heading', {
        name: 'Навчання ваших дітей',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Марія/ }))

    expect(
      await screen.findByRole('heading', { name: 'Марія' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Дитина' }),
    ).toHaveValue('child-1')
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/app/parent/child/child-1',
    )
  })
})

function renderRouter(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRouter />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function dashboardChild(
  id: string,
  displayName: string,
) {
  return {
    id,
    displayName,
    avatarUrl: null,
    class: { id: 'class-1', name: '7-А' },
    metrics: {
      requiredReleaseCount: 0,
      completedCount: 0,
      completionPercent: null,
      averagePercent: null,
      attentionCount: 0,
      nextDueAt: null,
    },
  }
}

function childOverview(
  id: string,
  displayName: string,
) {
  return {
    child: dashboardChild(id, displayName),
    attention: [],
    upcoming: [],
    recentActivity: [],
  }
}

function childProgress(
  id: string,
  displayName: string,
) {
  return {
    child: dashboardChild(id, displayName),
    lessons: [],
  }
}

function LocationProbe() {
  const location = useLocation()

  return <output data-testid="current-location">{location.pathname}</output>
}
