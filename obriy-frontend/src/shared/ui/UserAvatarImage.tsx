import { useState } from 'react'

type UserAvatarImageProps = {
  avatarUrl: string | null | undefined
  displayName: string
  className?: string
}

export function UserAvatarImage({
  avatarUrl,
  displayName,
  className,
}: UserAvatarImageProps) {
  const [imageState, setImageState] = useState<{
    url: string
    loaded: boolean
    failed: boolean
  } | null>(null)
  const url = avatarUrl?.trim() || null
  const loaded = imageState?.url === url && imageState.loaded
  const failed = imageState?.url === url && imageState.failed
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'O'

  return (
    <>
      {!loaded && <span className={className} aria-hidden="true">{initials}</span>}
      {url && !failed && (
        <img
          alt=""
          className={className}
          onError={() => setImageState({ url, loaded: false, failed: true })}
          onLoad={() => setImageState({ url, loaded: true, failed: false })}
          src={url}
          style={loaded ? undefined : { display: 'none' }}
        />
      )}
    </>
  )
}
