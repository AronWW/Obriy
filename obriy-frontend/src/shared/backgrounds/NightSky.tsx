import styles from './ObriyBackground.module.css'
import { CoastalHorizon } from './CoastalHorizon'

const stars = Array.from({ length: 52 }, (_, index) => ({
  id: index,
  x: (index * 47 + 13) % 100,
  y: (index * 71 + 9) % 72,
  size: 1 + (index % 3) * 0.55,
  delay: (index % 11) * -0.43,
}))

export function NightSky() {
  return (
    <div className={`${styles.layer} ${styles.night}`}>
      <div className={styles.nightGlow} />
      <div className={styles.starField}>
        {stars.map((star) => (
          <span
            className={styles.star}
            key={star.id}
            style={
              {
                '--star-x': `${star.x}%`,
                '--star-y': `${star.y}%`,
                '--star-size': `${star.size}px`,
                '--star-delay': `${star.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.moon}>
        <span />
      </div>

      <svg className={styles.constellation} viewBox="0 0 620 260" aria-hidden="true">
        <path d="M34 160 128 105 224 151 324 76 430 115 568 38" />
        <g>
          <circle cx="34" cy="160" r="4" />
          <circle cx="128" cy="105" r="5" />
          <circle cx="224" cy="151" r="4" />
          <circle cx="324" cy="76" r="5" />
          <circle cx="430" cy="115" r="4" />
          <circle cx="568" cy="38" r="6" />
        </g>
      </svg>

      <div className={`${styles.sigil} ${styles.sigilOne}`}>✦</div>
      <div className={`${styles.sigil} ${styles.sigilTwo}`}>✧</div>
      <div className={`${styles.sigil} ${styles.sigilThree}`}>✦</div>
      <CoastalHorizon showRisingSun />
    </div>
  )
}
