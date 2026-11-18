import { expect, test, type Page } from '@playwright/test'

test('night theme is the default and an old day preference is migrated once', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')

  await page.evaluate(() => {
    localStorage.setItem('obriy-theme', 'day')
    localStorage.removeItem('obriy-night-default-v1')
  })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')

  await page.getByRole('button', { name: 'Увімкнути денну тему' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
})

test('desktop journey and role selection end at the compact footer', async ({
  page,
}, testInfo) => {
  await prepareHome(page, 'day')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await page.locator('#journey').scrollIntoViewIfNeeded()
  await expect(page.locator('#journey-title')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('journey-day-desktop.png'),
  })

  await page.locator('#roles').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Учитель' }).click()
  await expect(page.getByRole('heading', { name: 'Створюй маршрути для класу' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Створити акаунт вчителя' })).toHaveAttribute(
    'href',
    '/auth/register/teacher',
  )
  await expect(page.getByRole('button', { name: 'Учень' })).toHaveCSS(
    'color',
    'rgb(23, 49, 67)',
  )
  await page.screenshot({
    path: testInfo.outputPath('roles-teacher-day-desktop.png'),
  })

  await page.locator('#page-footer').scrollIntoViewIfNeeded()
  await expect(page.locator('#page-footer')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('page-end-day-desktop.png'),
  })
})

test('night mobile role path and compact footer fit the viewport', async ({ page }, testInfo) => {
  await prepareHome(page, 'night')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await page.locator('#roles').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Батьки' }).click()
  await expect(
    page.getByRole('heading', { name: 'Бачте шлях дитини без зайвого контролю' }),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('roles-parent-night-mobile.png'),
  })

  await page.locator('#page-footer').scrollIntoViewIfNeeded()
  await expect(page.locator('#page-footer')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('page-end-night-mobile.png'),
  })
})

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900, maxFooterHeight: 40 },
  { name: 'mobile', width: 390, height: 844, maxFooterHeight: 38 },
]) {
  test(`compact footer remains at the document end on ${viewport.name}`, async ({
    page,
  }) => {
    await prepareHome(page, 'day')
    await page.setViewportSize(viewport)
    await page.goto('/')

    const footerGeometry = await page.locator('#page-footer').evaluate((footer) => {
      const rect = footer.getBoundingClientRect()
      const documentHeight = document.documentElement.scrollHeight

      return {
        bottom: Math.round((rect.bottom + window.scrollY) * 100) / 100,
        documentHeight,
        height: Math.round(rect.height * 100) / 100,
        position: getComputedStyle(footer).position,
      }
    })

    expect(footerGeometry.position).toBe('relative')
    expect(footerGeometry.height).toBeLessThanOrEqual(viewport.maxFooterHeight)
    expect(Math.abs(footerGeometry.bottom - footerGeometry.documentHeight)).toBeLessThanOrEqual(1)
  })
}

test('journey marker follows the SVG route and unlocks chapters at its nodes', async ({
  page,
}, testInfo) => {
  await prepareHome(page, 'day')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' })

  const stage = page.locator('#journey-stage')
  await stage.scrollIntoViewIfNeeded()

  const routeSetup = await stage.evaluate((element) => ({
    approach: Number(element.getAttribute('data-node-approach')),
    nodeProgresses: Array.from(element.querySelectorAll('[data-route-node]')).map((node) =>
      Number((node as SVGElement).dataset.progress),
    ),
  }))

  expect(routeSetup.approach).toBeGreaterThanOrEqual(0.08)

  const dayCardSurface = await page.locator('[data-chapter-card="0"]').evaluate((card) => {
    const style = getComputedStyle(card)
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
    }
  })

  expect(dayCardSurface.backgroundImage).toBe('none')
  expect(dayCardSurface.backgroundColor).toBe('rgb(230, 221, 205)')

  expect(routeSetup.nodeProgresses).toHaveLength(3)
  expect(routeSetup.nodeProgresses[0]).toBeGreaterThan(0)
  expect(routeSetup.nodeProgresses[1]).toBeGreaterThan(routeSetup.nodeProgresses[0])
  expect(routeSetup.nodeProgresses[2]).toBeGreaterThan(routeSetup.nodeProgresses[1])
  expect(routeSetup.nodeProgresses[2]).toBeLessThan(1)

  const beforeFirstNode = Math.max(
    0.04,
    routeSetup.nodeProgresses[0] - routeSetup.approach - 0.035,
  )
  await scrollJourneyToProgress(page, beforeFirstNode)
  await expect(page.locator('[data-chapter-index][data-state="active"]')).toHaveCount(0)
  await expectMarkerOnRoute(page)

  for (const [index, nodeProgress] of routeSetup.nodeProgresses.entries()) {
    const revealProgress = nodeProgress - routeSetup.approach + 0.012
    await scrollJourneyToProgress(page, revealProgress)

    await expect(page.locator(`[data-chapter-index="${index}"]`)).toHaveAttribute(
      'data-state',
      'active',
    )
    await expect(page.locator(`[data-route-node="${index}"]`)).toHaveAttribute(
      'data-state',
      'active',
    )
    await expect(page.locator('[data-chapter-index][data-state="active"]')).toHaveCount(1)
    await expectMarkerOnRoute(page)
    await page.screenshot({
      path: testInfo.outputPath(`journey-node-${index + 1}.png`),
    })

    if (index > 0) {
      await expect(page.locator(`[data-chapter-index="${index - 1}"]`)).toHaveAttribute(
        'data-state',
        'complete',
      )
    }
  }
})

test('mobile journey keeps the active route and copy in one scene', async ({
  page,
}, testInfo) => {
  await prepareHome(page, 'night')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' })

  const routeSetup = await page.locator('#journey-stage').evaluate((element) => ({
    approach: Number(element.getAttribute('data-node-approach')),
    nodeProgresses: Array.from(element.querySelectorAll('[data-route-node]')).map((node) =>
      Number((node as SVGElement).dataset.progress),
    ),
  }))

  for (const [index, nodeProgress] of routeSetup.nodeProgresses.entries()) {
    await scrollJourneyToProgress(
      page,
      nodeProgress - routeSetup.approach + 0.012,
    )
    await expect(page.locator(`[data-chapter-index="${index}"]`)).toHaveAttribute(
      'data-state',
      'active',
    )
    await expectMarkerOnRoute(page)

    const scenePosition = await page.evaluate((chapterIndex) => {
      const header = document.querySelector<HTMLElement>('header')
      const routeVisual = document.querySelector<HTMLElement>('#journey-route-visual')
      const heading = document.querySelector<HTMLElement>(
        `[data-chapter-index="${chapterIndex}"] h3`,
      )
      const marker = document.querySelector<SVGGraphicsElement>(
        '#journey-route-marker',
      )

      if (!header || !routeVisual || !heading || !marker) {
        throw new Error('Mobile journey scene is incomplete')
      }

      return {
        headerBottom: header.getBoundingClientRect().bottom,
        route: routeVisual.getBoundingClientRect().toJSON(),
        heading: heading.getBoundingClientRect().toJSON(),
        marker: marker.getBoundingClientRect().toJSON(),
        viewportHeight: window.innerHeight,
      }
    }, index)

    expect(scenePosition.route.top).toBeGreaterThanOrEqual(scenePosition.headerBottom - 1)
    expect(scenePosition.route.bottom).toBeLessThan(scenePosition.viewportHeight)
    expect(scenePosition.marker.top).toBeGreaterThan(scenePosition.headerBottom)
    expect(scenePosition.marker.bottom).toBeLessThan(scenePosition.viewportHeight)
    expect(scenePosition.heading.top).toBeGreaterThan(scenePosition.headerBottom)
    expect(scenePosition.heading.bottom).toBeLessThan(scenePosition.viewportHeight)

    await page.screenshot({
      path: testInfo.outputPath(`journey-mobile-node-${index + 1}.png`),
    })
  }
})

for (const viewport of [
  { name: 'small phone', width: 320, height: 568 },
  { name: 'tablet', width: 768, height: 900 },
]) {
  test(`compact journey keeps route and all cards readable on ${viewport.name}`, async ({ page }, testInfo) => {
    await prepareHome(page, 'night')
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' })

    const routeSetup = await page.locator('#journey-stage').evaluate((element) => ({
      approach: Number(element.getAttribute('data-node-approach')),
      nodeProgresses: Array.from(element.querySelectorAll('[data-route-node]')).map((node) =>
        Number((node as SVGElement).dataset.progress),
      ),
    }))

    for (const [index, nodeProgress] of routeSetup.nodeProgresses.entries()) {
      await scrollJourneyToProgress(page, nodeProgress - routeSetup.approach + 0.012)
      await expect(page.locator(`[data-chapter-index="${index}"]`)).toHaveAttribute(
        'data-state',
        'active',
      )

      const geometry = await page.evaluate((chapterIndex) => {
        const header = document.querySelector('header')!.getBoundingClientRect()
        const route = document.querySelector('#journey-route-visual')!.getBoundingClientRect()
        const card = document.querySelector(`[data-chapter-card="${chapterIndex}"]`)!.getBoundingClientRect()
        const marker = document.querySelector('#journey-route-marker')!.getBoundingClientRect()
        return {
          headerBottom: header.bottom,
          routeTop: route.top,
          routeBottom: route.bottom,
          cardTop: card.top,
          cardBottom: card.bottom,
          markerBottom: marker.bottom,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }
      }, index)

      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth)
      expect(geometry.routeTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1)
      expect(geometry.routeBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1)
      expect(geometry.cardTop).toBeGreaterThan(geometry.markerBottom + 8)
      expect(geometry.cardBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1)
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-${index + 1}.png`) })
    }
  })
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`journey geometry remains fixed across languages on ${viewport.name}`, async ({
    page,
  }) => {
    await prepareHome(page, 'day')
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.locator('#journey').scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)

    const ukrainianGeometry = await readJourneyCopyGeometry(page)

    await page.locator('#global-language-toggle').click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.lang))
      .toBe('en')

    const englishGeometry = await readJourneyCopyGeometry(page)

    expect(englishGeometry.sizes).toEqual(ukrainianGeometry.sizes)
    expect(ukrainianGeometry.overflowElements).toEqual([])
    expect(englishGeometry.overflowElements).toEqual([])
  })
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`role panel remains fixed across roles and languages on ${viewport.name}`, async ({
    page,
  }) => {
    await prepareHome(page, 'day')
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.locator('#roles').scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)

    const languageFrames = []

    for (const language of ['uk', 'en']) {
      const roleFrames = []

      for (const role of ['student', 'teacher', 'parent']) {
        await page.locator(`[data-role-option="${role}"]`).click()
        await expect(page.locator('#role-details')).toHaveAttribute(
          'data-active-role',
          role,
        )
        await expect(page.locator('[data-role-content]')).toHaveCount(1)
        if (role === 'teacher') {
          await expect(page.getByRole('link', {
            name: language === 'uk' ? 'Створити акаунт вчителя' : 'Create a teacher account',
          })).toBeVisible()
        }

        const geometry = await readRolePanelGeometry(page)
        expect(geometry.overflowElements).toEqual([])
        roleFrames.push(geometry.frame)
      }

      expect(roleFrames[1]).toEqual(roleFrames[0])
      expect(roleFrames[2]).toEqual(roleFrames[0])
      languageFrames.push(roleFrames[0])

      if (language === 'uk') {
        await page.locator('#global-language-toggle').click()
        await expect
          .poll(() => page.evaluate(() => document.documentElement.lang))
          .toBe('en')
      }
    }

    const [ukrainianFrame, englishFrame] = languageFrames
    const { footerTop: ukrainianFooterTop, ...ukrainianStableFrame } =
      ukrainianFrame
    const { footerTop: englishFooterTop, ...englishStableFrame } = englishFrame

    expect(englishStableFrame).toEqual(ukrainianStableFrame)
    expect(Math.abs(englishFooterTop - ukrainianFooterTop)).toBeLessThanOrEqual(1)
  })
}

test('role content crossfades without moving its panel', async ({ page }) => {
  await prepareHome(page, 'night')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('#roles').scrollIntoViewIfNeeded()

  const panel = page.locator('#role-details')
  const panelBefore = await readElementBox(panel)

  await page.locator('[data-role-option="teacher"]').click()
  await expect(panel).toHaveAttribute('data-active-role', 'teacher')
  await expect(page.locator('[data-role-content]')).toHaveCount(2)
  await expect
    .poll(async () =>
      page.locator('[data-role-content]').evaluateAll((elements) =>
        elements.every((element) => {
          const opacity = Number(getComputedStyle(element).opacity)
          return opacity > 0 && opacity < 1
        }),
      ),
    )
    .toBe(true)

  expect(await readElementBox(panel)).toEqual(panelBefore)

  await expect(page.locator('[data-role-content]')).toHaveCount(1)
  expect(await readElementBox(panel)).toEqual(panelBefore)
})

async function scrollJourneyToProgress(page: Page, targetProgress: number) {
  await page.evaluate((progress) => {
    const stage = document.querySelector<HTMLElement>('#journey-stage')

    if (!stage) {
      throw new Error('Journey stage was not found')
    }

    const stageRect = stage.getBoundingClientRect()
    const stageTop = stageRect.top + window.scrollY
    const compact = window.matchMedia('(max-width: 920px)').matches
    const animationStart = stageTop - window.innerHeight * (compact ? 0.55 : 0.7)
    const animationEnd = stageTop + stageRect.height - window.innerHeight * (compact ? 0.32 : 0.45)
    const scrollTop = animationStart + (animationEnd - animationStart) * progress

    window.scrollTo({ top: scrollTop, behavior: 'auto' })
  }, targetProgress)

  await expect
    .poll(
      async () =>
        Number(
          await page.locator('#journey-route-marker').getAttribute('data-progress'),
        ),
      { timeout: 4_000 },
    )
    .toBeCloseTo(targetProgress, 2)
}

async function expectMarkerOnRoute(page: Page) {
  const markerError = await page.locator('#journey-route-marker').evaluate((marker) => {
    const route = document.querySelector<SVGPathElement>('#journey-route-path')
    const markerElement = marker as SVGGElement
    const markerProgress = Number(markerElement.dataset.progress)
    const markerMatrix = markerElement.transform.baseVal.consolidate()?.matrix

    if (!route || !markerMatrix) {
      throw new Error('Journey route geometry is unavailable')
    }

    const expectedPoint = route.getPointAtLength(route.getTotalLength() * markerProgress)
    return Math.hypot(markerMatrix.e - expectedPoint.x, markerMatrix.f - expectedPoint.y)
  })

  expect(markerError).toBeLessThan(0.0002)
}

async function readJourneyCopyGeometry(page: Page) {
  return page.evaluate(() => {
    const introTitle = document.querySelector<HTMLElement>('#journey-title')
    const introDescription = introTitle?.nextElementSibling as HTMLElement | null
    const stage = document.querySelector<HTMLElement>('#journey-stage')
    const routeVisual = document.querySelector<HTMLElement>('#journey-route-visual')
    const chapters = Array.from(
      document.querySelectorAll<HTMLElement>('[data-chapter-index]'),
    )

    if (!introTitle || !introDescription || !stage || !routeVisual || chapters.length !== 3) {
      throw new Error('Journey copy geometry is incomplete')
    }

    const size = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      return {
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      }
    }

    const copyElements = [
      { name: 'intro-title', element: introTitle },
      { name: 'intro-description', element: introDescription },
      ...chapters.flatMap((chapter, index) => [
        { name: `chapter-${index + 1}-title`, element: chapter.querySelector<HTMLElement>('h3') },
        {
          name: `chapter-${index + 1}-description`,
          element: chapter.querySelector<HTMLElement>('p'),
        },
      ]),
    ].filter(
      (entry): entry is { name: string; element: HTMLElement } =>
        Boolean(entry.element),
    )

    return {
      sizes: {
        introTitle: size(introTitle),
        introDescription: size(introDescription),
        stage: size(stage),
        routeVisual: size(routeVisual),
        chapters: chapters.map((chapter) => ({
          article: size(chapter),
          title: size(chapter.querySelector<HTMLElement>('h3')!),
          description: size(chapter.querySelector<HTMLElement>('p')!),
        })),
      },
      overflowElements: copyElements
        .filter(
          ({ element }) =>
            element.scrollHeight > element.clientHeight ||
            element.scrollWidth > element.clientWidth,
        )
        .map(({ name, element }) => ({
          name,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        })),
    }
  })
}

async function readRolePanelGeometry(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#role-details')
    const layout = panel?.parentElement as HTMLElement | null
    const content = panel?.querySelector<HTMLElement>('[data-role-content]')
    const title = content?.querySelector<HTMLElement>('h3')
    const description = content?.querySelector<HTMLElement>('p + h3 + p')
    const benefits = content?.querySelector<HTMLElement>('ul')
    const action = content?.querySelector<HTMLElement>('a')
    const footer = document.querySelector<HTMLElement>('#page-footer')

    if (
      !panel ||
      !layout ||
      !content ||
      !title ||
      !description ||
      !benefits ||
      !action ||
      !footer
    ) {
      throw new Error('Role panel geometry is incomplete')
    }

    const round = (value: number) => Math.round(value * 100) / 100
    const box = (element: HTMLElement, relativeTo?: DOMRect) => {
      const rect = element.getBoundingClientRect()
      return {
        top: round(rect.top - (relativeTo?.top ?? 0)),
        left: round(rect.left - (relativeTo?.left ?? 0)),
        width: round(rect.width),
        height: round(rect.height),
      }
    }
    const panelRect = panel.getBoundingClientRect()
    const copyElements = [
      { name: 'title', element: title },
      { name: 'description', element: description },
      { name: 'benefits', element: benefits },
      { name: 'action', element: action },
    ]

    return {
      frame: {
        panel: box(panel),
        layout: box(layout),
        content: box(content, panelRect),
        title: box(title, panelRect),
        description: box(description, panelRect),
        benefits: box(benefits, panelRect),
        action: box(action, panelRect),
        footerTop: round(footer.getBoundingClientRect().top + window.scrollY),
      },
      overflowElements: copyElements
        .filter(
          ({ element }) =>
            element.scrollHeight > element.clientHeight ||
            element.scrollWidth > element.clientWidth,
        )
        .map(({ name, element }) => ({
          name,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        })),
    }
  })
}

async function readElementBox(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      top: Math.round(rect.top * 100) / 100,
      left: Math.round(rect.left * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
    }
  })
}

async function prepareHome(page: Page, theme: 'day' | 'night') {
  await page.addInitScript((selectedTheme) => {
    localStorage.clear()
    localStorage.setItem('obriy-night-default-v1', 'done')
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', 'uk')
  }, theme)
}
