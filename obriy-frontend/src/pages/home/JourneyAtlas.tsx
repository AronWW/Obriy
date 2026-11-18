import { Award, BookOpenCheck, Presentation } from 'lucide-react'
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './HomePage.module.css'

const steps = [
  { icon: BookOpenCheck, key: 'discover' },
  { icon: Presentation, key: 'interact' },
  { icon: Award, key: 'grow' },
] as const

const routePath =
  'M82 63 C181 114 87 226 196 270 C317 320 506 289 455 415 C414 516 195 487 236 622 C256 686 339 698 391 711'

const routeSegments = [
  'M82 63 C181 114 87 226 196 270',
  'M196 270 C317 320 506 289 455 415',
  'M455 415 C414 516 195 487 236 622',
  'M236 622 C256 686 339 698 391 711',
] as const

const routeNodes = [
  { x: 196, y: 270 },
  { x: 455, y: 415 },
  { x: 236, y: 622 },
] as const

const fallbackNodeProgress = [0.28, 0.56, 0.82] as const
const nodeApproachProgress = 0.085

type ChapterState = 'upcoming' | 'active' | 'complete'

function clampProgress(progress: number) {
  return Math.min(1, Math.max(0, progress))
}

function getChapterState(
  index: number,
  activeStep: number,
  reduceMotion: boolean,
): ChapterState {
  if (reduceMotion || index === activeStep) {
    return 'active'
  }

  return index < activeStep ? 'complete' : 'upcoming'
}

function getChapterAnimation(state: ChapterState) {
  if (state === 'active') {
    return { opacity: 1, y: 0 }
  }

  if (state === 'complete') {
    return { opacity: 0.42, y: -4 }
  }

  return { opacity: 0.14, y: 12 }
}

export function JourneyAtlas() {
  const { t } = useTranslation()
  const reduceMotion = Boolean(useReducedMotion())
  const stageRef = useRef<HTMLDivElement>(null)
  const routePathRef = useRef<SVGPathElement>(null)
  const routeSegmentRefs = useRef<Array<SVGPathElement | null>>([])
  const routeNodeRefs = useRef<Array<SVGGElement | null>>([])
  const routeMarkerRef = useRef<SVGGElement>(null)
  const routeLengthRef = useRef(0)
  const pendingProgressRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const nodeProgressRef = useRef<number[]>([...fallbackNodeProgress])
  const activeStepRef = useRef(reduceMotion ? steps.length - 1 : -1)
  const [activeStep, setActiveStep] = useState(
    reduceMotion ? steps.length - 1 : -1,
  )
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 920px)').matches)
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: compact ? ['start 55%', 'end 32%'] : ['start 70%', 'end 45%'],
  })
  const routeProgress = useSpring(scrollYProgress, {
    damping: 36,
    mass: 0.65,
    stiffness: 105,
    restDelta: 0.0005,
    restSpeed: 0.0005,
  })

  useEffect(() => {
    const media = window.matchMedia('(max-width: 920px)')
    const updateCompact = () => setCompact(media.matches)
    media.addEventListener('change', updateCompact)
    return () => media.removeEventListener('change', updateCompact)
  }, [])

  const updateRoutePresentation = useCallback((rawProgress: number) => {
    const path = routePathRef.current
    const marker = routeMarkerRef.current

    if (!path || !marker) {
      return
    }

    const progress = clampProgress(rawProgress)
    const markerPoint = path.getPointAtLength(routeLengthRef.current * progress)
    marker.setAttribute(
      'transform',
      `translate(${markerPoint.x.toFixed(4)} ${markerPoint.y.toFixed(4)})`,
    )
    marker.dataset.progress = progress.toFixed(8)

    const nextActiveStep = nodeProgressRef.current.reduce(
      (currentStep, nodeProgress, index) =>
        progress >= nodeProgress - nodeApproachProgress ? index : currentStep,
      -1,
    )

    if (activeStepRef.current !== nextActiveStep) {
      activeStepRef.current = nextActiveStep
      setActiveStep(nextActiveStep)
    }
  }, [])

  useLayoutEffect(() => {
    const path = routePathRef.current

    if (!path) {
      return
    }

    const totalLength = path.getTotalLength()
    routeLengthRef.current = totalLength
    let cumulativeLength = 0
    const nodeProgresses = routeSegmentRefs.current
      .map((segment) => segment?.getTotalLength() ?? 0)
      .slice(0, routeNodes.length)
      .map((segmentLength) => {
        cumulativeLength += segmentLength
        return cumulativeLength / totalLength
      })

    if (nodeProgresses.every((progress) => Number.isFinite(progress) && progress > 0)) {
      nodeProgressRef.current = nodeProgresses
    }

    routeNodeRefs.current.forEach((node, index) => {
      if (node) {
        node.dataset.progress = nodeProgressRef.current[index].toFixed(5)
      }
    })

    updateRoutePresentation(reduceMotion ? 1 : routeProgress.get())
  }, [reduceMotion, routeProgress, updateRoutePresentation])

  useMotionValueEvent(routeProgress, 'change', (progress) => {
    if (!reduceMotion) {
      pendingProgressRef.current = progress
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = null
          updateRoutePresentation(pendingProgressRef.current)
        })
      }
    }
  })

  useLayoutEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    },
    [],
  )

  return (
    <section id="journey" className={styles.journeySection} aria-labelledby="journey-title">
      <div className={styles.sectionIntro}>
        <p className={styles.sectionKicker}>{t('home.journey.eyebrow')}</p>
        <h2 id="journey-title">
          <span>{t('home.journey.titleLine1')}</span>
          <span>{t('home.journey.titleLine2')}</span>
        </h2>
        <p>{t('home.journey.description')}</p>
      </div>

      <div
        ref={stageRef}
        className={styles.journeyStage}
        id="journey-stage"
        data-node-approach={nodeApproachProgress}
      >
        <div className={styles.journeyChapters}>
          {steps.map(({ icon: Icon, key }, index) => {
            const chapterState = getChapterState(index, activeStep, reduceMotion)

            return (
              <motion.article
                className={styles.journeyChapter}
                key={key}
                data-chapter-index={index}
                data-state={chapterState}
                aria-current={chapterState === 'active' ? 'step' : undefined}
                initial={false}
                animate={getChapterAnimation(chapterState)}
                transition={{
                  duration: reduceMotion ? 0 : 0.92,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className={styles.chapterCard} data-chapter-card={index}>
                  <span className={styles.chapterNumber}>0{index + 1}</span>
                  <span className={styles.chapterIcon} aria-hidden="true">
                    <Icon size={21} />
                  </span>
                  <h3>{t(`home.journey.steps.${key}.title`)}</h3>
                  <p>{t(`home.journey.steps.${key}.description`)}</p>
                </div>
              </motion.article>
            )
          })}
        </div>

        <div id="journey-route-visual" className={styles.journeyVisual} aria-hidden="true">
          <div className={styles.atlasGrid} />
          <svg viewBox="0 0 620 760" preserveAspectRatio="xMidYMid meet">
            <path
              className={styles.atlasContour}
              d="M62 161 C151 92 242 94 318 137 C394 179 454 148 553 83"
            />
            <path
              className={styles.atlasContour}
              d="M35 523 C137 464 213 471 292 515 C374 560 460 532 588 444"
            />
            <path
              id="journey-route-path"
              ref={routePathRef}
              className={styles.atlasRouteBase}
              d={routePath}
            />
            <motion.path
              id="journey-route-progress"
              className={styles.atlasRouteProgress}
              d={routePath}
              style={{ pathLength: reduceMotion ? 1 : routeProgress }}
            />
            <g className={styles.routeMetrics} aria-hidden="true">
              {routeSegments.map((segment, index) => (
                <path
                  d={segment}
                  key={segment}
                  ref={(element) => {
                    routeSegmentRefs.current[index] = element
                  }}
                />
              ))}
            </g>
            {routeNodes.map((node, index) => {
              const nodeState = getChapterState(index, activeStep, reduceMotion)

              return (
                <g
                  className={styles.atlasNodeGroup}
                  data-route-node={index}
                  data-state={nodeState}
                  key={`${node.x}-${node.y}`}
                  ref={(element) => {
                    routeNodeRefs.current[index] = element
                  }}
                >
                  <circle className={styles.atlasNode} cx={node.x} cy={node.y} r="8" />
                </g>
              )
            })}
            <g className={styles.atlasTicks}>
              <path d="M40 96h38M40 116h21M542 244h38M559 264h21M47 672h38M47 692h21" />
              <circle cx="82" cy="63" r="5" />
              <circle cx="391" cy="711" r="5" />
            </g>
            <g
              id="journey-route-marker"
              ref={routeMarkerRef}
              className={styles.routeMarker}
              data-progress={reduceMotion ? '1.00000000' : '0.00000000'}
              transform="translate(82 63)"
            >
              <circle className={styles.routeMarkerCore} r="6" />
            </g>
          </svg>

          <span className={`${styles.atlasLabel} ${styles.atlasLabelStart}`}>
            {t('home.journey.atlas.start')}
          </span>
          <span className={`${styles.atlasLabel} ${styles.atlasLabelFinish}`}>
            {t('home.journey.atlas.finish')}
          </span>
        </div>
      </div>
    </section>
  )
}
