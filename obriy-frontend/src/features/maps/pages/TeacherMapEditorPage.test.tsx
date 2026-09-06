import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import { API_BASE_URL } from '../../../shared/config/env'
import { ThemeProvider } from '../../../shared/theme/ThemeProvider'
import { server } from '../../../test/server'
import type { EditorFeatureCollection } from '../model/map.types'
import { TeacherMapEditorPage } from './TeacherMapEditorPage'

vi.mock('../components/MapDrawingCanvas', () => ({
  MapDrawingCanvas: forwardRef(
    (
      {
        onChange,
      }: {
        onChange: (collection: EditorFeatureCollection, features: unknown[]) => void
      },
      ref,
    ) => {
      void ref
      return <button
        onClick={() => {
          const collection = sampleCollection()
          onChange(collection, [
            {
              ...collection.features[0],
              id: 'shape-1',
              properties: {
                ...collection.features[0]!.properties,
                mode: 'polygon',
              },
            },
          ])
        }}
        type="button"
      >
        Simulate drawing
      </button>
    },
  ),
}))

describe('TeacherMapEditorPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('loads a server draft and saves edited geometry with version checks', async () => {
    const user = userEvent.setup()
    let version = 1
    let geometrySaved = false
    server.use(
      http.get(`${API_BASE_URL}/map-drafts/draft-1`, () =>
        HttpResponse.json(draft(version)),
      ),
      http.get(`${API_BASE_URL}/map-drafts/draft-1/geojson`, () =>
        HttpResponse.json({ type: 'FeatureCollection', features: [] }),
      ),
      http.patch(`${API_BASE_URL}/map-drafts/draft-1`, async ({ request }) => {
        const body = (await request.json()) as { expectedEditVersion: number }
        expect(body.expectedEditVersion).toBe(version)
        version += 1
        return HttpResponse.json(draft(version))
      }),
      http.put(`${API_BASE_URL}/map-drafts/draft-1/geojson`, async ({ request }) => {
        const body = await request.formData()
        expect(body.get('expectedEditVersion')).toBe(String(version))
        expect(body.get('file')).toBeTruthy()
        geometrySaved = true
        version += 1
        return HttpResponse.json({ ...draft(version), featureCount: 1 })
      }),
    )
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Draft kingdom' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Simulate drawing' }))
    expect(screen.getByDisplayValue('Kingdom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(geometrySaved).toBe(true))
    expect(await screen.findByText('All changes saved')).toBeInTheDocument()
    expect(version).toBe(3)
  })
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/teacher/maps/editor/draft-1']}>
          <Routes>
            <Route
              path="/app/teacher/maps/editor/:draftId"
              element={<TeacherMapEditorPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

function draft(editVersion: number) {
  return {
    id: 'draft-1',
    sourcePresetId: null,
    name: 'Draft kingdom',
    contentLocale: 'EN',
    periodLabel: '1400',
    attribution: '',
    geojsonUrl: '/map-drafts/draft-1/geojson',
    originalFileName: null,
    fileSizeBytes: null,
    featureCount: 0,
    vertexCount: 0,
    bounds: null,
    defaultViewport: null,
    editVersion,
    updatedAt: '2026-09-06T12:00:00.000Z',
  }
}

function sampleCollection(): EditorFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { regionId: 'kingdom', name: 'Kingdom' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [10, 40],
              [20, 40],
              [20, 50],
              [10, 50],
              [10, 40],
            ],
          ],
        },
      },
    ],
  }
}
