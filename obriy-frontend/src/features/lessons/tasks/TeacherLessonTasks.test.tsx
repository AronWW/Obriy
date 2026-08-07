import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import { useSessionStore } from '../../auth/model/session.store'
import type {
  LessonTask,
  TeacherTaskSubmission,
} from '../model/lesson-task.types'
import { TeacherLessonTasks } from './TeacherLessonTasks'

const lessonId = 'lesson-1'

const task: LessonTask = {
  id: 'task-1',
  lessonId,
  title: 'Source analysis',
  prompt: 'Compare the two accounts and explain their differences.',
  position: 0,
  isRequired: true,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
}

const submission: TeacherTaskSubmission = {
  id: 'submission-1',
  taskId: task.id,
  taskTitle: task.title,
  taskPosition: task.position,
  taskIsRequired: task.isRequired,
  answerText: 'The authors describe the same event from opposing positions.',
  status: 'SUBMITTED',
  teacherComment: null,
  submittedAt: '2026-08-01T10:00:00.000Z',
  reviewedAt: null,
  updatedAt: '2026-08-01T10:00:00.000Z',
  student: { id: 'student-1', displayName: 'Iryna Bondar' },
  class: { id: 'class-1', name: 'Grade 9-A' },
}

describe('TeacherLessonTasks', () => {
  beforeEach(async () => {
    addTestTranslations()
    await i18n.changeLanguage('en')
    useSessionStore.setState({ accessToken: 'access-token' })
  })

  it('groups submissions under a task and sends a review with the comment', async () => {
    const user = userEvent.setup()
    const receivedReviews: unknown[] = []

    server.use(
      http.get(`${API_BASE_URL}/lessons/${lessonId}/tasks`, () =>
        HttpResponse.json([task]),
      ),
      http.get(
        `${API_BASE_URL}/lessons/${lessonId}/task-submissions`,
        () => HttpResponse.json([submission]),
      ),
      http.patch(
        `${API_BASE_URL}/lessons/${lessonId}/tasks/${task.id}/submissions/${submission.id}`,
        async ({ request }) => {
          const review = (await request.json()) as {
            status: 'APPROVED' | 'RETURNED'
            teacherComment: string | null
          }
          receivedReviews.push(review)
          return HttpResponse.json({
            ...submission,
            status: review.status,
            teacherComment: review.teacherComment,
            reviewedAt: '2026-08-01T11:00:00.000Z',
          })
        },
      ),
    )

    renderTasks()

    expect(
      await screen.findByRole('heading', { name: task.title }),
    ).toBeInTheDocument()
    expect(screen.getByText(submission.student.displayName)).toBeInTheDocument()
    expect(screen.getByText(submission.class.name)).toBeInTheDocument()
    expect(screen.getByText(submission.answerText)).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()

    await user.type(
      screen.getByRole('textbox', { name: 'Comment for Iryna Bondar' }),
      'Add one quotation.',
    )
    await user.click(
      screen.getByRole('button', { name: 'Return for revision' }),
    )

    await waitFor(() =>
      expect(receivedReviews[0]).toEqual({
        status: 'RETURNED',
        teacherComment: 'Add one quotation.',
      }),
    )
    expect(await screen.findByText('Returned')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(receivedReviews[1]).toEqual({
        status: 'APPROVED',
        teacherComment: 'Add one quotation.',
      }),
    )
    expect(await screen.findByText('Approved')).toBeInTheDocument()
  })

  it('creates a required task and deletes only after inline confirmation', async () => {
    const user = userEvent.setup()
    let receivedCreate: unknown
    let receivedUpdate: unknown
    let deleteCount = 0
    const createdTask: LessonTask = {
      ...task,
      id: 'task-2',
      title: 'Map exercise',
      prompt: 'Mark the route on the map.',
      position: 1,
    }

    server.use(
      http.get(`${API_BASE_URL}/lessons/${lessonId}/tasks`, () =>
        HttpResponse.json([task]),
      ),
      http.get(
        `${API_BASE_URL}/lessons/${lessonId}/task-submissions`,
        () => HttpResponse.json([]),
      ),
      http.post(
        `${API_BASE_URL}/lessons/${lessonId}/tasks`,
        async ({ request }) => {
          receivedCreate = await request.json()
          return HttpResponse.json(createdTask, { status: 201 })
        },
      ),
      http.delete(
        `${API_BASE_URL}/lessons/${lessonId}/tasks/${task.id}`,
        () => {
          deleteCount += 1
          return new HttpResponse(null, { status: 204 })
        },
      ),
      http.patch(
        `${API_BASE_URL}/lessons/${lessonId}/tasks/${createdTask.id}`,
        async ({ request }) => {
          receivedUpdate = await request.json()
          return HttpResponse.json({
            ...createdTask,
            ...(receivedUpdate as Record<string, unknown>),
          })
        },
      ),
    )

    renderTasks()
    await screen.findByRole('heading', { name: task.title })

    await user.type(
      screen.getByRole('textbox', { name: 'Task title' }),
      createdTask.title,
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Instructions' }),
      createdTask.prompt,
    )
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(
      await screen.findByRole('heading', { name: createdTask.title }),
    ).toBeInTheDocument()
    expect(receivedCreate).toEqual({
      title: createdTask.title,
      prompt: createdTask.prompt,
    })

    await user.click(
      screen.getByRole('button', { name: `Edit ${createdTask.title}` }),
    )
    const createdTaskCard = screen
      .getByRole('heading', { name: createdTask.title })
      .closest('article')
    expect(createdTaskCard).not.toBeNull()
    const editTitle = within(createdTaskCard!).getByRole('textbox', {
      name: 'Task title',
    })
    await user.clear(editTitle)
    await user.type(editTitle, 'Updated map exercise')
    await user.click(
      within(createdTaskCard!).getByRole('button', { name: 'Save' }),
    )
    await waitFor(() =>
      expect(receivedUpdate).toEqual({
        title: 'Updated map exercise',
        prompt: createdTask.prompt,
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Updated map exercise' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: `Delete ${task.title}` }),
    )
    const confirmation = screen.getByRole('group', {
      name: 'Delete this task?',
    })
    expect(deleteCount).toBe(0)

    await user.click(
      within(confirmation).getByRole('button', { name: 'Delete task' }),
    )
    await waitFor(() => expect(deleteCount).toBe(1))
    expect(
      screen.queryByRole('heading', { name: task.title }),
    ).not.toBeInTheDocument()
  })

  it('disables task and review controls in read-only mode', async () => {
    server.use(
      http.get(`${API_BASE_URL}/lessons/${lessonId}/tasks`, () =>
        HttpResponse.json([task]),
      ),
      http.get(
        `${API_BASE_URL}/lessons/${lessonId}/task-submissions`,
        () => HttpResponse.json([submission]),
      ),
    )

    renderTasks(true)

    await screen.findByRole('heading', { name: task.title })
    expect(
      screen.getByRole('textbox', { name: 'Task title' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: `Edit ${task.title}` }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: `Delete ${task.title}` }),
    ).toBeDisabled()
    expect(
      screen.getByRole('textbox', { name: 'Comment for Iryna Bondar' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Approve' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Return for revision' }),
    ).toBeDisabled()
  })
})

function renderTasks(readOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TeacherLessonTasks lessonId={lessonId} readOnly={readOnly} />
    </QueryClientProvider>,
  )
}

function addTestTranslations() {
  i18n.addResourceBundle(
    'en',
    'translation',
    {
      lessonTasks: {
        teacher: {
          eyebrow: 'Practice and review',
          title: 'Lesson tasks',
          description: 'Create tasks and review student responses.',
          readOnly: 'Archived lessons are read-only.',
          required: 'Required',
          create: {
            title: 'New task',
            description: 'Add an activity to this lesson.',
            creating: 'Adding…',
            submit: 'Add task',
          },
          fields: {
            title: 'Task title',
            titlePlaceholder: 'For example, Source analysis',
            prompt: 'Instructions',
            promptPlaceholder: 'Explain what the student should do.',
          },
          list: {
            title: 'Task list',
            description: 'Tasks appear in lesson order.',
            loading: 'Loading tasks…',
            empty: 'No tasks yet.',
          },
          actions: {
            retry: 'Try again',
            edit: 'Edit',
            editNamed: 'Edit {{title}}',
            delete: 'Delete',
            deleteNamed: 'Delete {{title}}',
            cancel: 'Cancel',
            saving: 'Saving…',
            save: 'Save',
          },
          edit: { title: 'Edit task' },
          delete: {
            title: 'Delete this task?',
            description:
              '{{title}} will be deleted permanently. Tasks with submissions cannot be deleted.',
            deleting: 'Deleting…',
            confirm: 'Delete task',
          },
          submissions: {
            title: 'Student submissions',
            count_one: '{{count}} submission',
            count_other: '{{count}} submissions',
            loading: 'Loading submissions…',
            empty: 'No submissions yet.',
            answer: 'Answer',
            submittedAt: 'Submitted {{date}}',
            comment: 'Teacher comment',
            commentNamed: 'Comment for {{student}}',
            commentPlaceholder: 'Add clear feedback for the student.',
          },
          status: {
            SUBMITTED: 'Submitted',
            APPROVED: 'Approved',
            RETURNED: 'Returned',
          },
          review: {
            return: 'Return for revision',
            saving: 'Saving…',
            approve: 'Approve',
          },
          errors: {
            create: 'Could not create the task.',
            loadTasks: 'Could not load tasks.',
            update: 'Could not update the task.',
            delete: 'Could not delete the task.',
            loadSubmissions: 'Could not load submissions.',
            review: 'Could not save the review.',
          },
        },
      },
    },
    true,
    true,
  )
}
