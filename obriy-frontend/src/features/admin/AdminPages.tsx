import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ShieldAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useSessionStore } from '../auth/model/session.store'
import { AvatarEditor, SecuritySection, profileApi } from '../profile'
import { adminApi } from './api/admin.api'
import { adminCopy } from './admin.copy'
import type { LessonModerationCase } from './model/admin.types'
import styles from './Admin.module.css'

function useCopy() {
  const { i18n } = useTranslation()
  return adminCopy[i18n.resolvedLanguage === 'en' ? 'en' : 'uk']
}

function Header({ index, actions }: { index: number; actions?: ReactNode }) {
  const c = useCopy()
  return <header className={styles.pageHeader}><div><h1>{c.title[index]}</h1><p>{c.description}</p></div>{actions}</header>
}

function QueryState({ query }: { query: { isLoading: boolean; isError: boolean; refetch: () => unknown } }) {
  const c = useCopy()
  if (query.isLoading) return <div className={styles.state}>{c.loading}</div>
  if (query.isError) return <div className={`${styles.state} ${styles.error}`} role="alert"><div><p>{c.cannotLoad}</p><button className={styles.button} onClick={() => query.refetch()}>{c.retry}</button></div></div>
  return null
}

function date(value: string) {
  return new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en-GB' : 'uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function Badge({ value }: { value: string }) {
  const tone = value === 'ACTIVE' || value === 'APPROVED' || value === 'CLEAR' ? 'ok' : value === 'SUSPENDED' || value === 'REMOVED' ? 'danger' : undefined
  return <span className={styles.badge} data-tone={tone}>{value.replaceAll('_', ' ')}</span>
}

export function AdminDashboardPage() {
  const c = useCopy()
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard })
  const metrics = query.data ? [
    [c.users, query.data.users], [c.students, query.data.students], [c.teacher, query.data.teachers],
    [c.classes, query.data.classes], [c.lessons, query.data.publishedLessons], [c.tests, query.data.publishedReleases],
    [c.openCases, query.data.openModerationCases], [c.messages, query.data.messagesLast30Days],
    [c.newUsers, query.data.newUsersLast30Days], [c.pending, query.data.pendingUsers], [c.suspended, query.data.suspendedUsers],
  ] : []
  return <section className={styles.page}><Header index={0} /><QueryState query={query} />{query.data && <div className={styles.metrics}>{metrics.map(([label, value]) => <article className={styles.metric} key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div>}</section>
}

export function AdminUsersPage() {
  const c = useCopy(); const [params, setParams] = useSearchParams(); const search = params.get('search') ?? ''; const role = params.get('role') ?? ''; const status = params.get('status') ?? ''
  const query = useInfiniteQuery({ queryKey: ['admin', 'users', search, role, status], initialPageParam: '', queryFn: ({ pageParam }) => adminApi.users({ cursor: pageParam || undefined, search: search || undefined, role: role || undefined, status: status || undefined }), getNextPageParam: (last) => last.nextCursor ?? undefined })
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }) }
  return <section className={styles.page}><Header index={1} actions={<div className={styles.filters}><input aria-label={c.search} placeholder={c.search} value={search} onChange={(e) => update('search', e.target.value)} /><select aria-label={c.role} value={role} onChange={(e) => update('role', e.target.value)}><option value="">{c.all}</option>{['STUDENT','TEACHER','PARENT','ADMIN'].map(x=><option key={x}>{x}</option>)}</select><select aria-label={c.status} value={status} onChange={(e) => update('status', e.target.value)}><option value="">{c.all}</option>{['PENDING','ACTIVE','SUSPENDED'].map(x=><option key={x}>{x}</option>)}</select></div>} /><QueryState query={query} />{!query.isLoading && <div className={styles.panel}><table className={styles.table}><thead><tr><th>{c.name}</th><th>{c.role}</th><th>{c.status}</th><th>{c.joined}</th><th /></tr></thead><tbody>{items.map(user => <tr key={user.id}><td><strong>{user.displayName}</strong><div className={styles.muted}>{user.email}</div></td><td>{user.role}</td><td><Badge value={user.status}/></td><td>{date(user.createdAt)}</td><td><Link to={`/app/admin/users/${user.id}`}>{c.details}</Link></td></tr>)}</tbody></table>{items.length===0&&<div className={styles.state}>{c.empty}</div>}{query.hasNextPage&&<div className={styles.loadMore}><button className={styles.button} disabled={query.isFetchingNextPage} onClick={()=>void query.fetchNextPage()}>{c.loadMore}</button></div>}</div>}</section>
}

export function AdminUserDetailPage() {
  const { userId='' }=useParams(); const c=useCopy(); const client=useQueryClient(); const [intent,setIntent]=useState<'suspend'|'restore'|null>(null)
  const query=useQuery({queryKey:['admin','user',userId],queryFn:()=>adminApi.user(userId),enabled:Boolean(userId)})
  const action=useMutation({mutationFn:({kind,reason}:{kind:'suspend'|'restore';reason:string})=>kind==='suspend'?adminApi.suspend(userId,reason):adminApi.restore(userId,reason),onSuccess:(value)=>{client.setQueryData(['admin','user',userId],value);void client.invalidateQueries({queryKey:['admin','users']});setIntent(null)}})
  const user=query.data
  return <section className={styles.page}><Link className={styles.button} to="/app/admin/users"><ArrowLeft size={15}/>{c.back}</Link><Header index={1}/><QueryState query={query}/>{user&&<div className={styles.detailGrid}><article className={styles.detailCard}><h2>{user.displayName}</h2><dl className={styles.definition}><div><dt>{c.email}</dt><dd>{user.email}</dd></div><div><dt>{c.role}</dt><dd>{user.role}</dd></div><div><dt>{c.status}</dt><dd><Badge value={user.status}/></dd></div><div><dt>{c.joined}</dt><dd>{date(user.createdAt)}</dd></div><div><dt>{c.classes}</dt><dd>{user.stats.classes}</dd></div><div><dt>{c.lessons}</dt><dd>{user.stats.lessons}</dd></div><div><dt>{c.tests}</dt><dd>{user.stats.tests}</dd></div></dl></article><article className={styles.detailCard}><h2>{c.actions}</h2>{user.role==='ADMIN'?<p className={styles.muted}>{c.noAccess}</p>:<button className={user.status==='SUSPENDED'?styles.primary:styles.danger} onClick={()=>setIntent(user.status==='SUSPENDED'?'restore':'suspend')}>{user.status==='SUSPENDED'?c.restore:c.suspend}</button>}</article></div>}{intent&&<ReasonDialog title={intent==='suspend'?c.suspend:c.restore} pending={action.isPending} error={action.isError} onClose={()=>setIntent(null)} onSubmit={(reason)=>action.mutate({kind:intent,reason})}/>}</section>
}

export function AdminClassesPage() {
  const c=useCopy(); const [params,setParams]=useSearchParams(); const search=params.get('search')??''
  const query=useInfiniteQuery({queryKey:['admin','classes',search],initialPageParam:'',queryFn:({pageParam})=>adminApi.classes({cursor:pageParam||undefined,search:search||undefined}),getNextPageParam:last=>last.nextCursor??undefined})
  const items=query.data?.pages.flatMap(p=>p.items)??[]
  return <section className={styles.page}><Header index={2} actions={<div className={styles.filters}><input aria-label={c.search} placeholder={c.search} value={search} onChange={e=>{const next=new URLSearchParams(params);if(e.target.value)next.set('search',e.target.value);else next.delete('search');setParams(next,{replace:true})}}/></div>}/><QueryState query={query}/>{!query.isLoading&&<div className={styles.panel}><table className={styles.table}><thead><tr><th>{c.classes}</th><th>{c.teacher}</th><th>{c.students}</th><th>{c.lessons}</th><th>{c.tests}</th><th/></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.teacherName}<div className={styles.muted}>{item.teacherEmail}</div></td><td>{item.studentCount}</td><td>{item.lessonCount}</td><td>{item.releaseCount}</td><td><Link to={`/app/admin/classes/${item.id}`}>{c.details}</Link></td></tr>)}</tbody></table>{items.length===0&&<div className={styles.state}>{c.empty}</div>}{query.hasNextPage&&<div className={styles.loadMore}><button className={styles.button} onClick={()=>void query.fetchNextPage()}>{c.loadMore}</button></div>}</div>}</section>
}

export function AdminClassDetailPage() {
  const {classId=''}=useParams();const c=useCopy();const query=useQuery({queryKey:['admin','class',classId],queryFn:()=>adminApi.classDetail(classId),enabled:Boolean(classId)});const item=query.data
  return <section className={styles.page}><Link className={styles.button} to="/app/admin/classes"><ArrowLeft size={15}/>{c.back}</Link><Header index={2}/><QueryState query={query}/>{item&&<><div className={styles.detailGrid}><article className={styles.detailCard}><h2>{item.name}</h2><dl className={styles.definition}><div><dt>{c.teacher}</dt><dd>{item.teacherName}</dd></div><div><dt>{c.teacherEmail}</dt><dd>{item.teacherEmail}</dd></div><div><dt>{c.students}</dt><dd>{item.studentCount}</dd></div></dl></article><article className={styles.detailCard}><h2>{c.classStats}</h2><dl className={styles.definition}><div><dt>{c.lessons}</dt><dd>{item.lessonCount}</dd></div><div><dt>{c.tests}</dt><dd>{item.releaseCount}</dd></div></dl></article></div><div className={styles.panel}><table className={styles.table}><thead><tr><th>{c.members}</th><th>{c.email}</th><th>{c.status}</th><th>{c.joined}</th></tr></thead><tbody>{item.students.map(student=><tr key={student.id}><td><Link to={`/app/admin/users/${student.id}`}>{student.displayName}</Link></td><td>{student.email}</td><td><Badge value={student.status}/></td><td>{date(student.createdAt)}</td></tr>)}</tbody></table></div></>}</section>
}

export function AdminModerationPage() {
  const c=useCopy();const [params,setParams]=useSearchParams();const status=params.get('status')??'';const query=useInfiniteQuery({queryKey:['admin','moderation',status],initialPageParam:'',queryFn:({pageParam})=>adminApi.moderation({cursor:pageParam||undefined,status:status||undefined}),getNextPageParam:last=>last.nextCursor??undefined});const items=query.data?.pages.flatMap(p=>p.items)??[]
  return <section className={styles.page}><Header index={3} actions={<div className={styles.filters}><select aria-label={c.status} value={status} onChange={e=>{const next=new URLSearchParams(params);if(e.target.value)next.set('status',e.target.value);else next.delete('status');setParams(next,{replace:true})}}><option value="">{c.all}</option>{['REPORTED','UNDER_REVIEW','CHANGES_REQUESTED','APPROVED','DISMISSED','REMOVED'].map(x=><option key={x}>{x}</option>)}</select></div>}/><QueryState query={query}/>{!query.isLoading&&<div className={styles.panel}><table className={styles.table}><thead><tr><th>{c.lessons}</th><th>{c.teacher}</th><th>{c.reports}</th><th>{c.status}</th><th>{c.joined}</th><th/></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><strong>{item.lessonTitle}</strong></td><td>{item.teacherName}</td><td>{item.reportCount}</td><td><Badge value={item.status}/></td><td>{date(item.createdAt)}</td><td><Link to={`/app/admin/moderation/${item.id}`}>{c.details}</Link></td></tr>)}</tbody></table>{items.length===0&&<div className={styles.state}>{c.empty}</div>}{query.hasNextPage&&<div className={styles.loadMore}><button className={styles.button} onClick={()=>void query.fetchNextPage()}>{c.loadMore}</button></div>}</div>}</section>
}

function snapshot(value: Record<string, unknown>, empty: string) { const parts=[value.title,value.summary,value.content].filter(x=>typeof x==='string'&&x.trim());return parts.length?parts.join('\n\n'):empty }

export function AdminModerationDetailPage() {
  const {caseId=''}=useParams();const c=useCopy();const client=useQueryClient();const [intent,setIntent]=useState<string|null>(null);const query=useQuery({queryKey:['admin','moderation-case',caseId],queryFn:()=>adminApi.moderationCase(caseId),enabled:Boolean(caseId)});const item=query.data
  const action=useMutation({mutationFn:({kind,reason}:{kind:string;reason:string})=>adminApi.moderate(caseId,kind,reason,item?.editVersion??0),onSuccess:value=>{client.setQueryData(['admin','moderation-case',caseId],value);void client.invalidateQueries({queryKey:['admin','moderation']});setIntent(null)}})
  const buttons=item?allowedActions(item):[]
  const labels:Record<string,string>={hide:c.hide,dismiss:c.dismiss,'request-changes':c.requestChanges,approve:c.approve,remove:c.remove}
  return <section className={styles.page}><Link className={styles.button} to="/app/admin/moderation"><ArrowLeft size={15}/>{c.back}</Link><Header index={3}/><QueryState query={query}/>{item&&<><div className={styles.detailCard}><h2>{item.lessonTitle}</h2><p className={styles.muted}>{c.teacher}: {item.teacherName}</p><div className={styles.rowActions}>{buttons.map(kind=><button className={kind==='remove'?styles.danger:kind==='approve'?styles.primary:styles.button} key={kind} onClick={()=>setIntent(kind)}>{labels[kind]}</button>)}</div>{item.resolutionNote&&<p><strong>{c.moderationReason}:</strong> {item.resolutionNote}</p>}</div><div className={styles.detailGrid}><article className={styles.detailCard}><h2>{c.original}</h2><div className={styles.snapshot}>{snapshot(item.initialSnapshot,c.snapshotEmpty)}</div></article><article className={styles.detailCard}><h2>{c.current}</h2><div className={styles.snapshot}>{snapshot(item.currentSnapshot,c.snapshotEmpty)}</div></article></div><article className={styles.detailCard}><h2>{c.reports} ({item.reports.length})</h2>{item.reports.map(report=><div className={styles.report} key={report.id}><strong>{report.category.replaceAll('_',' ')}</strong><p>{report.details}</p><small>{report.reporterName} · {report.reporterRole} · {report.subjectStudentName} · {report.className} · {date(report.createdAt)}</small></div>)}</article></>}{intent&&<ReasonDialog title={labels[intent]} pending={action.isPending} error={action.isError} onClose={()=>setIntent(null)} onSubmit={reason=>action.mutate({kind:intent,reason})}/>}</section>
}

function allowedActions(item: LessonModerationCase) {
  if (item.status==='REPORTED') return ['hide','dismiss','request-changes','remove']
  if (item.status==='UNDER_REVIEW') return ['dismiss','request-changes','approve','remove']
  if (item.status==='CHANGES_REQUESTED') return ['remove']
  return []
}

export function AdminAuditPage() {
  const c=useCopy();const query=useInfiniteQuery({queryKey:['admin','audit'],initialPageParam:'',queryFn:({pageParam})=>adminApi.audit({cursor:pageParam||undefined}),getNextPageParam:last=>last.nextCursor??undefined});const items=query.data?.pages.flatMap(p=>p.items)??[]
  return <section className={styles.page}><Header index={4}/><QueryState query={query}/>{!query.isLoading&&<div className={styles.panel}><table className={styles.table}><thead><tr><th>{c.joined}</th><th>{c.auditActor}</th><th>{c.actions}</th><th>{c.auditTarget}</th><th>{c.reason}</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.actorName}<div className={styles.muted}>{item.actorEmail}</div></td><td>{item.action.replaceAll('_',' ')}</td><td>{item.targetType}: {item.targetId}</td><td>{item.reason}</td></tr>)}</tbody></table>{items.length===0&&<div className={styles.state}>{c.empty}</div>}{query.hasNextPage&&<div className={styles.loadMore}><button className={styles.button} onClick={()=>void query.fetchNextPage()}>{c.loadMore}</button></div>}</div>}</section>
}

export function AdminProfilePage() {
  const c=useCopy();const user=useSessionStore(s=>s.user);const updateUser=useSessionStore(s=>s.updateUser);const {register,reset,handleSubmit,formState}=useForm<{displayName:string;bio:string}>({defaultValues:{displayName:user?.profile.displayName??'',bio:user?.profile.bio??''}})
  useEffect(()=>{if(user)reset({displayName:user.profile.displayName,bio:user.profile.bio??''})},[reset,user])
  const save=useMutation({mutationFn:profileApi.update,onSuccess:value=>{updateUser(value);reset({displayName:value.profile.displayName,bio:value.profile.bio??''})}})
  if(!user)return null;const initials=user.profile.displayName.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')
  return <section className={styles.page}><div className={styles.profile}><Header index={5}/><article className={styles.detailCard}><div className={styles.profileIdentity}><div className={styles.avatar}>{user.profile.avatarUrl?<img alt="" src={user.profile.avatarUrl}/>:initials||'A'}</div><AvatarEditor hasAvatar={Boolean(user.profile.avatarUrl)}/></div><form className={styles.profileForm} onSubmit={e=>void handleSubmit(values=>save.mutate({displayName:values.displayName.trim(),bio:values.bio.trim()}))(e)}><label className={styles.field}><span>{c.name}</span><input {...register('displayName',{required:true,minLength:2,maxLength:80})}/></label><label className={styles.field}><span>{c.bio}</span><textarea rows={4} {...register('bio',{maxLength:500})}/></label><label className={styles.field}><span>{c.email}</span><input readOnly value={user.email}/></label>{save.isSuccess&&<p className={styles.success}><Check size={15}/>{c.saved}</p>}{save.isError&&<p className={styles.error}>{c.actionError}</p>}<button className={styles.primary} disabled={!formState.isDirty||save.isPending}>{c.save}</button></form></article><div className={`${styles.profileSecurity} ${styles.detailCard}`}><SecuritySection/></div></div></section>
}

function ReasonDialog({title,pending,error,onClose,onSubmit}:{title:string;pending:boolean;error:boolean;onClose:()=>void;onSubmit:(reason:string)=>void}) {
  const c=useCopy();const [reason,setReason]=useState('');const valid=reason.trim().length>=10&&reason.trim().length<=500
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div aria-modal="true" className={styles.dialog} role="dialog"><ShieldAlert size={24}/><h2>{title}</h2><label className={styles.field}><span>{c.reason}</span><textarea autoFocus maxLength={500} rows={5} value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p className={styles.error}>{c.actionError}</p>}<div className={styles.dialogActions}><button className={styles.quiet} onClick={onClose}>{c.cancel}</button><button className={styles.primary} disabled={!valid||pending} onClick={()=>onSubmit(reason.trim())}>{c.confirm}</button></div></div></div>
}
