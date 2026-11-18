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
  await expect(page.getByText('500 XP')).toBeVisible()
  await expect(page.getByText(/Рівень/i)).toBeVisible()
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
  await prepareStudentSession(page, 'night', null, 'en')

  await page.goto('/app/student/profile')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.getByRole('button', { name: 'Customize profile' }).click()

  await expect(
    page.getByRole('heading', { name: 'Update profile' }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Profile name' }),
  ).toHaveValue('Арія Косміна')
  await expect(
    page.getByRole('textbox', { name: 'About you' }),
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
  language: 'en' | 'uk' = 'uk',
) {
  await page.addInitScript(({ selectedLanguage, selectedTheme }) => {
    localStorage.setItem('obriy-night-default-v1', 'done')
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', selectedLanguage)
    localStorage.setItem('obriy-has-session', '1')
  }, { selectedLanguage: language, selectedTheme: theme })

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
          hasPassword: true,
          profile: {
            displayName: 'Арія Косміна',
            avatarUrl: null,
            bio,
            subjectArea: null,
            preferredLocale: language === 'en' ? 'EN' : 'UK',
          },
        },
      }),
    })
  })

  await page.route('**/parent-links/me/guardians', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'guardian-olena',
          displayName: 'Олена Косміна',
          avatarUrl: null,
          linkedAt: '2026-07-20T12:00:00.000Z',
        },
      ]),
    })
  })

  await page.route('**/parent-links/invitation', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'null',
    })
  })

  await page.route('**/gamification/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        progress: {
          totalXp: 500,
          level: 2,
          levelStartXp: 500,
          nextLevelXp: 1500,
          xpIntoLevel: 0,
          xpForNextLevel: 1000,
        },
        showcase: [badgeFixture],
        badges: [badgeFixture],
      }),
    })
  })

  await page.route('**/gamification/me/rewards/unseen', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ xp: [], badges: [] }),
    })
  })
}

const badgeFixture = {
  id: '11111111-1111-4111-8111-111111111111',
  key: 'FIRST_STEP',
  iconKey: 'footprints',
  name: 'Перший крок',
  description: 'Успішно складено перший тест.',
  earnedAt: '2026-09-10T12:00:00.000Z',
  showcasePosition: 1,
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
