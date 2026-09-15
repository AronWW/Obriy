import { expect, test, type Page } from '@playwright/test'

test('teacher profile remains inside the desktop sidebar shell', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareTeacherSession(page, 'day')

  await page.goto('/app/teacher/profile')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Профіль учителя' }),
  ).toBeVisible()
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Профіль' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(
    page.getByRole('textbox', { name: 'Ім’я та прізвище' }),
  ).toHaveValue('Олена Коваль')
  const sidebar = await page.getByRole('complementary').boundingBox()
  const document = await page.getByTestId('teacher-profile-document').boundingBox()
  expect(sidebar).not.toBeNull()
  expect(document).not.toBeNull()
  const availableCenter = (sidebar!.x + sidebar!.width + 1440) / 2
  const documentCenter = document!.x + document!.width / 2
  expect(Math.abs(documentCenter - availableCenter)).toBeLessThanOrEqual(1)
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('teacher-profile-desktop.png'),
    fullPage: true,
  })
})

test('teacher profile form stays linear beside the mobile drawer trigger', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareTeacherSession(page, 'night')

  await page.goto('/app/teacher/profile')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Профіль учителя' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Відкрити меню' }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Коротко про себе' }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('teacher-profile-mobile-night.png'),
    fullPage: true,
  })
})

async function prepareTeacherSession(page: Page, theme: 'day' | 'night') {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', 'uk')
    localStorage.setItem('obriy-has-session', '1')
  }, theme)

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'teacher-profile-access-token',
        user: {
          id: 'teacher-profile-user',
          email: 'teacher@example.com',
          role: 'TEACHER',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-07-18T12:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: 'Олена Коваль',
            avatarUrl: null,
            bio: 'Допомагаю учням бачити зв’язки між подіями.',
            subjectArea: 'Історія України',
            preferredLocale: 'UK',
          },
        },
      }),
    })
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
