import { expect, test, type Page } from '@playwright/test'

const viewports = [
  {
    height: 900,
    language: 'en',
    name: 'desktop',
    theme: 'day',
    width: 1440,
  },
  {
    height: 900,
    language: 'uk',
    name: 'compact-desktop',
    theme: 'night',
    width: 1024,
  },
  {
    height: 844,
    language: 'en',
    name: 'mobile',
    theme: 'night',
    width: 390,
  },
] as const

const editorRoutes = [
  { key: 'categorization', path: '/app/teacher/tasks/new/categorization' },
  { key: 'fill-blanks', path: '/app/teacher/tasks/new/fill_blanks' },
  { key: 'image-hotspot', path: '/app/teacher/tasks/new/image_hotspot' },
  { key: 'map-point', path: '/app/teacher/tasks/new/map_point' },
  { key: 'map-region', path: '/app/teacher/tasks/new/map_region' },
  {
    key: 'map-multi-region',
    path: '/app/teacher/tasks/new/map_multi_region',
  },
] as const

for (const viewport of viewports) {
  test(`teacher assignment libraries use the workspace heading on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareTeacherWorkspace(page, viewport.language, viewport.theme)

    for (const route of ['/app/teacher/tasks', '/app/teacher/tests']) {
      await page.goto(route)
      await page.emulateMedia({ reducedMotion: 'reduce' })

      const heading = page.getByRole('heading', { level: 1 }).first()
      await expect(heading).toBeVisible()
      const fontSize = await heading.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      )
      expect(fontSize).toBeGreaterThanOrEqual(34)
      await expectNoHorizontalOverflow(page)
      await page.screenshot({
        path: testInfo.outputPath(
          `teacher-${route.endsWith('tasks') ? 'assignments' : 'tests'}-${viewport.name}.png`,
        ),
        fullPage: true,
      })
    }
  })

  test(`interactive and map editors stay aligned on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareTeacherWorkspace(page, viewport.language, viewport.theme)

    for (const editor of editorRoutes) {
      await page.goto(editor.path)
      await page.emulateMedia({ reducedMotion: 'reduce' })

      const heading = page.getByRole('heading', { level: 1 }).first()
      const backButton = page.locator('header button').first()
      await expect(heading).toBeVisible()
      await expect(backButton).toBeVisible()

      const headingBox = await heading.boundingBox()
      const backBox = await backButton.boundingBox()
      const headingLineHeight = await heading.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).lineHeight),
      )
      expect(headingBox).not.toBeNull()
      expect(backBox).not.toBeNull()
      expect(
        Math.abs(
          backBox!.y + backBox!.height / 2 -
            (headingBox!.y + headingLineHeight / 2),
        ),
      ).toBeLessThanOrEqual(8)

      await expectNoHorizontalOverflow(page)
      await page.screenshot({
        path: testInfo.outputPath(
          `teacher-${editor.key}-${viewport.name}.png`,
        ),
        fullPage: true,
      })
    }
  })
}

test('single selects use the shared inset chevron', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await prepareTeacherWorkspace(page, 'en', 'night')
  await page.goto('/app/teacher/tasks/new/map_point')

  const select = page.locator('select').first()
  await expect(select).toBeVisible()
  const styles = await select.evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      appearance: computed.appearance,
      backgroundImage: computed.backgroundImage,
      backgroundPosition: computed.backgroundPosition,
      paddingRight: Number.parseFloat(computed.paddingRight),
    }
  })

  expect(styles.appearance).toBe('none')
  expect(styles.backgroundImage).not.toBe('none')
  expect(styles.backgroundPosition).toContain('14px')
  expect(styles.paddingRight).toBeGreaterThanOrEqual(40)
})

test('main teacher create actions share one visual style', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepareTeacherWorkspace(page, 'en', 'day')
  const routes = [
    '/app/teacher/tasks',
    '/app/teacher/tests',
    '/app/teacher/classes',
    '/app/teacher/lessons',
    '/app/teacher/maps',
  ]
  let reference: CreateActionStyle | null = null

  for (const route of routes) {
    await page.goto(route)
    const action = page.locator('header .teacher-create-action').first()
    await expect(action).toBeVisible()
    const style = await action.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
        color: computed.color,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        height: element.getBoundingClientRect().height,
        paddingLeft: computed.paddingLeft,
        paddingRight: computed.paddingRight,
      }
    })

    expect(style.height).toBe(42)
    if (reference === null) reference = style
    else expect(style).toEqual(reference)
  }
})

interface CreateActionStyle {
  backgroundColor: string
  borderRadius: string
  color: string
  fontSize: string
  fontWeight: string
  height: number
  paddingLeft: string
  paddingRight: string
}

async function prepareTeacherWorkspace(
  page: Page,
  language: 'en' | 'uk',
  theme: 'day' | 'night',
) {
  await page.addInitScript(
    ({ selectedLanguage, selectedTheme }) => {
      localStorage.setItem('obriy-night-default-v1', 'done')
      localStorage.setItem('obriy-theme', selectedTheme)
      localStorage.setItem('obriy-language', selectedLanguage)
      localStorage.setItem('obriy-has-session', '1')
    },
    { selectedLanguage: language, selectedTheme: theme },
  )

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'teacher-assignment-layout-token',
        user: {
          id: 'teacher-assignment-layout',
          email: 'teacher@example.com',
          role: 'TEACHER',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-17T12:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: 'Layout Teacher',
            avatarUrl: null,
            bio: null,
            subjectArea: 'History',
            preferredLocale: language === 'uk' ? 'UK' : 'EN',
          },
        },
      }),
    })
  })
  await page.route('**/assignments?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null }),
    })
  })
  await page.route('**/tests?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null }),
    })
  })
  await page.route('**/map-presets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  })
  await page.route('**/map-presets/mine*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/map-drafts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('http://localhost:3000/classes', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('http://localhost:3000/lessons', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
