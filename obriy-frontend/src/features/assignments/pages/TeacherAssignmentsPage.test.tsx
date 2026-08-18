import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import { TeacherAssignmentEditorPage } from './TeacherAssignmentEditorPage'
import { TeacherAssignmentsPage } from './TeacherAssignmentsPage'

describe('teacher assignment workspace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('shows every planned type without creating a database record', async () => {
    const user = userEvent.setup()
    let createCount = 0
    server.use(
      http.get(`${API_BASE_URL}/assignments`, () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.post(`${API_BASE_URL}/assignments`, () => {
        createCount += 1
        return HttpResponse.json(assignmentEditor(), { status: 201 })
      }),
    )

    renderWorkspace('/app/teacher/tasks')
    await user.click(
      await screen.findByRole('button', { name: 'Create assignment' }),
    )

    const dialog = screen.getByRole('dialog', {
      name: 'Choose an assignment type',
    })
    expect(within(dialog).getAllByRole('button')).toHaveLength(12)
    expect(
      within(dialog).getByRole('button', { name: /Written response/ }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: /Single choice/ }),
    ).toBeEnabled()
    expect(within(dialog).queryByText(/soon/i)).not.toBeInTheDocument()
    expect(createCount).toBe(0)

    await user.click(
      within(dialog).getByRole('button', { name: /Written response/ }),
    )
    expect(
      await screen.findByRole('heading', { name: 'New written assignment' }),
    ).toBeInTheDocument()
    expect(createCount).toBe(0)
  })

  it('creates the complete written draft only after explicit save', async () => {
    const user = userEvent.setup()
    let createCount = 0
    let receivedBody: unknown
    server.use(
      http.post(`${API_BASE_URL}/assignments`, async ({ request }) => {
        createCount += 1
        receivedBody = await request.json()
        return HttpResponse.json(assignmentEditor(), { status: 201 })
      }),
    )

    renderWorkspace('/app/teacher/tasks/new/written')
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Industrial Revolution',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Question or prompt' }),
      'Explain two important causes.',
    )
    await user.click(screen.getByRole('checkbox', { name: /Allow files/ }))

    expect(createCount).toBe(0)
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0])

    await waitFor(() => expect(createCount).toBe(1))
    expect(receivedBody).toEqual({
      type: 'WRITTEN',
      defaultMaxPoints: 1,
      defaultPassingPercent: 100,
      draft: {
        title: 'Industrial Revolution',
        prompt: 'Explain two important causes.',
        instructions: null,
        explanation: null,
        publicConfig: {
          responseMode: 'LONG',
          minLength: 0,
          maxLength: 5000,
          allowAttachments: true,
          rubric: [],
        },
        gradingConfig: { mode: 'MANUAL' },
      },
    })
    expect(await screen.findByText('All changes saved')).toBeInTheDocument()
  })

  it('starts a transparent new revision before editing a ready assignment', async () => {
    const user = userEvent.setup()
    const published = publishedAssignmentEditor()
    const editable = {
      ...published,
      draftRevision: {
        ...published.publishedRevision,
        id: '33333333-3333-4333-8333-333333333333',
        version: 2,
        status: 'DRAFT',
        publishedAt: null,
      },
    }
    let startEditCount = 0
    let patchBody: unknown
    server.use(
      http.get(`${API_BASE_URL}/assignments/:assignmentId`, () =>
        HttpResponse.json(published),
      ),
      http.post(
        `${API_BASE_URL}/assignments/:assignmentId/start-edit`,
        () => {
          startEditCount += 1
          return HttpResponse.json(editable)
        },
      ),
      http.patch(
        `${API_BASE_URL}/assignments/:assignmentId/draft`,
        async ({ request }) => {
          patchBody = await request.json()
          return HttpResponse.json(editable)
        },
      ),
    )

    renderWorkspace(
      '/app/teacher/tasks/11111111-1111-4111-8111-111111111111/edit',
    )
    const prompt = await screen.findByRole('textbox', {
      name: 'Question or prompt',
    })
    await user.clear(prompt)
    await user.type(prompt, 'Updated question')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0])

    await waitFor(() => expect(startEditCount).toBe(1))
    await waitFor(() => expect(patchBody).toBeDefined())
    expect(patchBody).toEqual(
      expect.objectContaining({
        prompt: 'Updated question',
        expectedRevisionId: '33333333-3333-4333-8333-333333333333',
        expectedEditVersion: 1,
      }),
    )
  })

})

function renderWorkspace(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/app/teacher/tasks"
            element={<TeacherAssignmentsPage />}
          />
          <Route
            path="/app/teacher/tasks/new/:assignmentType"
            element={<TeacherAssignmentEditorPage />}
          />
          <Route
            path="/app/teacher/tasks/:assignmentId/edit"
            element={<TeacherAssignmentEditorPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function assignmentEditor() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'WRITTEN',
    contentLocale: 'EN',
    status: 'DRAFT',
    defaultMaxPoints: 1,
    defaultPassingPercent: 100,
    archivedAt: null,
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    draftRevision: {
      id: '22222222-2222-4222-8222-222222222222',
      version: 1,
      status: 'DRAFT',
      title: 'Industrial Revolution',
      prompt: 'Explain two important causes.',
      instructions: null,
      explanation: null,
      publicConfig: {
        responseMode: 'LONG',
        minLength: 0,
        maxLength: 5000,
        allowAttachments: true,
        rubric: [],
      },
      gradingConfig: { mode: 'MANUAL' },
      mapPresetId: null,
      schemaVersion: 1,
      editVersion: 1,
      publishedAt: null,
      createdAt: '2026-08-08T10:00:00.000Z',
      updatedAt: '2026-08-08T10:00:00.000Z',
    },
    publishedRevision: null,
  }
}

function publishedAssignmentEditor() {
  const draft = assignmentEditor()
  return {
    ...draft,
    status: 'PUBLISHED',
    draftRevision: null,
    publishedRevision: {
      ...draft.draftRevision,
      status: 'PUBLISHED',
      publishedAt: '2026-08-08T11:00:00.000Z',
    },
  }
}
