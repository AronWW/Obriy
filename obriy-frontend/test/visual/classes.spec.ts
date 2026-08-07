import { expect, test, type Page } from '@playwright/test'

const classroom = {
  id: 'class-8a',
  name: '8-А · Історичні дослідники',
  studentCount: 3,
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-07-28T12:00:00.000Z',
}

const classmates = [
  {
    id: 'student-maria',
    displayName: 'Марія Коваль',
    avatarUrl: null,
    gradeLevel: 8,
  },
  {
    id: 'student-ostap',
    displayName: 'Остап Мельник',
    avatarUrl: null,
    gradeLevel: 8,
  },
]

test('teacher class detail balances the roster and invitation controls', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareSession(page, 'TEACHER', 'day')
  await page.route('http://localhost:3000/classes/class-8a', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(classroom),
    })
  })
  await page.route(
    'http://localhost:3000/classes/class-8a/members',
    async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        ...classmates,
        {
          id: 'student-sofia',
          displayName: 'Софія Бондар',
          avatarUrl: null,
          gradeLevel: 8,
        },
      ]),
    })
    },
  )
  await page.route(
    'http://localhost:3000/classes/class-8a/invite',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'ABCD-EFGH' }),
      })
    },
  )

  await page.goto('/app/teacher/classes/class-8a')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', {
      name: '8-А · Історичні дослідники',
      level: 1,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Учні класу' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Код запрошення' }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('teacher-class-detail-desktop.png'),
    fullPage: true,
  })
})

test('student class and classmates remain usable on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareSession(page, 'STUDENT', 'night')
  await page.route('**/classes/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...classroom,
        teacher: { id: 'teacher-olena', displayName: 'Олена Коваль' },
      }),
    })
  })
  await page.route('**/classes/me/classmates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(classmates),
    })
  })

  await page.goto('/app/student/classes')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', {
      name: '8-А · Історичні дослідники',
      level: 1,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Однокласники' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Відкрити профіль' })).toHaveCount(
    2,
  )
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('student-class-mobile-night.png'),
    fullPage: true,
  })
})

async function prepareSession(
  page: Page,
  role: 'STUDENT' | 'TEACHER',
  theme: 'day' | 'night',
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
        accessToken: 'classes-visual-access-token',
        user: {
          id: role === 'TEACHER' ? 'teacher-olena' : 'student-current',
          email:
            role === 'TEACHER'
              ? 'teacher@example.com'
              : 'student@example.com',
          role,
          status: 'ACTIVE',
          emailVerifiedAt: '2026-07-18T12:00:00.000Z',
          profile: {
            displayName: role === 'TEACHER' ? 'Олена Коваль' : 'Арія Косміна',
            avatarUrl: null,
            bio: null,
            gradeLevel: role === 'STUDENT' ? 8 : null,
            subjectArea: role === 'TEACHER' ? 'Історія України' : null,
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
