import { expect, test, type Page } from '@playwright/test'

const student = {
  id: 'student-maksym',
  email: 'student@example.com',
  role: 'STUDENT',
  status: 'ACTIVE',
  emailVerifiedAt: '2026-08-01T09:00:00.000Z',
  hasPassword: true,
  profile: {
    displayName: 'Максим Бондар',
    avatarUrl: null,
    bio: null,
    subjectArea: null,
    preferredLocale: 'UK',
  },
}

const classroom = {
  id: 'class-9a',
  name: '9-А · Історичні дослідники',
  studentCount: 18,
  createdAt: '2026-07-20T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
  teacher: { id: 'teacher-olena', displayName: 'Олена Коваль' },
}

const lessons = [
  {
    id: 'lesson-revolution',
    title: 'Українська революція 1917–1921',
    summary:
      'Як українці відновлювали державність і чому змагання за незалежність стало визначальним.',
    contentLocale: 'UK',
    estimatedMinutes: 25,
    position: 0,
    progress: {
      status: 'IN_PROGRESS',
      requiredTotal: 2,
      completed: 1,
      awaitingReview: 1,
      needsRevision: 0,
      inProgress: 0,
      expired: 0,
    },
  },
  {
    id: 'lesson-rus',
    title: 'Київська Русь за князя Ярослава',
    summary:
      'Політика, культура та міжнародні зв’язки середньовічної держави.',
    contentLocale: 'UK',
    estimatedMinutes: null,
    position: 1,
    progress: {
      status: 'NO_TASKS',
      requiredTotal: 0,
      completed: 0,
      awaitingReview: 0,
      needsRevision: 0,
      inProgress: 0,
      expired: 0,
    },
  },
]

test('student class shows lesson rows before classmates on desktop day', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareStudentSession(page, 'day')
  await mockStudentClass(page)

  await page.goto('/app/student/classes')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const lessonsHeading = page.getByRole('heading', { name: 'Уроки', level: 2 })
  const classmatesHeading = page.getByRole('heading', {
    name: 'Однокласники',
    level: 2,
  })
  await expect(lessonsHeading).toBeVisible()
  await expect(classmatesHeading).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Українська революція 1917–1921',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', {
      name: 'Відкрити урок «Українська революція 1917–1921»',
    }),
  ).toBeVisible()

  const lessonsBox = await lessonsHeading.boundingBox()
  const classmatesBox = await classmatesHeading.boundingBox()
  expect(lessonsBox).not.toBeNull()
  expect(classmatesBox).not.toBeNull()
  expect(lessonsBox!.y).toBeLessThan(classmatesBox!.y)

  const firstLessonRow = lessonsHeading
    .locator('xpath=ancestor::section[1]')
    .locator('li')
    .first()
  const rowBox = await firstLessonRow.boundingBox()
  expect(rowBox).not.toBeNull()
  expect(rowBox!.width).toBeGreaterThan(rowBox!.height * 4)
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('student-class-lessons-desktop-day.png'),
    fullPage: true,
  })
})

test('student lesson reader stays focused and readable on mobile night', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareStudentSession(page, 'night')
  await page.route('**/classes/me/lessons/lesson-revolution', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...lessons[0],
        content:
          'На початку XX століття українське суспільство шукало шлях до власної держави.\n\nУ цьому уроці простежимо ключові події та постаті революції.\nЗверніть увагу на причинно-наслідкові зв’язки.',
        class: { id: classroom.id, name: classroom.name },
        teacher: classroom.teacher,
      }),
    })
  })
  await page.route(
    '**/classes/me/lessons/lesson-revolution/assignments',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            releaseId: 'release-causes',
            assignmentId: 'assignment-causes',
            revisionId: 'revision-causes',
            type: 'WRITTEN',
            title: 'Причини революції',
            prompt:
              'Назвіть дві причини революції та коротко поясніть їхній вплив.',
            instructions: null,
            publicConfig: {
              responseMode: 'LONG',
              minLength: 0,
              maxLength: 5000,
              allowAttachments: false,
              rubric: [],
            },
            maxPoints: 5,
            passingPercent: 60,
            isRequired: true,
            dueAt: null,
            stateStatus: 'NOT_STARTED',
            attempt: null,
          },
        ]),
      })
    },
  )

  await page.goto('/app/student/lessons/lesson-revolution')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', {
      name: 'Українська революція 1917–1921',
      level: 1,
    }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Назад до класу' })).toBeVisible()
  await expect(page.getByText(classroom.name)).toBeVisible()
  await expect(page.getByText('Олена Коваль')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Текст уроку' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Завдання до уроку', level: 2 }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Причини революції' }),
  ).toBeVisible()
  await expect(
    page.getByText('У цьому уроці простежимо ключові події та постаті революції.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Відкрити меню' })).toBeVisible()
  await expect(page.getByRole('button', { name: /заверш/i })).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('student-lesson-reader-mobile-night.png'),
    fullPage: true,
  })
})

async function prepareStudentSession(
  page: Page,
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
        accessToken: 'student-lessons-visual-token',
        user: student,
      }),
    })
  })
}

async function mockStudentClass(page: Page) {
  await page.route('**/classes/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(classroom),
    })
  })
  await page.route('**/classes/me/classmates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'student-sofiia',
          displayName: 'Софія Мельник',
          avatarUrl: null,
        },
        {
          id: 'student-andrii',
          displayName: 'Андрій Левченко',
          avatarUrl: null,
        },
      ]),
    })
  })
  await page.route('**/classes/me/lessons', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lessons),
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
