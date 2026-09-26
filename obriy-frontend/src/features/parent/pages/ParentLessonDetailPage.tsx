import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { parentApi } from '../api/parent.api'
import styles from './ParentLearningDetail.module.css'

export function ParentLessonDetailPage() {
  const { childId = '', lessonId = '' } = useParams()
  const { i18n } = useTranslation()
  const copy = i18n.resolvedLanguage === 'en' ? en : uk
  const query = useQuery({
    queryKey: ['parent', 'child', childId, 'lesson', lessonId],
    queryFn: () => parentApi.getChildLesson(childId, lessonId),
    enabled: Boolean(childId && lessonId),
  })
  return <div className={styles.page}>
    <Link className={styles.back} to={`/app/parent/child/${childId}/progress`}><ArrowLeft size={16} />{copy.back}</Link>
    {query.isLoading && <State text={copy.loading} />}
    {query.isError && <State text={copy.error} retry={() => void query.refetch()} />}
    {query.data && <>
      <header className={styles.hero}>
        <div><span>{copy.lesson} {query.data.position}</span><h1>{query.data.title}</h1>{query.data.summary && <p>{query.data.summary}</p>}</div>
        {query.data.estimatedMinutes !== null && <small><Clock3 size={15} />{query.data.estimatedMinutes} {copy.minutes}</small>}
      </header>
      <article className={styles.article}>{query.data.content.split(/\r?\n\s*\r?\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>
      <section className={styles.tests}><h2>{copy.tests}</h2>{query.data.tests.length === 0 ? <p>{copy.noTests}</p> : query.data.tests.map((test) => <Link key={test.releaseId} to={`/app/parent/child/${childId}/tests/${test.releaseId}`}><span><strong>{test.title}</strong><small>{test.isRequired ? copy.required : copy.optional}</small></span><b>{test.scorePercent === null ? '—' : `${Math.round(test.scorePercent * 100) / 100}%`}</b></Link>)}</section>
    </>}
  </div>
}

function State({ text, retry }: { text: string; retry?: () => void }) { return <div className={styles.state}><p>{text}</p>{retry && <button onClick={retry}>Retry</button>}</div> }
const uk = { back: 'До прогресу', loading: 'Завантажуємо урок…', error: 'Не вдалося завантажити урок.', lesson: 'Урок', minutes: 'хв', tests: 'Тести уроку', noTests: 'В опублікованому уроці ще немає тестів.', required: 'Обов’язковий', optional: 'Необов’язковий' }
const en = { back: 'Back to progress', loading: 'Loading lesson…', error: 'Could not load the lesson.', lesson: 'Lesson', minutes: 'min', tests: 'Lesson tests', noTests: 'This published lesson has no tests yet.', required: 'Required', optional: 'Optional' }
