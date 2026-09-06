import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { server } from '../../../test/server'
import { TeacherAssignmentEditorPage } from './TeacherAssignmentEditorPage'
import { TeacherAssignmentsPage } from './TeacherAssignmentsPage'

vi.mock('../../maps/components/MapCanvas', () => ({
  MapCanvas: ({
    onPointChange,
    onRadiusChange,
    onRegionChange,
    onRegionsLoad,
    radiusKm,
  }: {
    onPointChange?: (point: { longitude: number; latitude: number }) => void
    onRadiusChange?: (radiusKm: number) => void
    onRegionChange?: (region: {
      id: string
      isoCode: string
      name: string
      nameEn: string
      nameUk: string
    }) => void
    onRegionsLoad?: (
      regions: Array<{
        id: string
        isoCode: string
        name: string
        nameEn: string
        nameUk: string
      }>,
    ) => void
    radiusKm?: number | null
  }) => (
    <div data-radius={radiusKm} data-testid="map-point-canvas">
      <button
        onClick={() =>
          onPointChange?.({ longitude: 30.5234, latitude: 50.4501 })
        }
        type="button"
      >
        Mark point
      </button>
      <button onClick={() => onRadiusChange?.(333)} type="button">
        Drag radius edge
      </button>
      <button onClick={() => onRegionsLoad?.(mapRegions)} type="button">
        Load regions
      </button>
      <button onClick={() => onRegionChange?.(mapRegion)} type="button">
        Choose region
      </button>
    </div>
  ),
}))

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
    expect(
      within(dialog).getByRole('button', { name: /Categorization/ }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: /Fill in the blanks/ }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: /Image hotspot/ }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: /Point on a map/ }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: /Map region/ }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: /Multiple map regions/ }),
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
          allowAttachments: false,
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
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Countries and capitals',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Question or prompt' }),
      'Match every country to its capital.',
    )
    await user.type(screen.getByRole('textbox', { name: 'Item 1' }), 'Ukraine')
    await user.type(
      screen.getByRole('textbox', { name: 'Correct match 1' }),
      'Kyiv',
    )
    await user.type(screen.getByRole('textbox', { name: 'Item 2' }), 'France')
    await user.type(
      screen.getByRole('textbox', { name: 'Correct match 2' }),
      'Paris',
    )
    await user.click(screen.getByRole('button', { name: 'Add extra choice' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Extra choice 1' }),
      'Warsaw',
    )
    await user.click(
      screen.getByRole('checkbox', { name: /Always shuffle the right column/ }),
    )

    expect(createCount).toBe(0)
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0])

    await waitFor(() => expect(createCount).toBe(1))
    const body = receivedBody as {
      draft: {
        publicConfig: {
          leftItems: Array<{ id: string; text: string }>
          rightItems: Array<{ id: string; text: string }>
          shuffleRightItems: boolean
        }
        gradingConfig: {
          matches: Array<{ leftItemId: string; rightItemId: string }>
          scoringMode: string
        }
      }
    }
    expect(body).toEqual(
      expect.objectContaining({
        type: 'MATCHING',
        defaultMaxPoints: 1,
        defaultPassingPercent: 100,
      }),
    )
    expect(body.draft.publicConfig.leftItems.map((item) => item.text)).toEqual([
      'Ukraine',
      'France',
    ])
    expect(body.draft.publicConfig.rightItems.map((item) => item.text)).toEqual(
      ['Kyiv', 'Paris', 'Warsaw'],
    )
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
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Water cycle',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Question or prompt' }),
      'Put the stages in order.',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Item 1' }),
      'Evaporation',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Item 2' }),
      'Condensation',
    )
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Item 3' }),
      'Precipitation',
    )
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
    expect(body).toEqual(
      expect.objectContaining({
        type: 'ORDERING',
        defaultMaxPoints: 1,
        defaultPassingPercent: 100,
      }),
    )
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

  it('creates a categorization assignment with one category per item', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown
    server.use(
      http.post(`${API_BASE_URL}/assignments`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(categorizationAssignmentEditor(), {
          status: 201,
        })
      }),
      http.get(`${API_BASE_URL}/assignments/:assignmentId`, () =>
        HttpResponse.json(categorizationAssignmentEditor()),
      ),
    )

    renderWorkspace('/app/teacher/tasks/new/categorization')
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Living things',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Question or prompt' }),
      'Sort every example.',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Category 1' }),
      'Plants',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Category 2' }),
      'Animals',
    )
    await user.type(screen.getByRole('textbox', { name: 'Item 1' }), 'Oak')
    await user.type(screen.getByRole('textbox', { name: 'Item 2' }), 'Wolf')
    const categories = screen.getAllByRole('combobox', {
      name: 'Correct category',
    })
    await user.selectOptions(
      categories[0]!,
      within(categories[0]!).getByRole('option', { name: 'Plants' }),
    )
    await user.selectOptions(
      categories[1]!,
      within(categories[1]!).getByRole('option', { name: 'Animals' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(receivedBody).toBeDefined())
    const body = receivedBody as {
      type: string
      draft: {
        publicConfig: {
          categories: Array<{ id: string; title: string }>
          items: Array<{ id: string; text: string }>
        }
        gradingConfig: {
          assignments: Array<{ itemId: string; categoryId: string }>
        }
      }
    }
    expect(body.type).toBe('CATEGORIZATION')
    expect(
      body.draft.publicConfig.categories.map((value) => value.title),
    ).toEqual(['Plants', 'Animals'])
    expect(body.draft.publicConfig.items.map((value) => value.text)).toEqual([
      'Oak',
      'Wolf',
    ])
    expect(body.draft.gradingConfig.assignments).toEqual([
      {
        itemId: body.draft.publicConfig.items[0]!.id,
        categoryId: body.draft.publicConfig.categories[0]!.id,
      },
      {
        itemId: body.draft.publicConfig.items[1]!.id,
        categoryId: body.draft.publicConfig.categories[1]!.id,
      },
    ])
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
      http.post(`${API_BASE_URL}/assignments/:assignmentId/start-edit`, () => {
        startEditCount += 1
        return HttpResponse.json(editable)
      }),
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

  it('creates MAP_POINT after synchronizing point and all radius controls', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown
    server.use(
      http.get(`${API_BASE_URL}/map-presets`, () =>
        HttpResponse.json([mapPreset()]),
      ),
      http.post(`${API_BASE_URL}/assignments`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(mapPointAssignmentEditor(), { status: 201 })
      }),
      http.get(`${API_BASE_URL}/assignments/:assignmentId`, () =>
        HttpResponse.json(mapPointAssignmentEditor()),
      ),
    )

    renderWorkspace('/app/teacher/tasks/new/map_point')
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Find Kyiv')
    await user.type(
      screen.getByRole('textbox', { name: 'Question or prompt' }),
      'Mark Kyiv on the map.',
    )
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Geographic dataset' }),
      mapPreset().id,
    )
    const canvas = await screen.findByTestId('map-point-canvas')
    await user.click(within(canvas).getByRole('button', { name: 'Mark point' }))

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Radius, km' }), {
      target: { value: '250' },
    })
    expect(canvas).toHaveAttribute('data-radius', '250')
    fireEvent.change(
      screen.getByRole('slider', { name: 'Quick radius adjustment' }),
      { target: { value: '400' } },
    )
    expect(canvas).toHaveAttribute('data-radius', '400')
    await user.click(
      within(canvas).getByRole('button', { name: 'Drag radius edge' }),
    )
    expect(canvas).toHaveAttribute('data-radius', '333')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(receivedBody).toBeDefined())
    expect(receivedBody).toEqual({
      type: 'MAP_POINT',
      defaultMaxPoints: 1,
      defaultPassingPercent: 100,
      draft: {
        title: 'Find Kyiv',
        prompt: 'Mark Kyiv on the map.',
        instructions: null,
        explanation: null,
        publicConfig: { initialProjection: 'MERCATOR' },
        gradingConfig: {
          target: { longitude: 30.5234, latitude: 50.4501 },
          radiusKm: 333,
        },
        mapPresetId: mapPreset().id,
      },
    })
  })

  it('creates MAP_REGION after synchronizing localized search and map selection', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown
    server.use(
      http.get(`${API_BASE_URL}/map-presets`, () =>
        HttpResponse.json([mapPreset()]),
      ),
      http.post(`${API_BASE_URL}/assignments`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(mapRegionAssignmentEditor(), { status: 201 })
      }),
      http.get(`${API_BASE_URL}/assignments/:assignmentId`, () =>
        HttpResponse.json(mapRegionAssignmentEditor()),
      ),
    )

    renderWorkspace('/app/teacher/tasks/new/map_region')
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Find India',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Question or prompt' }),
      'Choose India on the map.',
    )
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Geographic dataset' }),
      mapPreset().id,
    )
    const canvas = await screen.findByTestId('map-point-canvas')
    await user.click(
      within(canvas).getByRole('button', { name: 'Load regions' }),
    )
    await user.type(
      screen.getByRole('searchbox', { name: 'Region search' }),
      'Індія',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Region list' }),
      'IND',
    )
    await user.click(screen.getByRole('radio', { name: 'Globe' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(receivedBody).toBeDefined())
    expect(receivedBody).toEqual({
      type: 'MAP_REGION',
      defaultMaxPoints: 1,
      defaultPassingPercent: 100,
      draft: {
        title: 'Find India',
        prompt: 'Choose India on the map.',
        instructions: null,
        explanation: null,
        publicConfig: { initialProjection: 'GLOBE' },
        gradingConfig: { correctRegionId: 'IND' },
        mapPresetId: mapPreset().id,
      },
    })
  })

  it('creates MAP_MULTI_REGION with synchronized selection and partial scoring', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown
    server.use(
      http.get(`${API_BASE_URL}/map-presets`, () =>
        HttpResponse.json([mapPreset()]),
      ),
      http.post(`${API_BASE_URL}/assignments`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(mapMultiRegionAssignmentEditor(), {
          status: 201,
        })
      }),
      http.get(`${API_BASE_URL}/assignments/:assignmentId`, () =>
        HttpResponse.json(mapMultiRegionAssignmentEditor()),
      ),
    )

    renderWorkspace('/app/teacher/tasks/new/map_multi_region')
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Find two countries',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Question or prompt' }),
      'Choose India and France.',
    )
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Geographic dataset' }),
      mapPreset().id,
    )
    const canvas = await screen.findByTestId('map-point-canvas')
    await user.click(
      within(canvas).getByRole('button', { name: 'Load regions' }),
    )
    await user.click(screen.getByRole('checkbox', { name: /India/ }))
    await user.click(screen.getByRole('checkbox', { name: /France/ }))
    expect(screen.getByText('2 of 50')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Partial credit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(receivedBody).toBeDefined())
    expect(receivedBody).toEqual({
      type: 'MAP_MULTI_REGION',
      defaultMaxPoints: 1,
      defaultPassingPercent: 100,
      draft: {
        title: 'Find two countries',
        prompt: 'Choose India and France.',
        instructions: null,
        explanation: null,
        publicConfig: {
          initialProjection: 'MERCATOR',
          requiredSelectionCount: 2,
        },
        gradingConfig: {
          correctRegionIds: ['IND', 'FRA'],
          scoringMode: 'PARTIAL',
        },
        mapPresetId: mapPreset().id,
      },
    })
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
        allowAttachments: false,
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
        leftItems: [
          { id: leftA, text: 'Ukraine' },
          { id: leftB, text: 'France' },
        ],
        rightItems: [
          { id: rightA, text: 'Kyiv' },
          { id: rightB, text: 'Paris' },
          { id: distractor, text: 'Warsaw' },
        ],
        shuffleRightItems: true,
      },
      gradingConfig: {
        matches: [
          { leftItemId: leftA, rightItemId: rightA },
          { leftItemId: leftB, rightItemId: rightB },
        ],
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

function categorizationAssignmentEditor() {
  const plant = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const animal = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const oak = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const wolf = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  return {
    ...assignmentEditor(),
    type: 'CATEGORIZATION',
    draftRevision: {
      ...assignmentEditor().draftRevision,
      title: 'Living things',
      prompt: 'Sort every example.',
      publicConfig: {
        categories: [
          { id: plant, title: 'Plants' },
          { id: animal, title: 'Animals' },
        ],
        items: [
          { id: oak, text: 'Oak' },
          { id: wolf, text: 'Wolf' },
        ],
        promptImage: null,
      },
      gradingConfig: {
        assignments: [
          { itemId: oak, categoryId: plant },
          { itemId: wolf, categoryId: animal },
        ],
        scoringMode: 'PARTIAL',
      },
    },
  }
}

function mapPreset() {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    key: 'world-adm0',
    name: 'World countries',
    contentLocale: 'UK',
    sourceType: 'BUILT_IN',
    geojsonUrl: '/maps/world-adm0.geojson',
    idProperty: 'featureId',
    year: null,
    attribution: 'geoBoundaries',
    bounds: { west: -180, south: -85, east: 180, north: 85 },
    defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
  }
}

function mapPointAssignmentEditor() {
  return {
    ...assignmentEditor(),
    type: 'MAP_POINT',
    draftRevision: {
      ...assignmentEditor().draftRevision,
      title: 'Find Kyiv',
      prompt: 'Mark Kyiv on the map.',
      publicConfig: { initialProjection: 'MERCATOR' },
      gradingConfig: {
        target: { longitude: 30.5234, latitude: 50.4501 },
        radiusKm: 333,
      },
      mapPresetId: mapPreset().id,
    },
  }
}

const mapRegion = {
  id: 'IND',
  isoCode: 'IND',
  name: 'India',
  nameEn: 'India',
  nameUk: 'Індія',
}

const mapRegions = [
  mapRegion,
  {
    id: 'FRA',
    isoCode: 'FRA',
    name: 'France',
    nameEn: 'France',
    nameUk: 'Франція',
  },
]

function mapRegionAssignmentEditor() {
  return {
    ...assignmentEditor(),
    type: 'MAP_REGION',
    draftRevision: {
      ...assignmentEditor().draftRevision,
      title: 'Find India',
      prompt: 'Choose India on the map.',
      publicConfig: { initialProjection: 'GLOBE' },
      gradingConfig: { correctRegionId: 'IND' },
      mapPresetId: mapPreset().id,
    },
  }
}

function mapMultiRegionAssignmentEditor() {
  return {
    ...assignmentEditor(),
    type: 'MAP_MULTI_REGION',
    draftRevision: {
      ...assignmentEditor().draftRevision,
      title: 'Find two countries',
      prompt: 'Choose India and France.',
      publicConfig: {
        initialProjection: 'MERCATOR',
        requiredSelectionCount: 2,
      },
      gradingConfig: {
        correctRegionIds: ['IND', 'FRA'],
        scoringMode: 'PARTIAL',
      },
      mapPresetId: mapPreset().id,
    },
  }
}
