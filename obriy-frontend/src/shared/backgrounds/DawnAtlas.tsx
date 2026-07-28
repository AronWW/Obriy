import styles from './ObriyBackground.module.css'
import { CoastalHorizon } from './CoastalHorizon'

export function DawnAtlas() {
  return (
    <div className={`${styles.layer} ${styles.day}`}>
      <div className={styles.dayGrid} />
      <div className={styles.dayOrb}><span /></div>

      <svg className={styles.dayScene} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        <defs>
          <linearGradient id="cloud-paint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffdf8" stopOpacity=".96" />
            <stop offset=".58" stopColor="#f1f5f6" stopOpacity=".82" />
            <stop offset="1" stopColor="#c9dce7" stopOpacity=".34" />
          </linearGradient>
          <filter id="cloud-soft" x="-5%" y="-10%" width="110%" height="120%">
            <feGaussianBlur stdDeviation="1.35" />
          </filter>
        </defs>

        <g className={styles.dayBalloons}>
          <g transform="translate(760 62) scale(.38)">
            <g className={`${styles.balloon} ${styles.balloonOchre}`}>
              <path className={styles.balloonEnvelope} d="M0-78C-42-78-62-44-55-11c6 27 29 48 45 56l4 10H6l4-10c16-8 39-29 45-56 7-33-13-67-55-67Z" />
              <path className={styles.balloonSeams} d="M0-76v128M-24-71C-11-43-8 10-5 45M24-71C11-43 8 10 5 45M-52-17h104" />
              <path className={styles.balloonRopes} d="m-7 54-7 17m21-17 7 17" />
              <path className={styles.balloonBasket} d="M-14 71h28l-3 17h-22Z" />
            </g>
          </g>

          <g transform="translate(1510 405) scale(.32)">
            <g className={`${styles.balloon} ${styles.balloonBlue}`}>
              <path className={styles.balloonEnvelope} d="M0-78C-42-78-62-44-55-11c6 27 29 48 45 56l4 10H6l4-10c16-8 39-29 45-56 7-33-13-67-55-67Z" />
              <path className={styles.balloonSeams} d="M0-76v128M-24-71C-11-43-8 10-5 45M24-71C11-43 8 10 5 45M-52-17h104" />
              <path className={styles.balloonRopes} d="m-7 54-7 17m21-17 7 17" />
              <path className={styles.balloonBasket} d="M-14 71h28l-3 17h-22Z" />
            </g>
          </g>

        </g>

        <g className={`${styles.cloud} ${styles.cloudFar}`}>
          <path d="M-128 144 C-88 112-38 108 5 130 C34 82 93 65 144 88 C179 43 248 42 287 92 C333 68 393 81 424 122 C460 115 497 133 522 160 C432 173 341 169 252 178 C154 187 53 179-42 184 C-87 187-119 169-128 144Z" />
          <path d="M558 218 C598 181 657 182 696 213 C731 158 811 157 854 215 C896 177 965 183 1004 229 C1042 207 1098 216 1133 253 C1047 265 960 260 873 269 C778 279 684 269 599 273 C574 271 558 250 558 218Z" />
          <path d="M1260 225 C1294 192 1342 190 1377 217 C1405 174 1465 168 1501 211 C1538 184 1593 190 1624 229 C1658 214 1705 224 1734 256 C1639 267 1547 262 1458 270 C1372 278 1296 264 1260 242Z" />
        </g>

        <g className={`${styles.cloud} ${styles.cloudMid}`}>
          <path d="M-152 334 C-102 291-35 289 12 324 C50 263 137 252 184 311 C227 271 297 276 335 323 C377 302 435 311 472 349 C380 364 286 358 197 368 C105 378 12 369-75 373 C-116 375-145 358-152 334Z" />
        </g>

        <g className={styles.cloudEtching}>
          <path d="M-82 151c92 14 185 5 276 15 81 8 163 3 245-5M-46 169c77 8 155 1 231 9" />
          <path d="M584 232c85 14 171 6 255 17 80 10 159 5 238-2m-449 17c65 8 132 2 197 9" />
          <path d="M1284 240c79 12 162 3 243 12 54 6 105 5 157 0" />
          <path d="M-105 341c86 14 170 5 255 17 80 11 159 5 238-3M-60 361c62 5 124 1 187 6" />
        </g>
      </svg>

      <CoastalHorizon showDayVessels />
    </div>
  )
}
