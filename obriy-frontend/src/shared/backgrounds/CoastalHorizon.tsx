import styles from './ObriyBackground.module.css'

interface CoastalHorizonProps {
  showDayVessels?: boolean
}

export function CoastalHorizon({ showDayVessels = false }: CoastalHorizonProps) {
  return (
    <>
      <svg
        className={styles.coastalHorizon}
        viewBox="0 0 1600 340"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <path
          className={styles.sharedMountainBack}
          d="M0 229 C84 206 126 169 188 160 C242 151 289 201 342 205 C408 210 458 148 525 139 C590 130 641 198 707 204 C774 210 816 159 881 151 C949 142 1002 201 1065 204 C1133 208 1185 162 1248 154 C1318 145 1369 198 1424 199 C1490 201 1544 162 1600 143V340H0Z"
        />
        <path
          className={styles.sharedMountainFront}
          d="M0 261 C86 244 142 211 209 204 C270 198 320 244 386 249 C453 254 510 212 574 205 C641 198 697 246 763 251 C830 256 887 213 952 205 C1020 197 1080 244 1145 248 C1211 252 1272 216 1335 210 C1407 204 1468 241 1524 239 C1555 238 1579 228 1600 214V340H0Z"
        />

        <rect className={styles.sharedSea} x="0" y="258" width="1600" height="82" />
        <g className={styles.seaLines}>
          <path d="M0 281H390M486 281H722M914 281H1188M1288 281H1600" />
          <path d="M94 306H462M580 306H864M1018 306H1392" />
          <path d="M262 329H694M832 329H1256M1370 329H1564" />
        </g>

        {showDayVessels && (
          <g className={styles.dayVessels}>
            <g data-vessel="left" transform="translate(310 263) scale(.58)">
              <g className={`${styles.dayVessel} ${styles.vesselOne}`}>
                <path className={styles.vesselHull} d="M-67 0H69L49 20c-33 10-70 10-98 0Z" />
                <path className={styles.vesselRigging} d="M0 0v-75m0 13-47 50H0Zm5-45 41 45H5ZM-57 5H59" />
                <path className={styles.vesselSail} d="M-4-68c-24 13-39 31-43 56h43Zm9 7c20 12 34 28 41 49H5Z" />
                <path d="m0-75 20 8-20 7" />
              </g>
            </g>

            <g data-vessel="center" transform="translate(930 268) scale(.78)">
              <g className={`${styles.dayVessel} ${styles.vesselTwo}`}>
                <path className={styles.vesselHull} d="M-86-2H91L67 25c-40 15-88 15-132 0Z" />
                <path className={styles.vesselRigging} d="M-28-2v-80m74 80v-62M-28-70-78-12h50Zm6 5 50 53h-50Zm68 10L14-12h32Zm5 4 35 39H51ZM-74 4H78" />
                <path className={styles.vesselSail} d="M-33-72c-27 16-42 36-45 60h45Zm11 7c24 13 40 31 50 53h-50Zm73 12C32-42 19-28 14-12h32Zm0 6c16 9 28 21 35 35H51Z" />
                <path d="m-28-82 22 9-22 7m74 2 18 7-18 6" />
              </g>
            </g>

            <g data-vessel="right" transform="translate(1300 270) scale(.45)">
              <g className={`${styles.dayVessel} ${styles.vesselThree}`}>
                <path className={styles.vesselHull} d="M-64 0H65L47 19c-30 10-65 10-94 0Z" />
                <path className={styles.vesselRigging} d="M4 0v-73M4-62-46-10H4Zm6 8 42 44H10ZM-54 4H55" />
                <path className={styles.vesselSail} d="M-1-65c-24 15-39 33-45 55h45Zm11 10c21 12 35 27 42 45H10Z" />
              </g>
            </g>
          </g>
        )}
      </svg>

      <svg
        className={styles.lighthouseScene}
        viewBox="-28 0 258 300"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
      >
        <g className={styles.lighthouseCliff}>
          <path d="M-12 256 C22 222 43 208 72 203 C101 198 126 207 151 196 C170 188 190 171 214 151 L230 298H-28Z" />
        </g>

        <g className={styles.sharedLighthouse}>
          <ellipse className={styles.lighthouseGlow} cx="79" cy="27" rx="39" ry="29" />
          <circle className={styles.lighthouseLamp} cx="79" cy="27" r="8" />
          <path d="M20 257H132M42 247 54 78H101L114 247ZM47 190H108M50 143H105M53 105H103" />
          <path d="M49 78 61 55H95L106 78M57 55V37H100V55M50 37H108M70 37V18H88V37M65 18H94" />
          <path d="M37 92H118M31 86H124M58 115H101M59 164H103M62 211H106" />
          <rect x="70" y="129" width="16" height="22" />
          <rect x="72" y="198" width="17" height="26" />
        </g>
      </svg>
    </>
  )
}
