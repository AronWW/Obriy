import { expect, test, type Page } from '@playwright/test'

for (const scenario of [
  { role: 'TEACHER', width: 1440, height: 900, theme: 'day' },
  { role: 'STUDENT', width: 390, height: 844, theme: 'night' },
] as const) {
  test(`direct chat is usable for ${scenario.role.toLowerCase()} on ${scenario.width}px`, async ({ page }) => {
    await page.setViewportSize(scenario)
    await prepare(page, scenario.role, scenario.theme)
    const base = scenario.role === 'TEACHER' ? '/app/teacher' : '/app/student'
    await page.goto(`${base}/messages/conversation-1`)

    await expect(page.getByRole('heading', { name: 'Alex Student' })).toBeVisible()
    await expect(page.getByText('A safe message')).toBeVisible()
    await expect(page.getByPlaceholder('Write a message…')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
}

async function prepare(page: Page, role: 'STUDENT' | 'TEACHER', theme: 'day' | 'night') {
  await page.addInitScript(({ theme }) => {
    localStorage.setItem('obriy-theme', theme)
    localStorage.setItem('obriy-language', 'en')
    localStorage.setItem('obriy-has-session', '1')
  }, { theme })
  await page.route('**/auth/refresh', (route) => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      accessToken: 'chat-token',
      user: {
        id: role === 'TEACHER' ? 'teacher-1' : 'student-1',
        email: 'member@example.com', role, status: 'ACTIVE', emailVerifiedAt: null, hasPassword: true,
        profile: { displayName: 'Member', avatarUrl: null, bio: null, subjectArea: null, preferredLocale: 'EN' },
      },
    }),
  }))
  const counterpart = {
    id: role === 'TEACHER' ? 'student-1' : 'teacher-1',
    displayName: 'Alex Student', avatarUrl: null, classId: 'class-1', className: 'History',
  }
  const conversation = {
    id: 'conversation-1', counterpart, isWritable: true, unreadCount: 0,
    lastMessage: null, createdAt: '2026-09-12T10:00:00.000Z', lastMessageAt: '2026-09-12T10:01:00.000Z',
  }
  await page.route('**/chat/conversations?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [conversation], nextCursor: null }) }))
  await page.route('**/chat/conversations/conversation-1/messages?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ conversation, items: [{
      id: 'message-1', conversationId: 'conversation-1', senderId: 'student-1', senderRole: 'STUDENT',
      body: 'A safe message', editedAt: null, createdAt: '2026-09-12T10:01:00.000Z', isReadByCounterpart: true, attachments: [],
    }], nextCursor: null }),
  }))
  await page.route('**/chat/conversations/conversation-1/read', (route) => route.fulfill({ status: 204 }))
  await page.route('**/chat/unread-count', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unreadCount: 0 }) }))
  await page.route('**/notifications/unread-count', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unreadCount: 0 }) }))
  await page.route('**/gamification/me/rewards/unseen', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ xp: [], badges: [] }) }))
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
}
