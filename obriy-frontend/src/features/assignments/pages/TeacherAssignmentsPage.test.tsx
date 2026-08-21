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
    expect(
      within(dialog).getByRole('button', { name: /Matching/ }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: /Ordering/ }),
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
      http.get(`${API_BASE_URL}/assignments/:assignmentId`, () =>
        HttpResponse.json(assignmentEditor()),
      ),
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

  it('creates one-to-one matching pairs with an optional extra choice', async () => {
    const user = userEvent.setup()
    let createCount = 0
    let receivedBody: unknown
    server.use(
      http.post(`${API_BASE_URL}/assignments`, async ({ request }) => {
        createCount += 1
        receivedBody = await request.json()
        return HttpResponse.json(matchingAssignmentEditor(), { status: 201 })
      }),
      http.get(`${API_BASE_URL}/assignments/:assignmentId`, () =>
        HttpResponse.json(matchingAssignmentEditor()),
      ),
    )

    renderWorkspace('/app/teacher/tasks/new/matching')
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Countries and capitals')
    await user.type(screen.getByRole('textbox', { name: 'Question or prompt' }), 'Match every country to its capital.')
    await user.type(screen.getByRole('textbox', { name: 'Item 1' }), 'Ukraine')
    await user.type(screen.getByRole('textbox', { name: 'Correct match 1' }), 'Kyiv')
    await user.type(screen.getByRole('textbox', { name: 'Item 2' }), 'France')
    await user.type(screen.getByRole('textbox', { name: 'Correct match 2' }), 'Paris')
    await user.click(screen.getByRole('button', { name: 'Add extra choice' }))
    await user.type(screen.getByRole('textbox', { name: 'Extra choice 1' }), 'Warsaw')
    await user.click(screen.getByRole('checkbox', { name: /Always shuffle the right column/ }))

    expect(createCount).toBe(0)
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0])

    await waitFor(() => expect(createCount).toBe(1))
    const body = receivedBody as {
      draft: {
        publicConfig: { leftItems: Array<{ id: string; text: string }>; rightItems: Array<{ id: string; text: string }>; shuffleRightItems: boolean }
        gradingConfig: { matches: Array<{ leftItemId: string; rightItemId: string }>; scoringMode: string }
      }
    }
    expect(body).toEqual(expect.objectContaining({ type: 'MATCHING', defaultMaxPoints: 1, defaultPassingPercent: 100 }))
    expect(body.draft.publicConfig.leftItems.map((item) => item.text)).toEqual(['Ukraine', 'France'])
    expect(body.draft.publicConfig.rightItems.map((item) => item.text)).toEqual(['Kyiv', 'Paris', 'Warsaw'])
    expect(body.draft.publicConfig.shuffleRightItems).toBe(true)
    expect(body.draft.gradingConfig).toEqual({
      matches: body.draft.publicConfig.leftItems.map((leftItem, index) => ({
        leftItemId: leftItem.id,
        rightItemId: body.draft.publicConfig.rightItems[index]?.id,
      })),
      scoringMode: 'PARTIAL',
    })
  })

  it('creates an ordering assignment in the sequence chosen by the teacher', async () => {
    const user = userEvent.setup()
    let createCount = 0
    let receivedBody: unknown
    server.use(
      http.post(`${API_BASE_URL}/assignments`, async ({ request }) => {
        createCount += 1
        receivedBody = await request.json()
        return HttpResponse.json(orderingAssignmentEditor(), { status: 201 })
      }),
      http.get(`${API_BASE_URL}/assignments/:assignmentId`, () =>
        HttpResponse.json(orderingAssignmentEditor()),
      ),
    )

    renderWorkspace('/app/teacher/tasks/new/ordering')
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Water cycle')
    await user.type(screen.getByRole('textbox', { name: 'Question or prompt' }), 'Put the stages in order.')
    await user.type(screen.getByRole('textbox', { name: 'Item 1' }), 'Evaporation')
    await user.type(screen.getByRole('textbox', { name: 'Item 2' }), 'Condensation')
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await user.type(screen.getByRole('textbox', { name: 'Item 3' }), 'Precipitation')
    await user.click(screen.getByRole('button', { name: 'Move item 3 up' }))

    expect(createCount).toBe(0)
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0])

    await waitFor(() => expect(createCount).toBe(1))
    const body = receivedBody as {
      draft: {
        publicConfig: { items: Array<{ id: string; text: string }> }
        gradingConfig: { correctOrderIds: string[]; scoringMode: string }
      }
    }
    expect(body).toEqual(expect.objectContaining({
      type: 'ORDERING',
      defaultMaxPoints: 1,
      defaultPassingPercent: 100,
    }))
    expect(body.draft.publicConfig.items.map((item) => item.text)).toEqual([
      'Evaporation',
      'Precipitation',
      'Condensation',
    ])
    expect(body.draft.gradingConfig).toEqual({
      correctOrderIds: body.draft.publicConfig.items.map((item) => item.id),
      scoringMode: 'PARTIAL',
    })
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

function matchingAssignmentEditor() {
  const leftA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const leftB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const rightA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const rightB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  const distractor = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  return {
    ...assignmentEditor(),
    type: 'MATCHING',
    draftRevision: {
      ...assignmentEditor().draftRevision,
      title: 'Countries and capitals',
      prompt: 'Match every country to its capital.',
      publicConfig: {
        leftItems: [{ id: leftA, text: 'Ukraine' }, { id: leftB, text: 'France' }],
        rightItems: [{ id: rightA, text: 'Kyiv' }, { id: rightB, text: 'Paris' }, { id: distractor, text: 'Warsaw' }],
        shuffleRightItems: true,
      },
      gradingConfig: {
        matches: [{ leftItemId: leftA, rightItemId: rightA }, { leftItemId: leftB, rightItemId: rightB }],
        scoringMode: 'PARTIAL',
      },
    },
  }
}

function orderingAssignmentEditor() {
  const evaporation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const precipitation = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const condensation = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  return {
    ...assignmentEditor(),
    type: 'ORDERING',
    draftRevision: {
      ...assignmentEditor().draftRevision,
      title: 'Water cycle',
      prompt: 'Put the stages in order.',
      publicConfig: {
        items: [
          { id: evaporation, text: 'Evaporation' },
          { id: precipitation, text: 'Precipitation' },
          { id: condensation, text: 'Condensation' },
        ],
      },
      gradingConfig: {
        correctOrderIds: [evaporation, precipitation, condensation],
        scoringMode: 'PARTIAL',
      },
    },
  }
}
