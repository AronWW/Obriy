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

vi.mock('../../maps/components/MapCanvas', () => ({
  MapCanvas: ({
    comparisonPoint,
    comparisonRegionIds,
    onPointChange,
    onRegionChange,
    onRegionsLoad,
    point,
    radiusKm,
    selectedRegionIds,
  }: {
    comparisonPoint?: { longitude: number; latitude: number } | null
    comparisonRegionIds?: string[]
    onPointChange?: (point: { longitude: number; latitude: number }) => void
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
    point?: { longitude: number; latitude: number } | null
    radiusKm?: number | null
    selectedRegionIds?: string[]
  }) => (
    <div
      data-comparison={
        comparisonPoint
          ? `${comparisonPoint.longitude},${comparisonPoint.latitude}`
          : undefined
      }
      data-point={point ? `${point.longitude},${point.latitude}` : undefined}
      data-radius={radiusKm ?? undefined}
      data-regions={selectedRegionIds?.join(',') || undefined}
      data-regions-comparison={comparisonRegionIds?.join(',') || undefined}
      data-testid="map-canvas-mock"
    >
      {onPointChange && (
        <button
          onClick={() => onPointChange({ longitude: 30.5, latitude: 50.45 })}
          type="button"
        >
          Mark student answer
        </button>
      )}
      {onRegionsLoad && (
        <button
          onClick={() =>
            onRegionsLoad([
              {
                id: 'IND',
                isoCode: 'IND',
                name: 'India',
                nameEn: 'India',
                nameUk: 'Індія',
              },
              {
                id: 'PRI',
                isoCode: 'PRI',
                name: 'Puerto Rico',
                nameEn: 'Puerto Rico',
                nameUk: 'Пуерто-Рико',
              },
            ])
          }
          type="button"
        >
          Load regions
        </button>
      )}
      {onRegionChange && (
        <button
          onClick={() =>
            onRegionChange({
              id: 'PRI',
              isoCode: 'PRI',
              name: 'Puerto Rico',
              nameEn: 'Puerto Rico',
              nameUk: 'Пуерто-Рико',
            })
          }
          type="button"
        >
          Choose Puerto Rico
        </button>
      )}
    </div>
  ),
}))

const student = {
  id: 'student-1',
  email: 'student@example.com',
  role: 'STUDENT' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: '2026-08-01T10:00:00.000Z',
  hasPassword: true,
  profile: {
    displayName: 'Maksym Bondar',
    avatarUrl: null,
    bio: null,
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
      http.get(`${API_BASE_URL}/classes/me/lessons/:lessonId/tests`, () =>
        HttpResponse.json([]),
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
    expect(
      within(firstLesson!).getByText('0/2 · Not started'),
    ).toBeInTheDocument()
    expect(
      within(firstLesson!).getByRole('link', {
        name: 'Open lesson “First settlement”',
      }),
    ).toHaveAttribute('href', '/app/student/lessons/lesson-1')

    const secondLesson = screen
      .getByRole('heading', { name: 'The Ukrainian Revolution' })
      .closest('li')
    expect(within(secondLesson!).getByText('25 min')).toBeInTheDocument()
    expect(
      within(secondLesson!).getByText('2/2 · Completed'),
    ).toBeInTheDocument()
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
      screen.getByText(
        'A material will appear here when your teacher opens it.',
      ),
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
      await screen.findByRole('heading', {
        name: 'First settlement',
        level: 1,
      }),
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
      await screen.findByText(
        'No knowledge checks have been added to this lesson yet.',
      ),
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
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1/tests`, () =>
        HttpResponse.json([test]),
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
          const responseData = (
            body as { responseData: Record<string, unknown> }
          ).responseData
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
          answers: [
            studentTestAnswer({
              status: 'AWAITING_REVIEW',
              responseData: { text: 'My reasoned answer', attachmentIds: [] },
            }),
          ],
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
    const answer = await within(dialog).findByRole('textbox', {
      name: /Your answer/,
    })
    await user.type(answer, 'My reasoned answer')

    await waitFor(
      () =>
        expect(savedBodies).toEqual([
          { responseData: { text: 'My reasoned answer', attachmentIds: [] } },
        ]),
      {
        timeout: 2_500,
      },
    )
    expect(within(dialog).getByText('Answer saved')).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: 'Finish test' }),
    )
    const confirm = screen.getByRole('dialog', { name: 'Finish this attempt?' })
    await user.click(
      within(confirm).getByRole('button', { name: 'Submit answers' }),
    )
    await waitFor(() => expect(submitted).toBe(true))
    expect(
      await screen.findByText('Awaiting teacher review'),
    ).toBeInTheDocument()
  })

  it('keeps matching answers one-to-one and submits every pair', async () => {
    const user = userEvent.setup()
    const savedBodies: unknown[] = []
    let submitted = false
    const leftA = 'left-a'
    const leftB = 'left-b'
    const rightA = 'right-a'
    const rightB = 'right-b'
    let test = studentTest({
      maxPoints: 6,
      items: [
        {
          id: 'item-1',
          position: 0,
          maxPoints: 6,
          assignmentId: 'assignment-1',
          assignmentRevisionId: 'revision-1',
          type: 'MATCHING',
          title: 'Countries and capitals',
          prompt: 'Match every country to its capital.',
          instructions: null,
          mapPreset: null,
          publicConfig: {
            leftItems: [
              { id: leftA, text: 'Ukraine' },
              { id: leftB, text: 'France' },
            ],
            rightItems: [
              { id: rightA, text: 'Kyiv' },
              { id: rightB, text: 'Paris' },
              { id: 'distractor', text: 'Warsaw' },
            ],
            shuffleRightItems: true,
          },
        },
      ],
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
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1/tests`, () =>
        HttpResponse.json([test]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () =>
        HttpResponse.json(test),
      ),
      http.post(`${API_BASE_URL}/test-releases/release-1/attempts`, () => {
        const attempt = studentTestAttempt({
          maxPoints: 6,
          answers: [
            studentTestAnswer({ maxPoints: 6, responseData: { matches: [] } }),
          ],
        })
        test = { ...test, stateStatus: 'IN_PROGRESS', attempt }
        return HttpResponse.json(attempt)
      }),
      http.put(
        `${API_BASE_URL}/test-attempts/attempt-1/answers/item-1`,
        async ({ request }) => {
          savedBodies.push(await request.json())
          return HttpResponse.json(test.attempt)
        },
      ),
      http.post(`${API_BASE_URL}/test-attempts/attempt-1/submit`, () => {
        submitted = true
        return HttpResponse.json(
          studentTestAttempt({
            status: 'GRADED',
            maxPoints: 6,
            scorePoints: 6,
            scorePercent: 100,
            isPassed: true,
            submittedAt: '2026-08-13T12:00:00.000Z',
            gradedAt: '2026-08-13T12:00:00.000Z',
            answers: [
              studentTestAnswer({
                status: 'GRADED',
                maxPoints: 6,
                scorePoints: 6,
                scorePercent: 100,
                isCorrect: true,
                responseData: {
                  matches: [
                    { leftItemId: leftA, rightItemId: rightA },
                    { leftItemId: leftB, rightItemId: rightB },
                  ],
                },
              }),
            ],
          }),
        )
      }),
    )

    renderStudentReader('/app/student/lessons/lesson-1')
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    const dialog = await screen.findByRole('dialog', { name: 'History check' })
    await user.click(within(dialog).getByRole('button', { name: 'Start' }))
    const selects = await within(dialog).findAllByRole('combobox')
    await user.selectOptions(selects[0]!, rightA)
    expect(
      within(selects[1]!).getByRole('option', { name: 'Kyiv' }),
    ).toBeDisabled()
    await user.selectOptions(selects[1]!, rightB)

    await waitFor(
      () =>
        expect(savedBodies).toEqual([
          {
            responseData: {
              matches: [
                { leftItemId: leftA, rightItemId: rightA },
                { leftItemId: leftB, rightItemId: rightB },
              ],
            },
          },
        ]),
      { timeout: 2_500 },
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Finish test' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Finish this attempt?' }),
      ).getByRole('button', { name: 'Submit answers' }),
    )
    await waitFor(() => expect(submitted).toBe(true))
  })

  it('lets the student reorder every delivered item and saves the full sequence', async () => {
    const user = userEvent.setup()
    const savedBodies: unknown[] = []
    let submitted = false
    const evaporation = 'evaporation'
    const condensation = 'condensation'
    const precipitation = 'precipitation'
    let test = studentTest({
      maxPoints: 6,
      items: [
        {
          id: 'item-1',
          position: 0,
          maxPoints: 6,
          assignmentId: 'assignment-1',
          assignmentRevisionId: 'revision-1',
          type: 'ORDERING',
          title: 'Water cycle',
          prompt: 'Put the stages in order.',
          instructions: null,
          mapPreset: null,
          publicConfig: {
            items: [
              { id: precipitation, text: 'Precipitation' },
              { id: evaporation, text: 'Evaporation' },
              { id: condensation, text: 'Condensation' },
            ],
          },
        },
      ],
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
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1/tests`, () =>
        HttpResponse.json([test]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () =>
        HttpResponse.json(test),
      ),
      http.post(`${API_BASE_URL}/test-releases/release-1/attempts`, () => {
        const attempt = studentTestAttempt({
          maxPoints: 6,
          answers: [
            studentTestAnswer({
              maxPoints: 6,
              responseData: { orderedItemIds: [] },
            }),
          ],
        })
        test = { ...test, stateStatus: 'IN_PROGRESS', attempt }
        return HttpResponse.json(attempt)
      }),
      http.put(
        `${API_BASE_URL}/test-attempts/attempt-1/answers/item-1`,
        async ({ request }) => {
          savedBodies.push(await request.json())
          return HttpResponse.json(test.attempt)
        },
      ),
      http.post(`${API_BASE_URL}/test-attempts/attempt-1/submit`, () => {
        submitted = true
        return HttpResponse.json(
          studentTestAttempt({
            status: 'GRADED',
            maxPoints: 6,
            scorePoints: 6,
            scorePercent: 100,
            isPassed: true,
            submittedAt: '2026-08-13T12:00:00.000Z',
            gradedAt: '2026-08-13T12:00:00.000Z',
            answers: [
              studentTestAnswer({
                status: 'GRADED',
                maxPoints: 6,
                scorePoints: 6,
                scorePercent: 100,
                isCorrect: true,
                responseData: {
                  orderedItemIds: [evaporation, condensation, precipitation],
                },
              }),
            ],
          }),
        )
      }),
    )

    renderStudentReader('/app/student/lessons/lesson-1')
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    const dialog = await screen.findByRole('dialog', { name: 'History check' })
    await user.click(within(dialog).getByRole('button', { name: 'Start' }))
    await user.click(
      await within(dialog).findByRole('button', {
        name: 'Move “Precipitation” down',
      }),
    )

    await waitFor(
      () =>
        expect(savedBodies.at(-1)).toEqual({
          responseData: {
            orderedItemIds: [evaporation, precipitation, condensation],
          },
        }),
      { timeout: 2_500 },
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Finish test' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Finish this attempt?' }),
      ).getByRole('button', { name: 'Submit answers' }),
    )
    await waitFor(() => expect(submitted).toBe(true))
  })

  it('runs categorization, fill-blanks, and image-hotspot items in one test', async () => {
    const user = userEvent.setup()
    const saved = new Map<string, unknown>()
    let submitted = false
    const categoryA = 'category-a'
    const categoryB = 'category-b'
    const blankA = 'blank-a'
    let test = studentTest({
      itemCount: 3,
      maxPoints: 9,
      items: [
        {
          id: 'item-category',
          position: 0,
          maxPoints: 3,
          assignmentId: 'assignment-category',
          assignmentRevisionId: 'revision-category',
          type: 'CATEGORIZATION',
          title: 'Sort examples',
          prompt: 'Choose a category.',
          instructions: null,
          mapPreset: null,
          publicConfig: {
            categories: [
              { id: categoryA, title: 'Plants' },
              { id: categoryB, title: 'Animals' },
            ],
            items: [
              { id: 'oak', text: 'Oak' },
              { id: 'wolf', text: 'Wolf' },
            ],
          },
        },
        {
          id: 'item-blanks',
          position: 1,
          maxPoints: 3,
          assignmentId: 'assignment-blanks',
          assignmentRevisionId: 'revision-blanks',
          type: 'FILL_BLANKS',
          title: 'Complete the sentence',
          prompt: 'Fill every blank.',
          instructions: null,
          mapPreset: null,
          publicConfig: {
            segments: [
              { id: 'text-a', type: 'TEXT', text: 'The capital is ' },
              { id: blankA, type: 'BLANK' },
            ],
            wordBankEnabled: true,
            wordBank: [
              { id: 'word-a', text: 'Kyiv' },
              { id: 'word-b', text: 'Lviv' },
            ],
          },
        },
        {
          id: 'item-hotspot',
          position: 2,
          maxPoints: 3,
          assignmentId: 'assignment-hotspot',
          assignmentRevisionId: 'revision-hotspot',
          type: 'IMAGE_HOTSPOT',
          title: 'Find the location',
          prompt: 'Mark the correct point.',
          instructions: null,
          mapPreset: null,
          publicConfig: {
            promptImage: {
              attachmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              width: 800,
              height: 600,
            },
          },
        },
      ],
    })

    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json({
          ...studentLesson(),
          content: 'Read this lesson first.',
          class: { id: 'class-1', name: 'Grade 9-A' },
          teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
        }),
      ),
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1/tests`, () =>
        HttpResponse.json([test]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () =>
        HttpResponse.json(test),
      ),
      http.post(`${API_BASE_URL}/test-releases/release-1/attempts`, () => {
        const attempt = studentTestAttempt({
          maxPoints: 9,
          answers: [
            studentTestAnswer({
              id: 'answer-category',
              testItemId: 'item-category',
              maxPoints: 3,
              responseData: { assignments: [] },
            }),
            studentTestAnswer({
              id: 'answer-blanks',
              testItemId: 'item-blanks',
              maxPoints: 3,
              responseData: { answers: [] },
            }),
            studentTestAnswer({
              id: 'answer-hotspot',
              testItemId: 'item-hotspot',
              maxPoints: 3,
              responseData: {},
            }),
          ],
        })
        test = { ...test, stateStatus: 'IN_PROGRESS', attempt }
        return HttpResponse.json(attempt)
      }),
      http.put(
        `${API_BASE_URL}/test-attempts/attempt-1/answers/:itemId`,
        async ({ params, request }) => {
          saved.set(String(params.itemId), await request.json())
          return HttpResponse.json(test.attempt)
        },
      ),
      http.post(`${API_BASE_URL}/test-attempts/attempt-1/submit`, () => {
        submitted = true
        return HttpResponse.json(
          studentTestAttempt({
            status: 'GRADED',
            maxPoints: 9,
            scorePoints: 9,
            scorePercent: 100,
            isPassed: true,
            answers: [],
          }),
        )
      }),
    )

    renderStudentReader('/app/student/lessons/lesson-1')
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    const dialog = await screen.findByRole('dialog', { name: 'History check' })
    await user.click(within(dialog).getByRole('button', { name: 'Start' }))
    const categorySelects = await within(dialog).findAllByRole('combobox')
    await user.selectOptions(categorySelects[0]!, categoryA)
    await user.selectOptions(categorySelects[1]!, categoryB)
    await user.click(within(dialog).getByRole('button', { name: 'Next' }))
    await user.type(
      within(dialog).getByRole('textbox', { name: /Blank/ }),
      'Kyiv',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Next' }))
    const sliders = within(dialog).getAllByRole('slider')
    fireEvent.change(sliders[0]!, { target: { value: '0.6' } })
    fireEvent.change(sliders[1]!, { target: { value: '0.4' } })
    await user.click(
      within(dialog).getByRole('button', { name: 'Finish test' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Finish this attempt?' }),
      ).getByRole('button', { name: 'Submit answers' }),
    )

    await waitFor(() => expect(submitted).toBe(true))
    expect(saved.get('item-category')).toEqual({
      responseData: {
        assignments: [
          { itemId: 'oak', categoryId: categoryA },
          { itemId: 'wolf', categoryId: categoryB },
        ],
      },
    })
    expect(saved.get('item-blanks')).toEqual({
      responseData: { answers: [{ blankId: blankA, text: 'Kyiv' }] },
    })
    expect(saved.get('item-hotspot')).toEqual({
      responseData: { x: 0.6, y: 0.4 },
    })
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
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1/tests`, () =>
        HttpResponse.json([completed]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () =>
        HttpResponse.json(completed),
      ),
    )

    renderStudentReader('/app/student/lessons/lesson-1')

    await user.click(await screen.findByRole('button', { name: 'View' }))
    expect(screen.getAllByText('3 / 5 points')).toHaveLength(2)
    expect(screen.getByText(/3 \/ 5 points.*60%/)).toBeInTheDocument()
    expect(screen.getByText('Test passed')).toBeInTheDocument()
  })

  it('autosaves MAP_POINT and reveals its solution only after the final attempt', async () => {
    const user = userEvent.setup()
    const savedBodies: unknown[] = []
    const preset = mapPresetFixture()
    let test = studentTest({
      title: 'Map check',
      description: 'Find the requested city.',
      maxAttempts: 1,
      items: [
        {
          id: 'item-1',
          position: 0,
          maxPoints: 5,
          assignmentId: 'assignment-map',
          assignmentRevisionId: 'revision-map',
          type: 'MAP_POINT',
          title: 'Find Kyiv',
          prompt: 'Mark Kyiv on the map.',
          instructions: null,
          publicConfig: { initialProjection: 'MERCATOR' },
          mapPreset: preset,
        },
      ],
    })
    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json({
          ...studentLesson(),
          content: 'Read this lesson first.',
          class: { id: 'class-1', name: 'Grade 9-A' },
          teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
        }),
      ),
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1/tests`, () =>
        HttpResponse.json([test]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () =>
        HttpResponse.json(test),
      ),
      http.post(`${API_BASE_URL}/test-releases/release-1/attempts`, () => {
        const attempt = studentTestAttempt({
          answers: [studentTestAnswer({ responseData: {} })],
        })
        test = { ...test, stateStatus: 'IN_PROGRESS', attempt }
        return HttpResponse.json(attempt)
      }),
      http.put(
        `${API_BASE_URL}/test-attempts/attempt-1/answers/item-1`,
        async ({ request }) => {
          savedBodies.push(await request.json())
          return HttpResponse.json(test.attempt)
        },
      ),
      http.post(`${API_BASE_URL}/test-attempts/attempt-1/submit`, () => {
        const attempt = studentTestAttempt({
          status: 'GRADED',
          scorePoints: 5,
          scorePercent: 100,
          isPassed: true,
          submittedAt: '2026-08-13T12:00:00.000Z',
          gradedAt: '2026-08-13T12:00:00.000Z',
          answers: [
            studentTestAnswer({
              status: 'GRADED',
              responseData: { longitude: 30.5, latitude: 50.45 },
              scorePoints: 5,
              scorePercent: 100,
              isCorrect: true,
              solutionFeedback: {
                target: { longitude: 30.5234, latitude: 50.4501 },
                radiusKm: 100,
                distanceKm: 1.66,
                withinRadius: true,
              },
            }),
          ],
        })
        test = { ...test, stateStatus: 'COMPLETED', attempt }
        return HttpResponse.json(attempt)
      }),
    )

    renderStudentReader('/app/student/lessons/lesson-1')
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    const dialog = await screen.findByRole('dialog', { name: 'Map check' })
    await user.click(within(dialog).getByRole('button', { name: 'Start' }))
    const activeMap = await within(dialog).findByTestId('map-canvas-mock')
    expect(activeMap).not.toHaveAttribute('data-radius')
    await user.click(
      within(activeMap).getByRole('button', { name: 'Mark student answer' }),
    )
    await waitFor(
      () =>
        expect(savedBodies).toEqual([
          { responseData: { longitude: 30.5, latitude: 50.45 } },
        ]),
      { timeout: 2_500 },
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Finish test' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Finish this attempt?' }),
      ).getByRole('button', { name: 'Submit answers' }),
    )

    await waitFor(() =>
      expect(within(dialog).getByTestId('map-canvas-mock')).toHaveAttribute(
        'data-radius',
        '100',
      ),
    )
    const resultMap = within(dialog).getByTestId('map-canvas-mock')
    expect(resultMap).toHaveAttribute('data-radius', '100')
    expect(resultMap).toHaveAttribute('data-point', '30.5234,50.4501')
    expect(resultMap).toHaveAttribute('data-comparison', '30.5,50.45')
  })

  it('autosaves MAP_REGION and reveals the correct region only after the final attempt', async () => {
    const user = userEvent.setup()
    const savedBodies: unknown[] = []
    const preset = mapPresetFixture()
    let test = studentTest({
      title: 'Country check',
      description: 'Choose the requested country.',
      maxAttempts: 1,
      items: [
        {
          id: 'item-1',
          position: 0,
          maxPoints: 5,
          assignmentId: 'assignment-region',
          assignmentRevisionId: 'revision-region',
          type: 'MAP_REGION',
          title: 'Choose a country',
          prompt: 'Select the requested country on the map.',
          instructions: null,
          publicConfig: { initialProjection: 'GLOBE' },
          mapPreset: preset,
        },
      ],
    })
    server.use(
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1`, () =>
        HttpResponse.json({
          ...studentLesson(),
          content: 'Read this lesson first.',
          class: { id: 'class-1', name: 'Grade 9-A' },
          teacher: { id: 'teacher-1', displayName: 'Olena Koval' },
        }),
      ),
      http.get(`${API_BASE_URL}/classes/me/lessons/lesson-1/tests`, () =>
        HttpResponse.json([test]),
      ),
      http.get(`${API_BASE_URL}/test-releases/release-1`, () =>
        HttpResponse.json(test),
      ),
      http.post(`${API_BASE_URL}/test-releases/release-1/attempts`, () => {
        const attempt = studentTestAttempt({
          answers: [studentTestAnswer({ responseData: {} })],
        })
        test = { ...test, stateStatus: 'IN_PROGRESS', attempt }
        return HttpResponse.json(attempt)
      }),
      http.put(
        `${API_BASE_URL}/test-attempts/attempt-1/answers/item-1`,
        async ({ request }) => {
          savedBodies.push(await request.json())
          return HttpResponse.json(test.attempt)
        },
      ),
      http.post(`${API_BASE_URL}/test-attempts/attempt-1/submit`, () => {
        const attempt = studentTestAttempt({
          status: 'GRADED',
          scorePoints: 0,
          scorePercent: 0,
          isPassed: false,
          submittedAt: '2026-08-13T12:00:00.000Z',
          gradedAt: '2026-08-13T12:00:00.000Z',
          answers: [
            studentTestAnswer({
              status: 'GRADED',
              responseData: { regionId: 'PRI' },
              scorePoints: 0,
              scorePercent: 0,
              isCorrect: false,
              solutionFeedback: {
                correctRegionId: 'IND',
                matches: false,
              },
            }),
          ],
        })
        test = { ...test, stateStatus: 'COMPLETED', attempt }
        return HttpResponse.json(attempt)
      }),
    )

    renderStudentReader('/app/student/lessons/lesson-1')
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    const dialog = await screen.findByRole('dialog', { name: 'Country check' })
    await user.click(within(dialog).getByRole('button', { name: 'Start' }))
    const activeMap = await within(dialog).findByTestId('map-canvas-mock')
    expect(activeMap).not.toHaveAttribute('data-regions-comparison')
    await user.click(
      within(activeMap).getByRole('button', { name: 'Choose Puerto Rico' }),
    )
    await waitFor(
      () =>
        expect(savedBodies).toEqual([{ responseData: { regionId: 'PRI' } }]),
      { timeout: 2_500 },
    )
    expect(activeMap).toHaveAttribute('data-regions', 'PRI')

    await user.click(
      within(dialog).getByRole('button', { name: 'Finish test' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Finish this attempt?' }),
      ).getByRole('button', { name: 'Submit answers' }),
    )

    await waitFor(() =>
      expect(within(dialog).getByTestId('map-canvas-mock')).toHaveAttribute(
        'data-regions-comparison',
        'IND',
      ),
    )
    const resultMap = within(dialog).getByTestId('map-canvas-mock')
    expect(resultMap).toHaveAttribute('data-regions', 'PRI')
    expect(resultMap).toHaveAttribute('data-regions-comparison', 'IND')
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
    expect(
      screen.getByRole('link', { name: 'Back to class' }),
    ).toBeInTheDocument()
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
        mapPreset: null,
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
    solutionFeedback: null,
    ...overrides,
  }
}

function mapPresetFixture() {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    key: 'world-adm0',
    name: 'World countries',
    contentLocale: 'UK' as const,
    sourceType: 'BUILT_IN' as const,
    status: 'ACTIVE' as const,
    baseMapMode: 'STANDARD' as const,
    geojsonUrl: '/maps/world-adm0.geojson',
    idProperty: 'featureId',
    year: null,
    periodLabel: null,
    attribution: 'geoBoundaries',
    bounds: { west: -180, south: -85, east: 180, north: 85 },
    defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
    originalFileName: null,
    fileSizeBytes: null,
    featureCount: null,
    vertexCount: null,
    geometryLocked: false,
  }
}
