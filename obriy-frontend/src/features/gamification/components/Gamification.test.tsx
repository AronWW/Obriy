import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config'
import { BadgeCollectionDialog } from './BadgeCollectionDialog'
import { GamificationProgressCard } from './GamificationProgressCard'
import type { EarnedBadge } from '../model/gamification.types'

describe('Gamification components', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  it('renders level progress with accessible values', () => {
    render(
      <GamificationProgressCard
        progress={{
          totalXp: 700,
          level: 2,
          levelStartXp: 500,
          nextLevelXp: 1500,
          xpIntoLevel: 200,
          xpForNextLevel: 1000,
        }}
      />,
    )
    expect(screen.getByText('700 XP')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '200')
  })

  it('renders the compact progress copy in Ukrainian', async () => {
    await i18n.changeLanguage('uk')
    render(
      <GamificationProgressCard
        compact
        progress={{
          totalXp: 0,
          level: 1,
          levelStartXp: 0,
          nextLevelXp: 500,
          xpIntoLevel: 0,
          xpForNextLevel: 500,
        }}
      />,
    )

    expect(screen.getByText('Рівень')).toBeInTheDocument()
    expect(screen.getByText('0 XP')).toBeInTheDocument()
    expect(screen.getByText('Ще 500 XP до наступного рівня')).toBeInTheDocument()
  })

  it('limits the editable showcase to three earned badges', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <BadgeCollectionDialog
        badges={[1, 2, 3, 4].map(badge)}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )
    for (const name of ['Badge 1', 'Badge 2', 'Badge 3', 'Badge 4']) {
      await user.click(screen.getByRole('button', { name: new RegExp(name) }))
    }
    await user.click(screen.getByRole('button', { name: 'Save showcase' }))
    expect(onSave).toHaveBeenCalledWith(['badge-1', 'badge-2', 'badge-3'])
  })
})

function badge(value: number): EarnedBadge {
  return {
    id: `badge-${value}`,
    key: `BADGE_${value}`,
    iconKey: 'award',
    name: `Badge ${value}`,
    description: `Description ${value}`,
    earnedAt: '2026-09-10T10:00:00.000Z',
    showcasePosition: null,
  }
}
