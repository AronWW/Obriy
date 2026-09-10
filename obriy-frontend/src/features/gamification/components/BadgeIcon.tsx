import { Award, Compass, Footprints, Medal, Sparkles } from 'lucide-react'

const icons = {
  award: Award,
  compass: Compass,
  footprints: Footprints,
  medal: Medal,
  sparkles: Sparkles,
}

export function BadgeIcon({ iconKey, size = 24 }: { iconKey: string; size?: number }) {
  const Icon = icons[iconKey as keyof typeof icons] ?? Award
  return <Icon aria-hidden="true" size={size} />
}
