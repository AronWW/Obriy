import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UserAvatarImage } from './UserAvatarImage'

describe('UserAvatarImage', () => {
  it('shows initials until the image has loaded', () => {
    const { container } = render(
      <UserAvatarImage avatarUrl="https://example.com/avatar.jpg" displayName="Марія Іваненко" />,
    )

    expect(screen.getByText('МІ')).toBeInTheDocument()
    const image = container.querySelector('img')
    expect(image).toHaveStyle({ display: 'none' })
    fireEvent.load(image!)
    expect(screen.queryByText('МІ')).not.toBeInTheDocument()
    expect(image).not.toHaveStyle({ display: 'none' })
  })

  it('keeps initials when the remote image fails', () => {
    const { container } = render(
      <UserAvatarImage avatarUrl="https://example.com/broken.jpg" displayName="Пані Олена" />,
    )

    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('ПО')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('resets image state when an avatar is removed or replaced', () => {
    const { container, rerender } = render(
      <UserAvatarImage avatarUrl="https://example.com/old.jpg" displayName="Марія" />,
    )
    fireEvent.error(container.querySelector('img')!)

    rerender(<UserAvatarImage avatarUrl={null} displayName="Марія" />)
    expect(screen.getByText('М')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()

    rerender(<UserAvatarImage avatarUrl="https://example.com/new.jpg" displayName="Марія" />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/new.jpg')
    expect(screen.getByText('М')).toBeInTheDocument()
  })
})
