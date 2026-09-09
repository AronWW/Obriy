import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'wide-desktop', width: 1920, height: 1080 },
]

for (const viewport of viewports) {
  for (const theme of ['day', 'night'] as const) {
    test(`${theme} theme fits ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('obriy-theme', selectedTheme)
        localStorage.setItem('obriy-language', 'uk')
        localStorage.setItem('obriy-has-session', '1')
      }, theme)
      await mockAuthenticatedSession(page)
      await page.goto('/app')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.getByRole('navigation').waitFor()
      await page.getByRole('heading', { name: 'Огляд' }).waitFor()

      const layout = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth
        const viewportHeight = window.innerHeight
        const overflowingElements = [...document.querySelectorAll('header *, main *')]
          .filter((element) => {
            const htmlElement = element as HTMLElement
            const style = getComputedStyle(htmlElement)
            const rect = htmlElement.getBoundingClientRect()

            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 0 &&
              (rect.left < -1 || rect.right > viewportWidth + 1)
            )
          })
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              element: `${element.tagName.toLowerCase()}.${element.className}`,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }
          })

        const lighthouseRects = [...document.querySelectorAll('svg[class*="lighthouseScene"]')]
          .map((element) => element.getBoundingClientRect())
          .map((rect) => ({
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
          }))

        return {
          clientWidth: viewportWidth,
          lighthouseRects,
          scrollWidth: document.documentElement.scrollWidth,
          overflowingElements,
          viewportHeight,
        }
      })

      expect(layout.scrollWidth).toBe(layout.clientWidth)
      expect(layout.overflowingElements).toEqual([])
      expect(layout.lighthouseRects).toHaveLength(2)
      expect(
        layout.lighthouseRects.every(
          (rect) =>
            rect.width > 0 &&
            rect.height > 0 &&
            rect.left < layout.clientWidth &&
            rect.right > 0 &&
            rect.top < layout.viewportHeight &&
            rect.bottom > 0,
        ),
      ).toBe(true)

      await page.screenshot({
        path: testInfo.outputPath(`${theme}-${viewport.name}.png`),
        fullPage: true,
      })
    })
  }
}

test('student mobile drawer exposes the placeholder routes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('obriy-theme', 'day')
    localStorage.setItem('obriy-language', 'uk')
    localStorage.setItem('obriy-has-session', '1')
  })
  await mockAuthenticatedSession(page)
  await page.goto('/app/student')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.getByRole('button', { name: 'Відкрити меню' }).click()

  const tasksLink = page
    .getByRole('complementary')
    .getByRole('link', { name: 'Мої завдання' })
  await expect(
    page
      .getByRole('complementary')
      .getByRole('button', { name: 'Закрити меню' }),
  ).toBeInViewport()
  await expect(tasksLink).toBeInViewport()
  await page.screenshot({
    path: testInfo.outputPath('day-mobile-menu.png'),
    fullPage: true,
  })

  await tasksLink.click()

  await expect(page).toHaveURL('/app/student/tasks')
  await expect(
    page.getByRole('heading', { name: 'Мої завдання' }),
  ).toBeVisible()
})

test('teacher desktop menu exposes its English placeholder routes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(() => {
    localStorage.setItem('obriy-theme', 'day')
    localStorage.setItem('obriy-language', 'en')
    localStorage.setItem('obriy-has-session', '1')
  })
  await mockAuthenticatedSession(page, 'TEACHER', 'EN')
  await page.route('**/teacher/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stats: {
          classes: { total: 0, studentCount: 0 },
          lessons: { total: 0, drafts: 0 },
          assignments: { total: 0, drafts: 0 },
          tests: { total: 0, drafts: 0 },
          pendingReviews: 0,
        },
        pendingReviews: [],
        recent: { lessons: [], assignments: [], tests: [] },
      }),
    })
  })
  await page.goto('/app/teacher')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'My lessons' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Achievements' }),
  ).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('day-teacher-desktop-en.png'),
    fullPage: true,
  })

  await page.getByRole('link', { name: 'Analytics' }).click()

  await expect(page).toHaveURL('/app/teacher/analytics')
  await expect(
    page.getByRole('heading', { name: 'Analytics' }),
  ).toBeVisible()
})

async function mockAuthenticatedSession(
  page: Page,
  role = 'STUDENT',
  preferredLocale = 'UK',
) {
  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'visual-test-access-token',
        user: {
          id: 'visual-user',
          email: 'student@example.com',
          role,
          status: 'ACTIVE',
          emailVerifiedAt: '2026-07-18T12:00:00.000Z',
          profile: {
            displayName: 'Арія Косміна',
            avatarUrl: null,
            bio: null,
            gradeLevel: 9,
            subjectArea: null,
            preferredLocale,
          },
        },
      }),
    })
  })
}
