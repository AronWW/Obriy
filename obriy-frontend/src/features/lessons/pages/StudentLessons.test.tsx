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
import type {
  StudentAssignmentAttempt,
  StudentLessonAssignment,
} from '../../assignments/model/assignment.types'
import { StudentClassesPage } from '../../classes/pages/StudentClassesPage'
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
        `${API_BASE_URL}/classes/me/lessons/:lessonId/assignments`,
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
      await screen.findByText('There are no assignments for this lesson yet.'),
    ).toBeInTheDocument()
  })

  it('autosaves a written answer, submits it, and then locks editing', async () => {
    const user = userEvent.setup()
    const savedBodies: string[] = []
    const submittedBodies: string[] = []
    const assignment = studentAssignment()

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
        `${API_BASE_URL}/classes/me/lessons/lesson-1/assignments`,
        () => HttpResponse.json([assignment]),
      ),
      http.put(
        `${API_BASE_URL}/assignment-releases/release-1/draft`,
        async ({ request }) => {
          const body = (await request.json()) as { text: string }
          savedBodies.push(body.text)
          return HttpResponse.json(
            studentAttempt({ responseText: body.text }),
          )
        },
      ),
      http.post(
        `${API_BASE_URL}/assignment-releases/release-1/submit`,
        async ({ request }) => {
          const body = (await request.json()) as { text: string }
          submittedBodies.push(body.text)
          return HttpResponse.json(
            studentAttempt({
              responseText: body.text,
              status: 'AWAITING_REVIEW',
              submittedAt: '2026-08-13T12:00:00.000Z',
            }),
          )
        },
      ),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    expect(
      await screen.findByRole('heading', { name: 'Historical reflection' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    const answer = await screen.findByRole('textbox', {
      name: /Your answer/,
    })
    await user.type(answer, 'My reasoned answer')

    await waitFor(() => expect(savedBodies).toEqual(['My reasoned answer']), {
      timeout: 2_500,
    })
    expect(screen.getByText('Draft saved')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    await waitFor(() =>
      expect(submittedBodies).toEqual(['My reasoned answer']),
    )
    expect(answer).toBeDisabled()
    expect(screen.getByText('Answer submitted')).toBeInTheDocument()
    expect(screen.getAllByText('Awaiting review').length).toBeGreaterThan(0)
  })

  it('shows the reviewed score and teacher feedback to the student', async () => {
    const user = userEvent.setup()
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
        `${API_BASE_URL}/classes/me/lessons/lesson-1/assignments`,
        () =>
          HttpResponse.json([
            studentAssignment({
              stateStatus: 'COMPLETED',
              attempt: studentAttempt({
                status: 'GRADED',
                responseText: 'My reviewed answer',
                teacherComment: 'Strong explanation.',
                scorePoints: 3,
                scorePercent: 60,
                isPassed: true,
                submittedAt: '2026-08-13T12:00:00.000Z',
                reviewedAt: '2026-08-13T13:00:00.000Z',
              }),
            }),
          ]),
      ),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    await user.click(await screen.findByRole('button', { name: 'View answer' }))
    expect(screen.getByText('3 / 5 points')).toBeInTheDocument()
    expect(screen.getByText(/60%.*passing result/)).toBeInTheDocument()
    expect(screen.getByText('Strong explanation.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Your answer/ })).toBeDisabled()
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

function studentAssignment(
  overrides: Partial<StudentLessonAssignment> = {},
): StudentLessonAssignment {
  return {
    releaseId: 'release-1',
    assignmentId: 'assignment-1',
    revisionId: 'revision-1',
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
    maxPoints: 5,
    passingPercent: 60,
    isRequired: true,
    dueAt: null,
    stateStatus: 'NOT_STARTED',
    attempt: null,
    ...overrides,
  }
}

function studentAttempt(
  overrides: Partial<StudentAssignmentAttempt> = {},
): StudentAssignmentAttempt {
  return {
    id: 'attempt-1',
    attemptNumber: 1,
    status: 'IN_PROGRESS',
    responseText: '',
    teacherComment: null,
    scorePoints: null,
    scorePercent: null,
    isPassed: null,
    submittedAt: null,
    reviewedAt: null,
    updatedAt: '2026-08-13T12:00:00.000Z',
    ...overrides,
  }
}
