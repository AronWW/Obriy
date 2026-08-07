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
  StudentLessonProgress,
  StudentLessonTask,
  StudentTaskSubmission,
} from '../model/lesson-task.types'
import type { StudentLessonSummary } from '../model/lesson.types'
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
              approved: 2,
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
    expect(screen.getByText('Material without assignments')).toBeInTheDocument()
  })

  it('submits, locks, and resubmits answers from their derived states', async () => {
    const user = userEvent.setup()
    const submittedBodies: Array<{ answerText: string; taskId: string }> = []
    const detail = {
      ...studentLesson({
        progress: studentProgress({
          approved: 1,
          requiredTotal: 4,
          returned: 1,
          status: 'IN_PROGRESS',
          submitted: 1,
        }),
      }),
      content: 'Read this lesson before answering.',
      class: { id: 'class-1', name: 'Grade 9-A' },
      teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
      tasks: [
        studentTask({ id: 'task-new', title: 'New answer' }),
        studentTask({
          id: 'task-returned',
          title: 'Revise this',
          submission: studentSubmission({
            answerText: 'First attempt',
            id: 'submission-returned',
            status: 'RETURNED',
            taskId: 'task-returned',
            teacherComment: 'Add one concrete example.',
          }),
        }),
        studentTask({
          id: 'task-review',
          title: 'Waiting answer',
          submission: studentSubmission({
            answerText: 'Waiting for review',
            id: 'submission-review',
            status: 'SUBMITTED',
            taskId: 'task-review',
          }),
        }),
        studentTask({
          id: 'task-approved',
          title: 'Approved answer',
          submission: studentSubmission({
            answerText: 'Already approved',
            id: 'submission-approved',
            status: 'APPROVED',
            taskId: 'task-approved',
          }),
        }),
      ],
    }

    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json(detail),
      ),
      http.get(`${API_BASE_URL}/classes/me/lessons`, () =>
        HttpResponse.json([detail]),
      ),
      http.put(
        `${API_BASE_URL}/classes/me/lessons/lesson-1/tasks/:taskId/submission`,
        async ({ params, request }) => {
          const body = (await request.json()) as { answerText: string }
          const taskId = String(params.taskId)
          submittedBodies.push({ answerText: body.answerText, taskId })
          const submission = studentSubmission({
            answerText: body.answerText,
            id: `submission-${taskId}`,
            status: 'SUBMITTED',
            taskId,
          })
          const task = detail.tasks.find((item) => item.id === taskId)
          if (task) {
            task.submission = submission
          }
          return HttpResponse.json(submission)
        },
      ),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    const newTask = (await screen.findByRole('heading', { name: 'New answer' }))
      .closest('li')
    expect(newTask).not.toBeNull()
    await user.type(
      within(newTask!).getByRole('textbox', { name: 'Your answer' }),
      'My new answer',
    )
    await user.click(
      within(newTask!).getByRole('button', { name: 'Submit for review' }),
    )
    await waitFor(() => expect(submittedBodies).toHaveLength(1))
    expect(submittedBodies[0]).toEqual({
      answerText: 'My new answer',
      taskId: 'task-new',
    })

    const returnedTask = screen
      .getByRole('heading', { name: 'Revise this' })
      .closest('li')
    expect(
      within(returnedTask!).getByText('Add one concrete example.'),
    ).toBeInTheDocument()
    const reviseInput = within(returnedTask!).getByRole('textbox', {
      name: 'Revise your answer',
    })
    await user.clear(reviseInput)
    await user.type(reviseInput, 'Revised with a concrete example')
    await user.click(
      within(returnedTask!).getByRole('button', { name: 'Submit again' }),
    )
    await waitFor(() => expect(submittedBodies).toHaveLength(2))
    expect(submittedBodies[1]).toEqual({
      answerText: 'Revised with a concrete example',
      taskId: 'task-returned',
    })

    const approvedTask = screen
      .getByRole('heading', { name: 'Approved answer' })
      .closest('li')
    expect(within(approvedTask!).getByText('Approved')).toBeInTheDocument()
    expect(within(approvedTask!).queryByRole('textbox')).toBeNull()
    expect(screen.getByText('1 of 4 approved')).toBeInTheDocument()
  })

  it('refreshes stale lesson data when the server says an answer is already approved', async () => {
    const user = userEvent.setup()
    let approvedOnServer = false

    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json({
          ...studentLesson({
            progress: studentProgress({
              approved: approvedOnServer ? 1 : 0,
              requiredTotal: 1,
              status: approvedOnServer ? 'COMPLETED' : 'NOT_STARTED',
            }),
          }),
          content: 'Read before answering.',
          class: { id: 'class-1', name: 'Grade 9-A' },
          teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
          tasks: [
            studentTask({
              id: 'task-conflict',
              title: 'Already reviewed',
              submission: approvedOnServer
                ? studentSubmission({
                    answerText: 'Approved in another session',
                    id: 'submission-conflict',
                    status: 'APPROVED',
                    taskId: 'task-conflict',
                  })
                : null,
            }),
          ],
        }),
      ),
      http.put(
        `${API_BASE_URL}/classes/me/lessons/lesson-1/tasks/task-conflict/submission`,
        () => {
          approvedOnServer = true
          return HttpResponse.json(
            {
              statusCode: 409,
              code: 'TASK_SUBMISSION_APPROVED',
              message: 'This answer has already been approved.',
            },
            { status: 409 },
          )
        },
      ),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    const task = (
      await screen.findByRole('heading', { name: 'Already reviewed' })
    ).closest('li')
    expect(task).not.toBeNull()
    await user.type(
      within(task!).getByRole('textbox', { name: 'Your answer' }),
      'Stale local answer',
    )
    await user.click(
      within(task!).getByRole('button', { name: 'Submit for review' }),
    )

    await waitFor(() =>
      expect(within(task!).queryByRole('textbox')).not.toBeInTheDocument(),
    )
    expect(within(task!).getByText('Approved')).toBeInTheDocument()
    expect(
      within(task!).getByText('Approved in another session'),
    ).toBeInTheDocument()
  })

  it('still renders optional tasks when there are no required tasks', async () => {
    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json({
          ...studentLesson(),
          content: 'Optional practice follows.',
          class: { id: 'class-1', name: 'Grade 9-A' },
          teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
          progress: studentProgress({ status: 'NO_TASKS' }),
          tasks: [
            studentTask({
              id: 'task-optional',
              isRequired: false,
              title: 'Optional reflection',
            }),
          ],
        }),
      ),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    expect(
      await screen.findByRole('heading', { name: 'Optional reflection' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No required assignments')).toBeInTheDocument()
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
): StudentLessonSummary & { tasks: [] } {
  return {
    id: 'lesson-1',
    title: 'First settlement',
    summary: 'A concise introduction to the first settlement.',
    contentLocale: 'EN',
    estimatedMinutes: 20,
    position: 0,
    progress: studentProgress(),
    tasks: [],
    ...overrides,
  }
}

function studentProgress(
  overrides: Partial<StudentLessonProgress> = {},
): StudentLessonProgress {
  return {
    status: 'NO_TASKS',
    requiredTotal: 0,
    approved: 0,
    submitted: 0,
    returned: 0,
    ...overrides,
  }
}

function studentTask(
  overrides: Partial<StudentLessonTask> = {},
): StudentLessonTask {
  return {
    id: 'task-1',
    title: 'Explain the event',
    prompt: 'Explain the event in two or three sentences.',
    position: 0,
    isRequired: true,
    submission: null,
    ...overrides,
  }
}

function studentSubmission(
  overrides: Partial<StudentTaskSubmission> = {},
): StudentTaskSubmission {
  return {
    id: 'submission-1',
    taskId: 'task-1',
    answerText: 'Student answer',
    status: 'SUBMITTED',
    teacherComment: null,
    submittedAt: '2026-08-01T12:00:00.000Z',
    reviewedAt: null,
    updatedAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  }
}
