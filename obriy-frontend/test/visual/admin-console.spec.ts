import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop-day-en', width: 1440, height: 900, theme: 'day', language: 'en' },
  { name: 'compact-night-uk', width: 1024, height: 900, theme: 'night', language: 'uk' },
  { name: 'mobile-day-uk', width: 390, height: 844, theme: 'day', language: 'uk' },
] as const

for (const viewport of viewports) {
  test(`admin overview stays usable on ${viewport.name}`, async ({ page }, testInfo) => {
    const pageErrors: Error[] = []
    page.on('pageerror', error => pageErrors.push(error))
    await page.setViewportSize(viewport)
    await prepareAdmin(page, viewport.theme, viewport.language)
    await page.goto('/app/admin')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByRole('heading', { level: 1, name: viewport.language === 'en' ? 'Platform overview' : 'Огляд платформи' })).toBeVisible({ timeout: 15_000 })
    expect(pageErrors.map(error => error.message)).toEqual([])
    await expect(page.getByText(viewport.language === 'en' ? 'Open cases' : 'Відкриті кейси')).toBeVisible()

    if (viewport.width <= 1020) {
      await page.getByRole('button', { name: 'Menu' }).click()
      await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible()
    } else {
      await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible()
    }

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
    await page.screenshot({ path: testInfo.outputPath(`admin-${viewport.name}.png`), fullPage: true })
  })
}

async function prepareAdmin(page: Page, theme: 'day' | 'night', language: 'en' | 'uk') {
  await page.addInitScript(({ selectedTheme, selectedLanguage }) => {
    localStorage.setItem('obriy-night-default-v1', 'done')
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', selectedLanguage)
    localStorage.setItem('obriy-has-session', '1')
  }, { selectedTheme: theme, selectedLanguage: language })
  await page.route('**/auth/refresh', async route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ accessToken: 'admin-token', user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: '2026-09-01T00:00:00.000Z', hasPassword: true, profile: { displayName: 'Obriy Admin', avatarUrl: null, bio: null, subjectArea: null, preferredLocale: language === 'en' ? 'EN' : 'UK' } } }) }))
  await page.route('**/admin/dashboard', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users: 84, students: 52, teachers: 12, parents: 19, pendingUsers: 2, suspendedUsers: 1, newUsersLast30Days: 11, classes: 9, publishedLessons: 31, publishedReleases: 24, messagesLast30Days: 126, openModerationCases: 3 }) }))
  await page.route('**/notifications/unread-count', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unreadCount: 0 }) }))
}
