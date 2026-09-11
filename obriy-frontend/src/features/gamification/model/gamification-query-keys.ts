export const gamificationQueryKeys = {
  root: ['gamification'] as const,
  me: () => [...gamificationQueryKeys.root, 'me'] as const,
  achievements: () => [...gamificationQueryKeys.root, 'achievements'] as const,
  unseen: () => [...gamificationQueryKeys.root, 'unseen'] as const,
}
