import { expect, test, type Page } from '@playwright/test'

const teacher = {
  id: 'teacher-olena',
  email: 'teacher@example.com',
  role: 'TEACHER',
  status: 'ACTIVE',
  emailVerifiedAt: '2026-08-01T09:00:00.000Z',
  profile: {
    displayName: 'Олена Коваль',
    avatarUrl: null,
    bio: null,
    gradeLevel: null,
    subjectArea: 'Історія України',
    preferredLocale: 'UK',
  },
}

const lessons = [
  lessonSummary({
    id: 'lesson-revolution',
    title: 'Українська революція 1917–1921',
    summary:
      'Як українці відновлювали державність і чому змагання за незалежність стало визначальним.',
    status: 'PUBLISHED',
    estimatedMinutes: 25,
    classLinks: [
      classLink('class-9a', '9-А · Історичні дослідники', true, 0),
      classLink('class-9b', '9-Б', false, 0),
    ],
  }),
  lessonSummary({
    id: 'lesson-rus',
    title: 'Київська Русь за князя Ярослава',
    summary:
      'Політика, культура та міжнародні зв’язки середньовічної держави.',
    status: 'DRAFT',
    estimatedMinutes: null,
    classLinks: [],
  }),
  lessonSummary({
    id: 'lesson-cossacks',
    title: 'Козацька доба',
    summary:
      'Архівний матеріал про виникнення козацтва та Запорозьку Січ.',
    status: 'ARCHIVED',
    estimatedMinutes: 18,
    classLinks: [classLink('class-8a', '8-А', false, 0)],
  }),
]

const classrooms = [
  classroom('class-9a', '9-А · Історичні дослідники'),
  classroom('class-9b', '9-Б'),
  classroom('class-8a', '8-А'),
]

const lessonAssignments = [
  {
    id: 'task-causes',
    lessonId: 'lesson-revolution',
    assignmentId: 'assignment-causes',
    revisionId: 'revision-causes-v1',
    revisionVersion: 1,
    type: 'WRITTEN',
    contentLocale: 'UK',
    maxPoints: 5,
    passingPercent: 60,
    hasUpdate: false,
    activeReleaseCount: 1,
    releaseCount: 1,
    linkedAt: '2026-08-01T10:15:00.000Z',
    title: 'Поясніть причини революції',
    prompt:
      'Назвіть дві передумови Української революції та коротко поясніть їхній вплив.',
    position: 0,
    isRequired: true,
    createdAt: '2026-08-01T10:15:00.000Z',
    updatedAt: '2026-08-01T10:15:00.000Z',
  },
  {
    id: 'task-source',
    lessonId: 'lesson-revolution',
    assignmentId: 'assignment-source',
    revisionId: 'revision-source-v1',
    revisionVersion: 1,
    type: 'WRITTEN',
    contentLocale: 'UK',
    maxPoints: 5,
    passingPercent: 60,
    hasUpdate: false,
    activeReleaseCount: 0,
    releaseCount: 0,
    linkedAt: '2026-08-01T10:20:00.000Z',
    title: 'Проаналізуйте джерело',
    prompt: 'Сформулюйте головну думку наведеного уривка.',
    position: 1,
    isRequired: true,
    createdAt: '2026-08-01T10:20:00.000Z',
    updatedAt: '2026-08-01T10:20:00.000Z',
  },
]

const assignmentReviews = [
  {
    id: 'submission-sofia',
    attemptId: 'submission-sofia',
    releaseId: 'release-causes-9a',
    assignmentId: 'assignment-causes',
    type: 'WRITTEN',
    assignmentTitle: 'Поясніть причини революції',
    prompt: 'Назвіть дві передумови та коротко поясніть їхній вплив.',
    responseText:
      'Національний рух посилився, а падіння імперії створило можливість відновити державність.',
    attemptNumber: 1,
    maxPoints: 5,
    passingPercent: 60,
    scorePoints: null,
    scorePercent: null,
    isPassed: null,
    taskId: 'task-causes',
    taskTitle: 'Поясніть причини революції',
    taskPosition: 0,
    taskIsRequired: true,
    answerText:
      'Національний рух посилився, а падіння імперії створило можливість відновити державність.',
    status: 'AWAITING_REVIEW',
    teacherComment: null,
    submittedAt: '2026-08-01T13:10:00.000Z',
    reviewedAt: null,
    updatedAt: '2026-08-01T13:10:00.000Z',
    student: { id: 'student-sofia', displayName: 'Софія Марченко' },
    class: { id: 'class-9a', name: '9-А · Історичні дослідники' },
  },
]

test('teacher lesson library uses large horizontal rows on desktop day', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareTeacherSession(page, 'day')
  await page.route(
    /^http:\/\/localhost:3000\/lessons(?:\?.*)?$/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lessons),
      })
    },
  )

  await page.goto('/app/teacher/lessons')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Мої уроки', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Створити урок' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Пошук уроків' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Статус' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Мої уроки' }),
  ).toHaveAttribute('aria-current', 'page')

  const lessonRows = page.locator('main article')
  await expect(lessonRows).toHaveCount(3)
  await expect(
    page.getByRole('heading', { name: 'Українська революція 1917–1921' }),
  ).toBeVisible()
  await expect(page.getByText('9-А · Історичні дослідники')).toBeVisible()
  await expect(
    lessonRows.first().getByText('Опубліковано', { exact: true }),
  ).toBeVisible()

  const firstRowBox = await lessonRows.first().boundingBox()
  expect(firstRowBox).not.toBeNull()
  expect(firstRowBox!.width).toBeGreaterThan(firstRowBox!.height * 3)
  expect(firstRowBox!.height).toBeGreaterThan(130)
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('teacher-lessons-library-desktop-day.png'),
    fullPage: true,
  })
})

test('lesson editor and class assignment stay usable on mobile night', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareTeacherSession(page, 'night')
  await page.route('**/lessons/lesson-revolution', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...lessons[0],
        content:
          'На початку XX століття українське суспільство шукало шлях до власної держави.\n\nУрок поєднує текст і запитання для обговорення.',
      }),
    })
  })
  await page.route('**/classes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(classrooms),
    })
  })
  await page.route('**/lessons/lesson-revolution/assignments', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lessonAssignments),
    })
  })
  await page.route(
    '**/lessons/lesson-revolution/assignment-attempts',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(assignmentReviews),
      })
    },
  )

  await page.goto('/app/teacher/lessons/lesson-revolution/edit')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', {
      name: 'Українська революція 1917–1921',
      level: 1,
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Відкрити меню' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Класи', level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Приховати' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Додати', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: /^Назва уроку/ }),
  ).toHaveValue('Українська революція 1917–1921')
  await expect(
    page.getByRole('textbox', { name: /^Текст уроку/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Зберегти зміни' }).first(),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Завдання уроку', level: 2 }),
  ).toBeVisible()
  await expect(
    page
      .getByLabel('Завдання уроку')
      .getByRole('heading', {
        name: 'Поясніть причини революції',
        level: 3,
      }),
  ).toBeVisible()
  await expect(page.getByText('Софія Марченко')).toBeVisible()
  await expect(page.locator('#lesson-assignments-title')).toBeVisible()
  await expect(page.locator('#lesson-reviews-title')).toBeVisible()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
  const classHeadingBox = await page
    .getByRole('heading', { name: 'Класи', level: 2 })
    .boundingBox()
  const titleInputBox = await page
    .getByRole('textbox', { name: /^Назва уроку/ })
    .boundingBox()
  expect(classHeadingBox).not.toBeNull()
  expect(titleInputBox).not.toBeNull()
  expect(classHeadingBox!.y).toBeGreaterThan(titleInputBox!.y)
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('teacher-lesson-editor-mobile-night.png'),
    fullPage: true,
  })
})

async function prepareTeacherSession(
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
        accessToken: 'lessons-visual-access-token',
        user: teacher,
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

function lessonSummary(overrides: Record<string, unknown>) {
  return {
    id: 'lesson',
    title: '',
    summary: '',
    contentLocale: 'UK',
    estimatedMinutes: null,
    status: 'DRAFT',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    classLinks: [],
    ...overrides,
  }
}

function classLink(
  classId: string,
  className: string,
  published: boolean,
  position: number,
) {
  return {
    classId,
    className,
    position,
    publishedAt: published ? '2026-08-01T12:30:00.000Z' : null,
  }
}

function classroom(id: string, name: string) {
  return {
    id,
    name,
    studentCount: 18,
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
  }
}
