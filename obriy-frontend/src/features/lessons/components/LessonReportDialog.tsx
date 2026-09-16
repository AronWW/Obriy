import { useMutation } from '@tanstack/react-query'
import { Flag, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LessonReportInput } from '../api/lessons.api'
import styles from './LessonReportDialog.module.css'

const categoryValues: LessonReportInput['category'][] = ['AGE_INAPPROPRIATE','VIOLENCE','HATE_OR_HARASSMENT','SEXUAL_CONTENT','PERSONAL_DATA','MISINFORMATION','OTHER']
const copy = {
  uk: { open:'Поскаржитися',title:'Повідомити про урок',description:'Опишіть проблему. Учитель не бачитиме, хто надіслав скаргу.',category:'Категорія',details:'Що саме не так?',placeholder:'Опишіть проблему щонайменше 10 символами',cancel:'Скасувати',submit:'Надіслати скаргу',sending:'Надсилаємо…',success:'Скаргу надіслано на перевірку.',error:'Не вдалося надіслати скаргу або ви вже скаржилися на цей урок.',categories:['Неприйнятний для дітей контент','Насильство','Ненависть або цькування','Сексуальний контент','Персональні дані','Дезінформація','Інше']},
  en: { open:'Report',title:'Report lesson',description:'Describe the issue. The teacher will not see who submitted the report.',category:'Category',details:'What is wrong?',placeholder:'Describe the issue in at least 10 characters',cancel:'Cancel',submit:'Submit report',sending:'Submitting…',success:'The report was sent for review.',error:'Could not submit the report, or you have already reported this lesson.',categories:['Inappropriate for children','Violence','Hate or bullying','Sexual content','Personal data','Misinformation','Other']},
} as const

export function LessonReportDialog({ submit }: { submit: (input: LessonReportInput) => Promise<unknown> }) {
  const { i18n }=useTranslation();const c=copy[i18n.resolvedLanguage==='en'?'en':'uk'];const [open,setOpen]=useState(false);const [category,setCategory]=useState<LessonReportInput['category']>('AGE_INAPPROPRIATE');const [details,setDetails]=useState('')
  const mutation=useMutation({mutationFn:submit,onSuccess:()=>{setDetails('')}})
  if(!open)return <button className={styles.open} type="button" onClick={()=>{mutation.reset();setOpen(true)}}><Flag size={15}/>{c.open}</button>
  if(mutation.isSuccess)return <div className={styles.success} role="status"><p>{c.success}</p><button onClick={()=>setOpen(false)} type="button"><X size={15}/></button></div>
  return <div className={styles.backdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><div aria-modal="true" className={styles.dialog} role="dialog" aria-labelledby="report-title"><button className={styles.close} aria-label={c.cancel} onClick={()=>setOpen(false)}><X/></button><Flag size={25}/><h2 id="report-title">{c.title}</h2><p>{c.description}</p><label><span>{c.category}</span><select value={category} onChange={e=>setCategory(e.target.value as LessonReportInput['category'])}>{categoryValues.map((value,index)=><option key={value} value={value}>{c.categories[index]}</option>)}</select></label><label><span>{c.details}</span><textarea autoFocus maxLength={2000} rows={6} placeholder={c.placeholder} value={details} onChange={e=>setDetails(e.target.value)}/></label>{mutation.isError&&<p className={styles.error} role="alert">{c.error}</p>}<div className={styles.actions}><button type="button" onClick={()=>setOpen(false)}>{c.cancel}</button><button disabled={details.trim().length<10||mutation.isPending} type="button" onClick={()=>mutation.mutate({category,details:details.trim()})}>{mutation.isPending?c.sending:c.submit}</button></div></div></div>
}
