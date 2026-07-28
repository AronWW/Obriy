import { DawnAtlas } from './DawnAtlas'
import { NightSky } from './NightSky'
import styles from './ObriyBackground.module.css'

interface ObriyBackgroundProps {
  compactHorizon?: boolean
}

export function ObriyBackground({ compactHorizon = false }: ObriyBackgroundProps) {
  return (
    <div
      className={`${styles.background} ${compactHorizon ? styles.compactHorizon : ''}`}
      aria-hidden="true"
    >
      <DawnAtlas />
      <NightSky />
      <div className={styles.noise} />
      <div className={styles.vignette} />
    </div>
  )
}
