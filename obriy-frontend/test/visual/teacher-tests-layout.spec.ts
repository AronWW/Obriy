import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'compact-desktop', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test(`teacher test actions stay clear of global controls on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareTeacherSession(page)
    await page.route('**/tests?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], nextCursor: null }),
      })
    })

    await page.goto('/app/teacher/tests')
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await expect(page.getByRole('heading', { level: 1, name: 'Tests' })).toBeVisible()
    await expect(page.getByText('Assessment lab')).toHaveCount(0)

    const globalControls = page.locator('[aria-label="Global settings"]')
    const createAction = page.getByRole('button', { name: 'Create test' }).first()
    await expect(globalControls).toBeVisible()
    await expect(createAction).toBeVisible()
    expect(
      rectanglesOverlap(
        await globalControls.boundingBox(),
        await createAction.boundingBox(),
      ),
    ).toBe(false)

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)

    await page.screenshot({
      path: testInfo.outputPath(`teacher-tests-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number } | null,
  second: { x: number; y: number; width: number; height: number } | null,
) {
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  return !(
    first!.x + first!.width <= second!.x ||
    second!.x + second!.width <= first!.x ||
    first!.y + first!.height <= second!.y ||
    second!.y + second!.height <= first!.y
  )
}

async function prepareTeacherSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('obriy-theme', 'day')
    localStorage.setItem('obriy-language', 'en')
    localStorage.setItem('obriy-has-session', '1')
  })

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'teacher-tests-layout-token',
        user: {
          id: 'teacher-tests-layout',
          email: 'teacher@example.com',
          role: 'TEACHER',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-07T12:00:00.000Z',
          profile: {
            displayName: 'Layout Teacher',
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
