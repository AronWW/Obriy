import { DawnAtlas } from './DawnAtlas'
import { NightSky } from './NightSky'
import styles from './ObriyBackground.module.css'

export function ObriyBackground() {
  return (
    <div className={styles.background} aria-hidden="true">
      <DawnAtlas />
      <NightSky />
      <div className={styles.noise} />
      <div className={styles.vignette} />
    </div>
  )
}
