import { expect, test, type Page } from '@playwright/test'

test('student profile presents a public-looking desktop showcase', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareStudentSession(
    page,
    'day',
    'Найбільше цікавлюся історією українського козацтва.',
  )

  await page.goto('/app/student/profile')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Арія Косміна', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Вибрані значки' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Колекція досягнень' }),
  ).toBeVisible()
  await expect(page.getByText(/XP/i)).toHaveCount(0)
  await expect(page.getByText(/Рівень/i)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('student-profile-desktop.png'),
    fullPage: true,
  })
})

test('student profile settings remain usable on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareStudentSession(page, 'night', null)

  await page.goto('/app/student/profile')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page
    .getByRole('button', { name: 'Налаштувати профіль' })
    .click()

  await expect(
    page.getByRole('heading', { name: 'Оновити профіль' }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Ім’я у профілі' }),
  ).toHaveValue('Арія Косміна')
  await expect(
    page.getByRole('textbox', { name: 'Коротко про себе' }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('student-profile-editor-mobile-night.png'),
    fullPage: true,
  })
})

async function prepareStudentSession(
  page: Page,
  theme: 'day' | 'night',
  bio: string | null,
) {
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
        accessToken: 'student-profile-access-token',
        user: {
          id: 'student-profile-user',
          email: 'student@example.com',
          role: 'STUDENT',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-07-18T12:00:00.000Z',
          profile: {
            displayName: 'Арія Косміна',
            avatarUrl: null,
            bio,
            gradeLevel: 9,
            subjectArea: null,
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
