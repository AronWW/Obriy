import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, theme: 'day' },
  { name: 'mobile', width: 390, height: 844, theme: 'night' },
] as const

for (const viewport of viewports) {
  test(`MapLibre sandbox renders with WebGL on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareTeacherSession(page, viewport.theme)
    await mockMapCatalog(page)
    await mockOpenFreeMapStyle(page, viewport.theme)

    await page.goto('/app/teacher/maps')
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await expect(
      page.getByRole('heading', { name: 'Map laboratory' }),
    ).toBeVisible()
    const mapRegion = page.getByRole('region', {
      name: 'Interactive learning map',
    })
    await expect(mapRegion).toBeVisible()
    const canvas = mapRegion.locator('canvas.maplibregl-canvas')
    await expect(canvas).toBeVisible()
    await expect(
      page.getByText(
        'This browser or device does not support the WebGL required for the interactive map.',
      ),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Initial view' }),
    ).toBeVisible()

    const hasWebGl = await canvas.evaluate((element) => {
      const mapCanvas = element as HTMLCanvasElement
      return Boolean(
        mapCanvas.getContext('webgl2') || mapCanvas.getContext('webgl'),
      )
    })
    expect(hasWebGl).toBe(true)

    await page.getByRole('button', { name: 'Globe' }).click()
    await expect(page.getByRole('button', { name: 'Globe' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: 'Initial view' }).click()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)

    await page.screenshot({
      path: testInfo.outputPath(`map-sandbox-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

test('teacher previews and saves a historical custom GeoJSON map', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareTeacherSession(page, 'day')
  await mockMapCatalog(page)
  await mockOpenFreeMapStyle(page, 'day')
  let created = false
  const source = historicalGeoJson()

  await page.route('**/map-presets/custom/inspect', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        labelProperties: ['historicalName'],
        featureCount: 2,
        vertexCount: 10,
      }),
    })
  })
  await page.route('**/map-drafts/import', async (route) => {
    created = true
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(mapDraft()),
    })
  })
  await page.route('**/map-drafts/custom-draft/geojson', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/geo+json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: source.features.map((feature, index) => ({
          ...feature,
          properties: {
            regionId: `region-${index + 1}`,
            name: feature.properties.historicalName,
          },
        })),
      }),
    })
  })
  await page.route('**/map-drafts/custom-draft', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mapDraft()),
    })
  })
  await page.route('**/map-presets/mine*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(created ? [customPreset()] : []),
    })
  })
  await page.route('**/map-presets/custom-1/geojson', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/geo+json',
      body: JSON.stringify(source),
    })
  })

  await page.goto('/app/teacher/maps')
  await page.getByRole('button', { name: 'Add your map' }).click()
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'europe-1400.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(JSON.stringify(source)),
  })

  await expect(
    page.getByRole('heading', { name: 'Add a GeoJSON map' }),
  ).toBeVisible()
  await expect(page.getByText('2 regions')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Region name property' })).toHaveValue(
    'historicalName',
  )
  await expect(
    page.locator('canvas.maplibregl-canvas').last(),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('custom-map-import.png'),
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Save map' }).click()
  await expect(
    page.getByRole('heading', { name: 'europe-1400' }),
  ).toBeVisible()
  await expect(
    page.getByRole('application', { name: 'Map geometry editor' }),
  ).toBeVisible()
  await expect(page.getByText('2 regions')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('custom-map-editor-desktop.png'),
    fullPage: true,
  })
  expect(created).toBe(true)
})

test('map editor renders with WebGL on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareTeacherSession(page, 'night')
  await mockOpenFreeMapStyle(page, 'night')
  const source = historicalGeoJson()

  await page.route('**/map-drafts/custom-draft/geojson', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/geo+json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: source.features.map((feature, index) => ({
          ...feature,
          properties: {
            regionId: `region-${index + 1}`,
            name: feature.properties.historicalName,
          },
        })),
      }),
    })
  })
  await page.route('**/map-drafts/custom-draft', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mapDraft()),
    })
  })

  await page.goto('/app/teacher/maps/editor/custom-draft')
  const editor = page.getByRole('application', { name: 'Map geometry editor' })
  await expect(editor).toBeVisible()
  await expect(page.getByText('2 regions')).toBeVisible()
  const canvas = editor.locator('canvas.maplibregl-canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('button', { name: 'Draw polygon' })).toBeVisible()

  const hasWebGl = await canvas.evaluate((element) => {
    const mapCanvas = element as HTMLCanvasElement
    return Boolean(mapCanvas.getContext('webgl2') || mapCanvas.getContext('webgl'))
  })
  expect(hasWebGl).toBe(true)

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)

  await page.screenshot({
    path: testInfo.outputPath('custom-map-editor-mobile.png'),
    fullPage: true,
  })
})

test('teacher draws, names and cancels regions on a blank map', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareTeacherSession(page, 'day')
  await page.route('**/map-drafts/blank-draft', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...mapDraft(),
        id: 'blank-draft',
        name: 'Blank historical map',
        geojsonUrl: null,
        featureCount: 0,
        vertexCount: 0,
        bounds: null,
        defaultViewport: null,
      }),
    })
  })

  await page.goto('/app/teacher/maps/editor/blank-draft')
  const editor = page.getByRole('application', { name: 'Map geometry editor' })
  await expect(editor).toBeVisible()
  await page.getByRole('button', { name: 'Draw polygon' }).click()

  const box = await editor.boundingBox()
  expect(box).not.toBeNull()
  const points = [
    [box!.x + box!.width * 0.28, box!.y + box!.height * 0.35],
    [box!.x + box!.width * 0.68, box!.y + box!.height * 0.35],
    [box!.x + box!.width * 0.68, box!.y + box!.height * 0.68],
    [box!.x + box!.width * 0.28, box!.y + box!.height * 0.68],
  ]
  for (const [x, y] of points) await page.mouse.click(x!, y!)

  const finish = page.getByRole('button', { name: 'Finish region' })
  await expect(finish).toBeEnabled()
  await finish.click()

  const naming = page.getByRole('dialog', { name: 'Name the new region' })
  await expect(naming).toBeVisible()
  const nameInput = naming.getByRole('textbox', { name: 'Region name' })
  await expect(nameInput).toHaveValue('Region 1')
  await nameInput.fill('Western Kingdom')
  await naming.getByRole('button', { name: 'Save name' }).click()

  await expect(
    page.getByRole('textbox', { name: 'Region name' }),
  ).toHaveValue('Western Kingdom')
  await expect(page.getByText(/1 region/)).toBeVisible()
  const undo = page.getByRole('button', { name: 'Undo' })
  await expect(undo).toBeEnabled()
  await undo.click()
  const redo = page.getByRole('button', { name: 'Redo' })
  await expect(redo).toBeEnabled()
  await redo.click()
  await expect(
    page.getByRole('textbox', { name: 'Region name' }),
  ).toHaveValue('Western Kingdom')

  await page.getByRole('button', { name: 'Draw polygon' }).click()
  await page.mouse.click(box!.x + box!.width * 0.45, box!.y + box!.height * 0.45)
  await page.mouse.click(box!.x + box!.width * 0.55, box!.y + box!.height * 0.45)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('1 region')).toBeVisible()

  await page.screenshot({
    path: testInfo.outputPath('custom-map-drawing.png'),
    fullPage: true,
  })
})

async function prepareTeacherSession(page: Page, theme: 'day' | 'night') {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', 'en')
    localStorage.setItem('obriy-has-session', '1')
  }, theme)

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'map-sandbox-access-token',
        user: {
          id: 'map-teacher',
          email: 'teacher@example.com',
          role: 'TEACHER',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-08-25T12:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: 'Map Teacher',
            avatarUrl: null,
            bio: null,
            subjectArea: 'History',
            preferredLocale: 'EN',
          },
        },
      }),
    })
  })
}

async function mockMapCatalog(page: Page) {
  await page.route('**/map-drafts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  })
  await page.route('**/map-presets/mine*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  })
  await page.route('**/map-presets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'preset-ukraine',
          key: 'ukraine-adm1',
          name: 'Regions of Ukraine',
          contentLocale: 'UK',
          sourceType: 'BUILT_IN',
          status: 'ACTIVE',
          baseMapMode: 'STANDARD',
          geojsonUrl: '/maps/ukraine-adm1.geojson',
          idProperty: 'featureId',
          year: 2017,
          periodLabel: null,
          attribution: 'geoBoundaries UKR ADM1 · ODbL 1.0',
          bounds: { west: 21.8, south: 44.2, east: 40.3, north: 52.5 },
          defaultViewport: { longitude: 31.2, latitude: 48.8, zoom: 4.6 },
          originalFileName: null,
          fileSizeBytes: null,
          featureCount: null,
          vertexCount: null,
          geometryLocked: false,
        },
      ]),
    })
  })
}

async function mockOpenFreeMapStyle(page: Page, theme: 'day' | 'night') {
  await page.route('https://tiles.openfreemap.org/styles/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'Map sandbox smoke style',
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': theme === 'night' ? '#172029' : '#e8ece9',
            },
          },
        ],
      }),
    })
  })
}

function historicalGeoJson() {
  const polygon = (name: string, west: number, east: number) => ({
    type: 'Feature',
    properties: { historicalName: name },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, 45],
          [east, 45],
          [east, 52],
          [west, 52],
          [west, 45],
        ],
      ],
    },
  })
  return {
    type: 'FeatureCollection',
    features: [polygon('Kingdom A', 5, 15), polygon('Kingdom B', 15, 25)],
  }
}

function customPreset() {
  return {
    id: 'custom-1',
    key: 'custom-custom-1',
    name: 'europe-1400',
    contentLocale: 'EN',
    sourceType: 'CUSTOM_GEOJSON',
    status: 'ACTIVE',
    baseMapMode: 'NEUTRAL',
    geojsonUrl: '/map-presets/custom-1/geojson',
    idProperty: 'regionId',
    year: null,
    periodLabel: null,
    attribution: '',
    bounds: { west: 5, south: 45, east: 25, north: 52 },
    defaultViewport: { longitude: 15, latitude: 48.5, zoom: 3.5 },
    originalFileName: 'europe-1400.geojson',
    fileSizeBytes: 800,
    featureCount: 2,
    vertexCount: 10,
    geometryLocked: false,
  }
}

function mapDraft() {
  return {
    id: 'custom-draft',
    sourcePresetId: null,
    name: 'europe-1400',
    contentLocale: 'EN',
    periodLabel: null,
    attribution: '',
    geojsonUrl: '/map-drafts/custom-draft/geojson',
    originalFileName: 'europe-1400.geojson',
    fileSizeBytes: 800,
    featureCount: 2,
    vertexCount: 10,
    bounds: { west: 5, south: 45, east: 25, north: 52 },
    defaultViewport: { longitude: 15, latitude: 48.5, zoom: 3.5 },
    editVersion: 1,
    updatedAt: '2026-09-06T12:00:00.000Z',
  }
}
