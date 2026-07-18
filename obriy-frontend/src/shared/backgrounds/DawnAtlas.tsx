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
            <stop offset="0" stopColor="#fffaf1" stopOpacity=".9" />
            <stop offset=".58" stopColor="#edf4f1" stopOpacity=".76" />
            <stop offset="1" stopColor="#cadbd8" stopOpacity=".34" />
          </linearGradient>
          <filter id="cloud-soft" x="-5%" y="-10%" width="110%" height="120%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        <g className={`${styles.cloud} ${styles.cloudFar}`}>
          <path d="M-128 144 C-88 112-38 108 5 130 C34 82 93 65 144 88 C179 43 248 42 287 92 C333 68 393 81 424 122 C460 115 497 133 522 160 C432 173 341 169 252 178 C154 187 53 179-42 184 C-87 187-119 169-128 144Z" />
          <path d="M1260 225 C1294 192 1342 190 1377 217 C1405 174 1465 168 1501 211 C1538 184 1593 190 1624 229 C1658 214 1705 224 1734 256 C1639 267 1547 262 1458 270 C1372 278 1296 264 1260 242Z" />
        </g>

        <g className={`${styles.cloud} ${styles.cloudMid}`}>
          <path d="M-152 334 C-102 291-35 289 12 324 C50 263 137 252 184 311 C227 271 297 276 335 323 C377 302 435 311 472 349 C380 364 286 358 197 368 C105 378 12 369-75 373 C-116 375-145 358-152 334Z" />
          <path d="M650 326 C694 283 758 282 801 319 C837 259 926 257 970 319 C1013 278 1087 282 1128 332 C1174 304 1244 313 1286 359 C1186 372 1087 366 993 377 C892 388 792 377 704 380 C671 377 650 356 650 326Z" />
        </g>

      </svg>
      <CoastalHorizon />
    </div>
  )
}
