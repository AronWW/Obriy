import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import { useSessionStore } from '../../auth/model/session.store'
import { TeacherLessonEditorPage } from './TeacherLessonEditorPage'
import { TeacherLessonsPage } from './TeacherLessonsPage'

const teacher = {
  id: 'teacher-1',
  email: 'teacher@example.com',
  role: 'TEACHER' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: '2026-08-01T10:00:00.000Z',
  profile: {
    displayName: 'Olena Koval',
    avatarUrl: null,
    bio: null,
    gradeLevel: null,
    subjectArea: 'History',
    preferredLocale: 'UK' as const,
  },
}

describe('teacher lesson workspace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({
      accessToken: 'access-token',
      status: 'authenticated',
      user: teacher,
    })
    server.use(
      http.get(`${API_BASE_URL}/lessons/:lessonId/tasks`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/lessons/:lessonId/task-submissions`, () =>
        HttpResponse.json([]),
      ),
    )
  })

  it('renders large library rows and confirms archive inside the app', async () => {
    const user = userEvent.setup()
    let archiveCount = 0
    const lesson = lessonDetail({ status: 'PUBLISHED' })

    server.use(
      http.get(`${API_BASE_URL}/lessons`, () =>
        HttpResponse.json([{ ...lesson, content: undefined }]),
      ),
      http.post(`${API_BASE_URL}/lessons/lesson-1/archive`, () => {
        archiveCount += 1
        return HttpResponse.json({ ...lesson, status: 'ARCHIVED' })
      }),
    )

    renderLessonRoute(<TeacherLessonsPage />)

    expect(
      await screen.findByRole('heading', { name: 'The Ukrainian Revolution' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Grade 9-A')).toBeInTheDocument()
    expect(screen.getAllByText('Published')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Archive' }))
    const dialog = screen.getByRole('dialog', { name: 'Archive this lesson?' })
    expect(dialog).toBeInTheDocument()
    expect(archiveCount).toBe(0)

    await user.click(within(dialog).getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(archiveCount).toBe(1))
  })

  it('does not create an empty draft and autosaves after text input', async () => {
    let createCount = 0
    let receivedBody: unknown
    const createdLesson = lessonDetail({
      classLinks: [],
      content: '',
      status: 'DRAFT',
      summary: '',
      title: 'The first settlement',
    })

    server.use(
      http.get(`${API_BASE_URL}/classes`, () => HttpResponse.json([])),
      http.post(`${API_BASE_URL}/lessons`, async ({ request }) => {
        createCount += 1
        receivedBody = await request.json()
        return HttpResponse.json(createdLesson, { status: 201 })
      }),
      http.get(`${API_BASE_URL}/lessons/lesson-1`, () =>
        HttpResponse.json(createdLesson),
      ),
    )

    renderLessonEditor('/app/teacher/lessons/new')

    await pauseForAutosave()
    expect(createCount).toBe(0)
    expect(
      screen.queryByRole('combobox', { name: 'Material language' }),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: /^Lesson title/ }), {
      target: { value: 'The first settlement' },
    })

    await waitFor(() => expect(createCount).toBe(1), { timeout: 3000 })
    expect(receivedBody).toEqual({
      content: '',
      contentLocale: 'UK',
      estimatedMinutes: null,
      summary: '',
      title: 'The first settlement',
    })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('keeps published edits local until the teacher explicitly saves', async () => {
    const user = userEvent.setup()
    let patchCount = 0
    let releaseFirstPatch: (() => void) | undefined
    const firstPatchGate = new Promise<void>((resolve) => {
      releaseFirstPatch = resolve
    })
    const lesson = lessonDetail({ status: 'PUBLISHED' })

    server.use(
      http.get(`${API_BASE_URL}/lessons/lesson-1`, () =>
        HttpResponse.json(lesson),
      ),
      http.get(`${API_BASE_URL}/classes`, () => HttpResponse.json([])),
      http.patch(`${API_BASE_URL}/lessons/lesson-1`, async ({ request }) => {
        patchCount += 1
        const body = (await request.json()) as Record<string, unknown>
        if (patchCount === 1) {
          await firstPatchGate
        }
        return HttpResponse.json({ ...lesson, ...body })
      }),
    )

    renderLessonEditor('/app/teacher/lessons/lesson-1/edit')

    const titleInput = await screen.findByRole('textbox', {
      name: /^Lesson title/,
    })
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated revolution lesson')
    await pauseForAutosave()
    expect(patchCount).toBe(0)

    await user.click(screen.getAllByRole('button', { name: 'Save changes' })[0])
    await waitFor(() => expect(patchCount).toBe(1))
    await user.type(titleInput, ' typed during save')
    releaseFirstPatch?.()
    await pauseForAutosave()
    expect(patchCount).toBe(1)

    await user.click(screen.getAllByRole('button', { name: 'Save changes' })[0])
    await waitFor(() => expect(patchCount).toBe(2))
  })

  it('keeps the created draft id when a later autosave fails', async () => {
    let createCount = 0
    let patchCount = 0
    let releaseCreate: (() => void) | undefined
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve
    })
    const createdLesson = lessonDetail({
      classLinks: [],
      content: '',
      status: 'DRAFT',
      summary: '',
      title: 'First title',
    })

    server.use(
      http.get(`${API_BASE_URL}/classes`, () => HttpResponse.json([])),
      http.post(`${API_BASE_URL}/lessons`, async () => {
        createCount += 1
        await createGate
        return HttpResponse.json(createdLesson, { status: 201 })
      }),
      http.get(`${API_BASE_URL}/lessons/lesson-1`, () =>
        HttpResponse.json(createdLesson),
      ),
      http.patch(`${API_BASE_URL}/lessons/lesson-1`, async ({ request }) => {
        patchCount += 1
        if (patchCount === 1) {
          return HttpResponse.json(
            { code: 'SAVE_FAILED', message: 'Save failed' },
            { status: 500 },
          )
        }
        const body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...createdLesson, ...body })
      }),
    )

    renderLessonEditor('/app/teacher/lessons/new')
    const titleInput = await screen.findByRole('textbox', {
      name: /^Lesson title/,
    })

    fireEvent.change(titleInput, { target: { value: 'First title' } })
    await waitFor(() => expect(createCount).toBe(1), { timeout: 3000 })
    fireEvent.change(titleInput, { target: { value: 'Newer title' } })
    releaseCreate?.()

    await waitFor(() => expect(patchCount).toBe(1), { timeout: 4000 })
    await pauseForAutosave()
    expect(patchCount).toBe(1)
    expect(createCount).toBe(1)

    fireEvent.change(titleInput, { target: { value: 'Final title' } })
    await waitFor(() => expect(patchCount).toBe(2), { timeout: 3000 })
    expect(createCount).toBe(1)
  })

  it('shows an unlink failure inside its confirmation dialog', async () => {
    const user = userEvent.setup()
    const lesson = lessonDetail()

    server.use(
      http.get(`${API_BASE_URL}/lessons/lesson-1`, () =>
        HttpResponse.json(lesson),
      ),
      http.get(`${API_BASE_URL}/classes`, () =>
        HttpResponse.json([
          {
            id: 'class-1',
            name: 'Grade 9-A',
            studentCount: 20,
            createdAt: '2026-08-01T10:00:00.000Z',
            updatedAt: '2026-08-01T10:00:00.000Z',
          },
        ]),
      ),
      http.delete(
        `${API_BASE_URL}/classes/class-1/lessons/lesson-1`,
        () =>
          HttpResponse.json(
            { code: 'UNLINK_FAILED', message: 'Unlink failed' },
            { status: 500 },
          ),
      ),
    )

    renderLessonEditor('/app/teacher/lessons/lesson-1/edit')

    await user.click(
      await screen.findByRole('button', {
        name: 'Remove from class Grade 9-A',
      }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Remove lesson from class?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
  })

  it('does not allow discarding while the first draft save is in flight', async () => {
    const user = userEvent.setup()
    let releaseCreate: (() => void) | undefined
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve
    })
    const createdLesson = lessonDetail({
      classLinks: [],
      content: '',
      summary: '',
      title: 'Pending draft',
    })

    server.use(
      http.get(`${API_BASE_URL}/classes`, () => HttpResponse.json([])),
      http.post(`${API_BASE_URL}/lessons`, async () => {
        await createGate
        return HttpResponse.json(createdLesson, { status: 201 })
      }),
      http.get(`${API_BASE_URL}/lessons/lesson-1`, () =>
        HttpResponse.json(createdLesson),
      ),
    )

    renderLessonEditor('/app/teacher/lessons/new')
    fireEvent.change(
      await screen.findByRole('textbox', { name: /^Lesson title/ }),
      { target: { value: 'Pending draft' } },
    )
    await screen.findByRole(
      'button',
      { name: 'Saving…' },
      { timeout: 3000 },
    )
    await user.click(
      screen.getByRole('button', { name: 'Back to lesson library' }),
    )

    const dialog = screen.getByRole('alertdialog', {
      name: 'Leave without saving?',
    })
    expect(
      within(dialog).getByRole('button', { name: 'Leave without saving' }),
    ).toBeDisabled()

    releaseCreate?.()
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })
})

function renderLessonRoute(element: React.ReactNode) {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderLessonEditor(initialEntry: string) {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/app/teacher/lessons/new"
            element={<TeacherLessonEditorPage />}
          />
          <Route
            path="/app/teacher/lessons/:lessonId/edit"
            element={<TeacherLessonEditorPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
}

function lessonDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lesson-1',
    title: 'The Ukrainian Revolution',
    summary: 'A concise introduction to the events of 1917–1921.',
    content: 'First paragraph.\n\nSecond paragraph.',
    contentLocale: 'EN',
    estimatedMinutes: 20,
    status: 'DRAFT',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T11:00:00.000Z',
    classLinks: [
      {
        classId: 'class-1',
        className: 'Grade 9-A',
        position: 0,
        publishedAt: '2026-08-01T11:30:00.000Z',
      },
    ],
    ...overrides,
  }
}

function pauseForAutosave() {
  return new Promise((resolve) => window.setTimeout(resolve, 1150))
}
