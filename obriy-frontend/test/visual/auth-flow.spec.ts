import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
]

const authScreens = [
  {
    name: 'roles',
    path: '/auth/register',
    heading: 'Оберіть свою роль',
    control: { role: 'link' as const, name: /Учень/ },
  },
  {
    name: 'register',
    path: '/auth/register/student',
    heading: 'Створення акаунта',
    control: { role: 'button' as const, name: 'Зареєструватися' },
  },
  {
    name: 'check-email',
    path: '/auth/check-email',
    heading: 'Перевірте пошту',
    control: { role: 'button' as const, name: /Надіслати повторно через/ },
  },
  {
    name: 'forgot-password',
    path: '/auth/forgot-password',
    heading: 'Забули пароль?',
    control: { role: 'button' as const, name: 'Надіслати посилання' },
  },
  {
    name: 'reset-password',
    path: '/auth/reset-password?token=preview-token',
    heading: 'Відновіть доступ',
    control: { role: 'button' as const, name: 'Зберегти новий пароль' },
  },
  {
    name: 'verify-email',
    path: '/auth/verify-email?token=preview-token',
    heading: 'Пошту підтверджено',
    control: { role: 'link' as const, name: 'Увійти в акаунт' },
  },
  {
    name: 'google-role',
    path: '/auth/google/callback?registration=preview-registration-code',
    heading: 'Оберіть свою роль',
    control: { role: 'button' as const, name: /Учень/ },
  },
  {
    name: 'google-cancelled',
    path: '/auth/google/callback?error=GOOGLE_OAUTH_CANCELLED',
    heading: 'Вхід скасовано',
    control: { role: 'link' as const, name: 'Спробувати Google ще раз' },
  },
]

for (const viewport of viewports) {
  for (const theme of ['day', 'night'] as const) {
    for (const screen of authScreens) {
      test(`${screen.name} fits ${theme} ${viewport.name}`, async ({ page }, testInfo) => {
        await prepareAuthPreview(page, theme)
        await page.setViewportSize(viewport)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(screen.path)

        await expect(page.getByRole('heading', { name: screen.heading })).toBeVisible()
        await expect(page.getByRole(screen.control.role, { name: screen.control.name })).toBeVisible()

        const layout = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))

        expect(layout.scrollWidth).toBe(layout.clientWidth)
        await page.screenshot({
          path: testInfo.outputPath(`${screen.name}-${theme}-${viewport.name}.png`),
          fullPage: true,
        })
      })
    }
  }
}

async function prepareAuthPreview(page: Page, theme: 'day' | 'night') {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', 'uk')
    sessionStorage.setItem(
      'obriy-email-verification',
      JSON.stringify({
        email: 'student@example.com',
        nextSendAt: Date.now() + 60_000,
      }),
    )
  }, theme)

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 401,
        code: 'REFRESH_TOKEN_MISSING',
        message: 'Refresh token is missing.',
      }),
    })
  })

  await page.route('**/auth/verify-email', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'EMAIL_VERIFIED',
        message: 'Email verified.',
      }),
    })
  })
}
