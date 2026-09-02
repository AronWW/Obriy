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
          profile: {
            displayName: 'Map Teacher',
            avatarUrl: null,
            bio: null,
            gradeLevel: null,
            subjectArea: 'History',
            preferredLocale: 'EN',
          },
        },
      }),
    })
  })
}

async function mockMapCatalog(page: Page) {
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
          geojsonUrl: '/maps/ukraine-adm1.geojson',
          idProperty: 'featureId',
          year: 2017,
          attribution: 'geoBoundaries UKR ADM1 · ODbL 1.0',
          bounds: { west: 21.8, south: 44.2, east: 40.3, north: 52.5 },
          defaultViewport: { longitude: 31.2, latitude: 48.8, zoom: 4.6 },
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
