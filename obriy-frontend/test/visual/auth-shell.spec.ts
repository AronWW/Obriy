import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
]

for (const viewport of viewports) {
  for (const theme of ['day', 'night'] as const) {
    test(`home shell fits ${theme} ${viewport.name}`, async ({ page }, testInfo) => {
      await prepareAnonymousSession(page, theme)
      await page.setViewportSize(viewport)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await page
        .getByRole('heading', {
          name: 'Вивчай історію, граючи й досліджуючи',
        })
        .waitFor()

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))

      expect(layout.scrollWidth).toBe(layout.clientWidth)
      await expect(
        page.locator('header').getByRole('link', { name: /Зареєструватися|Register/ }),
      ).toHaveCount(0)
      await expect(
        page
          .getByLabel(/Основні дії|Primary actions/)
          .getByRole('link', { name: /Увійти|Sign in/ }),
      ).toBeVisible()

      await page.screenshot({
        path: testInfo.outputPath(`home-${theme}-${viewport.name}.png`),
        fullPage: true,
      })
    })

    test(`login shell fits ${theme} ${viewport.name}`, async ({ page }, testInfo) => {
      await prepareAnonymousSession(page, theme)
      await page.setViewportSize(viewport)
      await page.goto('/auth/login')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.getByRole('heading', { name: /З поверненням|Welcome back/ }).waitFor()

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))

      expect(layout.scrollWidth).toBe(layout.clientWidth)
      await expect(page.getByLabel(/Електронна пошта|Email/)).toBeVisible()
      await expect(page.getByLabel(/Пароль|Password/, { exact: true })).toBeVisible()

      await expect(page.locator('#auth-story-title')).toHaveCount(0)

      const panelCenterOffset = await page.locator('main > section').evaluate((panel) => {
        const panelRect = panel.getBoundingClientRect()
        return Math.abs(
          panelRect.left +
            panelRect.width / 2 -
            document.documentElement.clientWidth / 2,
        )
      })

      expect(panelCenterOffset).toBeLessThanOrEqual(1)

      await page.screenshot({
        path: testInfo.outputPath(`login-${theme}-${viewport.name}.png`),
        fullPage: true,
      })
    })
  }
}

test('anonymous visitor is redirected from app to login', async ({ page }) => {
  await prepareAnonymousSession(page, 'day')
  await page.goto('/app')

  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(page.getByRole('heading', { name: 'З поверненням' })).toBeVisible()
})

test('anonymous visitor does not request a session refresh', async ({ page }) => {
  let refreshRequests = 0
  await prepareAnonymousSession(page, 'day', () => {
    refreshRequests += 1
  })

  await page.goto('/')
  await page
    .getByRole('heading', {
      name: 'Вивчай історію, граючи й досліджуючи',
    })
    .waitFor()

  expect(refreshRequests).toBe(0)
})

test('home authentication actions move into the header after leaving the hero', async ({
  page,
}) => {
  await prepareAnonymousSession(page, 'night')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page
    .getByRole('heading', {
      name: 'Вивчай історію, граючи й досліджуючи',
    })
    .waitFor()

  const headerRegister = page
    .locator('header')
    .getByRole('link', { name: /Зареєструватися|Register/ })
  const heroActions = page.getByRole('group', { name: /Основні дії|Primary actions/ })
  const header = page.locator('header')

  await expect(headerRegister).toHaveCount(0)
  await expect(header).toHaveAttribute('data-surface', 'hidden')

  await heroActions.evaluate((element) => {
    window.scrollBy({ top: element.getBoundingClientRect().top - 20 })
  })
  await expect(heroActions).toBeInViewport()
  await expect(headerRegister).toHaveCount(0)
  await expect(header).toHaveAttribute('data-surface', 'hidden')

  await page.evaluate(() => window.scrollBy({ top: 120 }))
  await expect(heroActions).not.toBeInViewport()
  await expect(headerRegister).toBeVisible()
  await expect(header).toHaveAttribute('data-surface', 'visible')
  await expect
    .poll(() =>
      header.evaluate((element) => getComputedStyle(element, '::before').opacity),
    )
    .toBe('1')

  await page.evaluate(() => window.scrollTo({ top: 0 }))
  await expect(headerRegister).toHaveCount(0)
  await expect(header).toHaveAttribute('data-surface', 'hidden')
  await expect
    .poll(() =>
      header.evaluate((element) => getComputedStyle(element, '::before').opacity),
    )
    .toBe('0')
})

test('home scroll cue moves smoothly to the next section', async ({ page }) => {
  await prepareAnonymousSession(page, 'night')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  const scrollCue = page.getByRole('link', { name: 'Перейти до наступного розділу' })
  await scrollCue.waitFor()
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth')

  const scrollSamples = await scrollCue.evaluate(async (element) => {
    element.click()
    const samples: number[] = []

    for (let index = 0; index < 12; index += 1) {
      await new Promise(requestAnimationFrame)
      samples.push(Math.round(window.scrollY))
    }

    return samples
  })

  expect(new Set(scrollSamples).size).toBeGreaterThan(3)
  expect(scrollSamples.at(-1)).toBeGreaterThan(scrollSamples[0])
  await expect(page).toHaveURL(/#journey$/)
  await expect
    .poll(() => page.locator('#journey').evaluate((element) => element.getBoundingClientRect().top))
    .toBeLessThan(200)
  const targetTop = await page
    .locator('#journey')
    .evaluate((element) => element.getBoundingClientRect().top)
  expect(targetTop).toBeGreaterThan(0)
})

test('day horizon vessels keep the hero scroll cue and lighthouse clear', async ({
  page,
}) => {
  await prepareAnonymousSession(page, 'day')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const spacing = await page.evaluate(() => {
    const cue = document.querySelector<HTMLElement>('a[href="#journey"]')
    const centerVessel = document.querySelector<SVGGElement>('[data-vessel="center"]')
    const rightVessel = document.querySelector<SVGGElement>('[data-vessel="right"]')
    const dayLayer = centerVessel?.closest('div')
    const lighthouse = dayLayer?.querySelector<SVGElement>('svg[class*="lighthouseScene"]')

    if (!cue || !centerVessel || !rightVessel || !lighthouse) {
      throw new Error('Day horizon geometry is incomplete')
    }

    return {
      center: centerVessel.getBoundingClientRect().toJSON(),
      cue: cue.getBoundingClientRect().toJSON(),
      lighthouse: lighthouse.getBoundingClientRect().toJSON(),
      right: rightVessel.getBoundingClientRect().toJSON(),
    }
  })

  expect(spacing.center.left).toBeGreaterThan(spacing.cue.right + 24)
  expect(spacing.right.left).toBeGreaterThan(spacing.center.right + 80)
  expect(spacing.right.right).toBeLessThan(spacing.lighthouse.left - 40)
})

for (const viewport of viewports) {
  test(`hero geometry remains stable when language changes on ${viewport.name}`, async ({
    page,
  }) => {
    await prepareAnonymousSession(page, 'night')
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page
      .getByRole('heading', { name: 'Вивчай історію, граючи й досліджуючи' })
      .waitFor()
    await page.evaluate(() => document.fonts.ready)

    const ukrainianGeometry = await readHeroGeometry(page)

    await page.locator('#journey').scrollIntoViewIfNeeded()
    await page.locator('#home-header-actions').waitFor()
    const ukrainianHeaderGeometry = await readHeaderActionsGeometry(page)

    await page.evaluate(() => window.scrollTo({ top: 0 }))
    await expect(page.locator('#home-header-actions')).toHaveCount(0)

    await page.getByRole('button', { name: 'Мова інтерфейсу' }).click()
    await page.getByRole('heading', { name: 'Learn history by playing and exploring' }).waitFor()

    const englishGeometry = await readHeroGeometry(page)

    await page.locator('#journey').scrollIntoViewIfNeeded()
    await page.locator('#home-header-actions').waitFor()
    const englishHeaderGeometry = await readHeaderActionsGeometry(page)

    expect(englishGeometry).toEqual(ukrainianGeometry)
    expect(englishHeaderGeometry).toEqual(ukrainianHeaderGeometry)
    expect(englishGeometry.titleOverflows).toBe(false)
    expect(englishGeometry.descriptionOverflows).toBe(false)
  })
}

async function prepareAnonymousSession(
  page: Page,
  theme: 'day' | 'night',
  onRefresh = () => undefined,
) {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', 'uk')
  }, theme)

  await page.route('**/auth/refresh', async (route) => {
    onRefresh()
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
}

async function readHeroGeometry(page: Page) {
  return page.evaluate(() => {
    const title = document.querySelector<HTMLElement>('#home-title')
    const description = document.querySelector<HTMLElement>('#home-description')
    const actions = document.querySelector<HTMLElement>('#home-actions')
    const primaryAction = actions?.querySelector<HTMLElement>('a')

    if (!title || !description || !actions || !primaryAction) {
      throw new Error('Hero geometry elements are missing.')
    }

    const titleRect = title.getBoundingClientRect()
    const descriptionRect = description.getBoundingClientRect()
    const actionsRect = actions.getBoundingClientRect()
    const primaryActionRect = primaryAction.getBoundingClientRect()

    return {
      titleHeight: Math.round(titleRect.height),
      descriptionTop: Math.round(descriptionRect.top),
      descriptionHeight: Math.round(descriptionRect.height),
      actionsTop: Math.round(actionsRect.top),
      actionsHeight: Math.round(actionsRect.height),
      primaryActionWidth: Math.round(primaryActionRect.width),
      titleOverflows: title.scrollWidth > title.clientWidth || title.scrollHeight > title.clientHeight,
      descriptionOverflows:
        description.scrollWidth > description.clientWidth ||
        description.scrollHeight > description.clientHeight,
    }
  })
}

async function readHeaderActionsGeometry(page: Page) {
  return page.evaluate(() => {
    const actions = document.querySelector<HTMLElement>('#home-header-actions')
    const links = actions?.querySelectorAll<HTMLElement>('a')

    if (!actions || !links || links.length === 0) {
      throw new Error('Header actions are missing.')
    }

    const actionsRect = actions.getBoundingClientRect()

    return {
      width: Math.round(actionsRect.width),
      right: Math.round(actionsRect.right),
      height: Math.round(actionsRect.height),
      linkWidths: [...links].map((link) => Math.round(link.getBoundingClientRect().width)),
    }
  })
}
