import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import { useSessionStore } from '../../auth/model/session.store'
import { StudentClassesPage } from '../../classes/pages/StudentClassesPage'
import type {
  StudentLessonTest,
  StudentTestAnswer,
  StudentTestAttempt,
} from '../../tests/model/test.types'
import type {
  StudentLessonProgress,
  StudentLessonSummary,
} from '../model/lesson.types'
import { StudentLessonReaderPage } from './StudentLessonReaderPage'

const student = {
  id: 'student-1',
  email: 'student@example.com',
  role: 'STUDENT' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: '2026-08-01T10:00:00.000Z',
  profile: {
    displayName: 'Maksym Bondar',
    avatarUrl: null,
    bio: null,
    gradeLevel: 9,
    subjectArea: null,
    preferredLocale: 'EN' as const,
  },
}

describe('student lessons', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSessionStore.setState({
      accessToken: 'student-access-token',
      status: 'authenticated',
      user: student,
    })
    server.use(
      http.get(
        `${API_BASE_URL}/classes/me/lessons/:lessonId/tests`,
        () => HttpResponse.json([]),
      ),
    )
  })

  it('shows wide lesson rows before classmates and omits a missing duration', async () => {
    server.use(
      http.get(`${API_BASE_URL}/classes/me`, () =>
        HttpResponse.json(studentClass()),
      ),
      http.get(`${API_BASE_URL}/classes/me/classmates`, () =>
        HttpResponse.json([
          {
            id: 'student-2',
            displayName: 'Sofiia Melnyk',
            avatarUrl: null,
            gradeLevel: 9,
          },
        ]),
      ),
      http.get(`${API_BASE_URL}/classes/me/lessons`, () =>
        HttpResponse.json([
          studentLesson({
            id: 'lesson-1',
            title: 'First settlement',
            estimatedMinutes: null,
            position: 0,
            progress: studentProgress({
              requiredTotal: 2,
              status: 'NOT_STARTED',
            }),
          }),
          studentLesson({
            id: 'lesson-2',
            title: 'The Ukrainian Revolution',
            estimatedMinutes: 25,
            position: 1,
            progress: studentProgress({
              completed: 2,
              requiredTotal: 2,
              status: 'COMPLETED',
            }),
          }),
        ]),
      ),
    )

    renderStudentClass()

    const lessonsHeading = await screen.findByRole('heading', {
      name: 'Lessons',
    })
    const classmatesHeading = await screen.findByRole('heading', {
      name: 'Classmates',
    })
    expect(
      lessonsHeading.compareDocumentPosition(classmatesHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const firstLesson = screen
      .getByRole('heading', { name: 'First settlement' })
      .closest('li')
    expect(firstLesson).not.toBeNull()
    expect(within(firstLesson!).queryByText(/min$/)).not.toBeInTheDocument()
    expect(within(firstLesson!).getByText('0/2 · Not started')).toBeInTheDocument()
    expect(
      within(firstLesson!).getByRole('link', {
        name: 'Open lesson “First settlement”',
      }),
    ).toHaveAttribute('href', '/app/student/lessons/lesson-1')

    const secondLesson = screen
      .getByRole('heading', { name: 'The Ukrainian Revolution' })
      .closest('li')
    expect(within(secondLesson!).getByText('25 min')).toBeInTheDocument()
    expect(within(secondLesson!).getByText('2/2 · Completed')).toBeInTheDocument()
  })

  it('keeps the class page useful when no lessons have been published', async () => {
    server.use(
      http.get(`${API_BASE_URL}/classes/me`, () =>
        HttpResponse.json(studentClass()),
      ),
      http.get(`${API_BASE_URL}/classes/me/classmates`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/classes/me/lessons`, () =>
        HttpResponse.json([]),
      ),
    )

    renderStudentClass()

    expect(
      await screen.findByRole('heading', {
        name: 'No published lessons yet',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A material will appear here when your teacher opens it.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Classmates' }),
    ).toBeInTheDocument()
  })

  it('renders lesson content as plain text with class and teacher context', async () => {
    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json({
          ...studentLesson({ estimatedMinutes: null }),
          content:
            '<strong>This stays text</strong>\n\nA second paragraph.\nWith another line.',
          class: { id: 'class-1', name: 'Grade 9-A' },
          teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
        }),
      ),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    expect(
      await screen.findByRole('heading', { name: 'First settlement', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Grade 9-A')).toBeInTheDocument()
    expect(screen.getByText('Olena Koval')).toBeInTheDocument()
    expect(screen.queryByText(/min$/)).not.toBeInTheDocument()

    const content = screen.getByTestId('lesson-content')
    expect(
      within(content).getByText('<strong>This stays text</strong>'),
    ).toBeInTheDocument()
    expect(content.querySelector('strong')).toBeNull()
    expect(within(content).getAllByRole('paragraph')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Back to class' })).toHaveAttribute(
      'href',
      '/app/student/classes',
    )
    expect(
      await screen.findByText('No knowledge checks have been added to this lesson yet.'),
    ).toBeInTheDocument()
  })

  it('autosaves a written answer and submits the whole test attempt', async () => {
    const user = userEvent.setup()
    const savedBodies: unknown[] = []
    let submitted = false
    let test = studentTest()

    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json({
          ...studentLesson(),
          content: 'Read this lesson before answering.',
          class: { id: 'class-1', name: 'Grade 9-A' },
          teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
        }),
      ),
      http.get(
        `${API_BASE_URL}/classes/me/lessons/lesson-1/tests`,
        () => HttpResponse.json([test]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () =>
        HttpResponse.json(test),
      ),
      http.post(`${API_BASE_URL}/test-releases/release-1/attempts`, () => {
        const attempt = studentTestAttempt()
        test = { ...test, stateStatus: 'IN_PROGRESS', attempt }
        return HttpResponse.json(attempt)
      }),
      http.put(
        `${API_BASE_URL}/test-attempts/attempt-1/answers/item-1`,
        async ({ request }) => {
          const body = await request.json()
          savedBodies.push(body)
          const responseData = (body as { responseData: Record<string, unknown> }).responseData
          const attempt = studentTestAttempt({
            answers: [studentTestAnswer({ responseData })],
          })
          test = { ...test, attempt }
          return HttpResponse.json(attempt)
        },
      ),
      http.post(`${API_BASE_URL}/test-attempts/attempt-1/submit`, () => {
        submitted = true
        const attempt = studentTestAttempt({
          status: 'AWAITING_REVIEW',
          pendingReviewCount: 1,
          submittedAt: '2026-08-13T12:00:00.000Z',
          answers: [studentTestAnswer({ status: 'AWAITING_REVIEW', responseData: { text: 'My reasoned answer', attachmentIds: [] } })],
        })
        test = { ...test, stateStatus: 'AWAITING_REVIEW', attempt }
        return HttpResponse.json(attempt)
      }),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    expect(
      await screen.findByRole('heading', { name: 'History check' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    const dialog = await screen.findByRole('dialog', { name: 'History check' })
    await user.click(within(dialog).getByRole('button', { name: 'Start' }))
    const answer = await within(dialog).findByRole('textbox', { name: /Your answer/ })
    await user.type(answer, 'My reasoned answer')

    await waitFor(() => expect(savedBodies).toEqual([{ responseData: { text: 'My reasoned answer', attachmentIds: [] } }]), {
      timeout: 2_500,
    })
    expect(within(dialog).getByText('Answer saved')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Finish test' }))
    const confirm = screen.getByRole('dialog', { name: 'Finish this attempt?' })
    await user.click(within(confirm).getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(submitted).toBe(true))
    expect(await screen.findByText('Awaiting teacher review')).toBeInTheDocument()
  })

  it('shows the reviewed result for a completed test', async () => {
    const user = userEvent.setup()
    const completed = studentTest({
      stateStatus: 'COMPLETED',
      attempt: studentTestAttempt({
        status: 'GRADED',
        scorePoints: 3,
        scorePercent: 60,
        isPassed: true,
        submittedAt: '2026-08-13T12:00:00.000Z',
        gradedAt: '2026-08-13T13:00:00.000Z',
        answers: [
          studentTestAnswer({
            status: 'GRADED',
            responseData: { text: 'My reviewed answer', attachmentIds: [] },
            teacherComment: 'Strong explanation.',
            scorePoints: 3,
            scorePercent: 60,
            isCorrect: false,
          }),
        ],
      }),
    })
    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json({
          ...studentLesson(),
          content: 'Read this lesson before answering.',
          class: { id: 'class-1', name: 'Grade 9-A' },
          teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
        }),
      ),
      http.get(
        `${API_BASE_URL}/classes/me/lessons/lesson-1/tests`,
        () => HttpResponse.json([completed]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () => HttpResponse.json(completed)),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    await user.click(await screen.findByRole('button', { name: 'View' }))
    expect(screen.getAllByText('3 / 5 points')).toHaveLength(2)
    expect(screen.getByText(/3 \/ 5 points.*60%/)).toBeInTheDocument()
    expect(screen.getByText('Test passed')).toBeInTheDocument()
  })

  it('shows a stable unavailable state for an inaccessible lesson', async () => {
    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/hidden-lesson`, () =>
        HttpResponse.json(
          { code: 'LESSON_NOT_FOUND', message: 'Lesson not found' },
          { status: 404 },
        ),
      ),
    )

    renderStudentReader('/app/student/lessons/hidden-lesson')

    expect(
      await screen.findByRole('heading', { name: 'Lesson unavailable' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to class' })).toBeInTheDocument()
  })
})

function renderStudentClass() {
  return renderWithQueryClient(
    <MemoryRouter>
      <StudentClassesPage />
    </MemoryRouter>,
  )
}

function renderStudentReader(initialEntry: string) {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/app/student/lessons/:lessonId"
          element={<StudentLessonReaderPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function renderWithQueryClient(element: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  )
}

function studentClass() {
  return {
    id: 'class-1',
    name: 'Grade 9-A',
    studentCount: 20,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T11:00:00.000Z',
    teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
  }
}

function studentLesson(
  overrides: Partial<StudentLessonSummary> = {},
): StudentLessonSummary {
  return {
    id: 'lesson-1',
    title: 'First settlement',
    summary: 'A concise introduction to the first settlement.',
    contentLocale: 'EN',
    estimatedMinutes: 20,
    position: 0,
    progress: studentProgress(),
    ...overrides,
  }
}

function studentProgress(
  overrides: Partial<StudentLessonProgress> = {},
): StudentLessonProgress {
  return {
    status: 'NO_TASKS',
    requiredTotal: 0,
    completed: 0,
    awaitingReview: 0,
    needsRevision: 0,
    inProgress: 0,
    expired: 0,
    ...overrides,
  }
}

function studentTest(
  overrides: Partial<StudentLessonTest> = {},
): StudentLessonTest {
  return {
    releaseId: 'release-1',
    testId: 'test-1',
    testRevisionId: 'test-revision-1',
    title: 'History check',
    description: 'A short written check.',
    instructions: null,
    maxPoints: 5,
    passingPercent: 60,
    isRequired: true,
    maxAttempts: 1,
    timeLimitSeconds: null,
    dueAt: null,
    stateStatus: 'NOT_STARTED',
    itemCount: 1,
    items: [
      {
        id: 'item-1',
        position: 0,
        maxPoints: 5,
        assignmentId: 'assignment-1',
        assignmentRevisionId: 'revision-1',
        type: 'WRITTEN',
        title: 'Historical reflection',
        prompt: 'Explain why this event mattered.',
        instructions: null,
        publicConfig: {
          responseMode: 'LONG',
          minLength: 0,
          maxLength: 5_000,
          allowAttachments: false,
          rubric: [],
        },
      },
    ],
    attempt: null,
    ...overrides,
  }
}

function studentTestAttempt(
  overrides: Partial<StudentTestAttempt> = {},
): StudentTestAttempt {
  return {
    id: 'attempt-1',
    attemptNumber: 1,
    status: 'IN_PROGRESS',
    maxPoints: 5,
    scorePoints: null,
    scorePercent: null,
    isPassed: null,
    pendingReviewCount: 0,
    answers: [studentTestAnswer()],
    startedAt: '2026-08-13T11:00:00.000Z',
    expiresAt: null,
    submittedAt: null,
    gradedAt: null,
    ...overrides,
  }
}

function studentTestAnswer(
  overrides: Partial<StudentTestAnswer> = {},
): StudentTestAnswer {
  return {
    id: 'answer-1',
    testItemId: 'item-1',
    status: 'DRAFT',
    responseData: { text: '', attachmentIds: [] },
    maxPoints: 5,
    scorePoints: null,
    scorePercent: null,
    isCorrect: null,
    teacherComment: null,
    ...overrides,
  }
}
