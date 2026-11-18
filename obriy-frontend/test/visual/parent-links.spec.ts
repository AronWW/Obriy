import { expect, test, type Page } from '@playwright/test'

const invitationToken = 'P'.repeat(43)

test('parent invitation landing stays clear before authentication', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('obriy-night-default-v1', 'done')
    localStorage.setItem('obriy-theme', 'night')
    localStorage.setItem('obriy-language', 'uk')
  })

  await page.goto(`/parent-invite?token=${invitationToken}`)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Вас запросили до Obriy' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Увійти' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Створити профіль батька/ }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('parent-invitation-landing-mobile-night.png'),
    fullPage: true,
  })
})

test('parent confirms only the invited child inside the compact shell', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await prepareParentSession(page)
  await page.route('**/parent-links/invitation/preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        child: {
          id: 'child-maria',
          displayName: 'Марія Коваль',
          avatarUrl: null,
        },
        alreadyLinked: false,
      }),
    })
  })

  await page.goto('/app/parent/connect')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Марія Коваль' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Підключити дитину' }),
  ).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('parent-invitation-confirm-desktop.png'),
    fullPage: true,
  })
})

async function prepareParentSession(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('obriy-night-default-v1', 'done')
    localStorage.setItem('obriy-theme', 'day')
    localStorage.setItem('obriy-language', 'uk')
    localStorage.setItem('obriy-has-session', '1')
    localStorage.setItem(
      'obriy-parent-invitation',
      JSON.stringify({ token, storedAt: Date.now() }),
    )
  }, invitationToken)

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'parent-link-visual-token',
        user: {
          id: 'parent-olena',
          email: 'parent@example.com',
          role: 'PARENT',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-07-18T12:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: 'Олена Коваль',
            avatarUrl: null,
            bio: null,
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
