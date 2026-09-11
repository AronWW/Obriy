import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import { useSessionStore } from '../../auth/model/session.store'
import { API_BASE_URL } from '../../../shared/config/env'
import {
  getNotifications,
  getNotificationUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api'
import { notificationQueryKeys } from '../model/notification-query-keys'
import { notificationRoute } from '../model/notification-route'
import type {
  AppNotification,
  NotificationFilter,
} from '../model/notification.types'
import styles from './NotificationCenter.module.css'

const REALTIME_URL = `${new URL(API_BASE_URL, window.location.origin).origin}/realtime`

export function NotificationCenter() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const accessToken = useSessionStore((state) => state.accessToken)
  const role = useSessionStore((state) => state.user?.role)
  const [filter, setFilter] = useState<NotificationFilter>('ALL')
  const [isOpen, setIsOpen] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const unreadQuery = useQuery({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: getNotificationUnreadCount,
    enabled: Boolean(accessToken),
  })
  const listQuery = useInfiniteQuery({
    queryKey: notificationQueryKeys.list(filter),
    queryFn: ({ pageParam }) => getNotifications(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: isOpen && Boolean(accessToken),
  })
  const notifications = useMemo(
    () => uniqueNotifications(listQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [listQuery.data],
  )
  const unreadCount = unreadQuery.data?.unreadCount ?? listQuery.data?.pages[0]?.unreadCount ?? 0

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.root })
  }, [queryClient])

  useEffect(() => {
    if (!accessToken) return
    const socket: Socket = io(REALTIME_URL, {
      auth: { accessToken },
      transports: ['websocket'],
      reconnection: true,
    })
    socket.on('connect', () => {
      setConnectionState('connected')
      refresh()
    })
    socket.on('disconnect', () => setConnectionState('disconnected'))
    socket.on('connect_error', () => setConnectionState('disconnected'))
    socket.on('notification.created', refresh)
    socket.on('notification.read', refresh)
    socket.on('notification.read-all', refresh)
    return () => {
      socket.disconnect()
    }
  }, [accessToken, refresh])

  useEffect(() => {
    const reconcile = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', reconcile)
    document.addEventListener('visibilitychange', reconcile)
    return () => {
      window.removeEventListener('focus', reconcile)
      document.removeEventListener('visibilitychange', reconcile)
    }
  }, [refresh])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    queueMicrotask(() => closeRef.current?.focus())
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: refresh,
  })
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refresh,
  })

  const openNotification = async (notification: AppNotification) => {
    if (!notification.isRead) await readMutation.mutateAsync(notification.id)
    setIsOpen(false)
    navigate(notificationRoute(notification, role))
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t('notifications.open')}
        className={styles.trigger}
        onClick={() => setIsOpen((value) => !value)}
        ref={triggerRef}
        title={t('notifications.open')}
        type="button"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge} aria-label={t('notifications.unreadCount', { count: unreadCount })}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section aria-label={t('notifications.title')} className={styles.panel} role="dialog">
          <header className={styles.header}>
            <div>
              <h2>{t('notifications.title')}</h2>
              <p>{t('notifications.subtitle')}</p>
            </div>
            <button aria-label={t('notifications.close')} className={styles.close} onClick={() => { setIsOpen(false); triggerRef.current?.focus() }} ref={closeRef} type="button">×</button>
          </header>

          <div className={styles.toolbar}>
            <div className={styles.filters} role="group" aria-label={t('notifications.filterLabel')}>
              {(['ALL', 'UNREAD'] as const).map((value) => (
                <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)} type="button">
                  {t(`notifications.filters.${value}`)}
                </button>
              ))}
            </div>
            <button className={styles.readAll} disabled={unreadCount === 0 || readAllMutation.isPending} onClick={() => readAllMutation.mutate()} type="button">
              <CheckCheck size={15} /> {t('notifications.readAll')}
            </button>
          </div>

          {connectionState === 'disconnected' && (
            <p className={styles.connection}><WifiOff size={14} /> {t('notifications.disconnected')}</p>
          )}

          <div className={styles.list}>
            {listQuery.isPending && <div className={styles.state}><LoaderCircle className={styles.spin} size={22} />{t('notifications.loading')}</div>}
            {listQuery.isError && (
              <div className={styles.state}>
                <BellOff size={22} />
                <span>{t('notifications.error')}</span>
                <button onClick={() => void listQuery.refetch()} type="button"><RefreshCw size={14} />{t('notifications.retry')}</button>
              </div>
            )}
            {!listQuery.isPending && !listQuery.isError && notifications.length === 0 && (
              <div className={styles.state}><BellOff size={22} /><span>{t(filter === 'UNREAD' ? 'notifications.emptyUnread' : 'notifications.empty')}</span></div>
            )}
            {notifications.map((notification) => (
              <button
                className={styles.item}
                data-read={notification.isRead}
                key={notification.id}
                onClick={() => void openNotification(notification)}
                type="button"
              >
                <span className={styles.marker} aria-hidden="true" />
                <span className={styles.itemBody}>
                  <strong>{t(`notifications.types.${notification.type}.title`)}</strong>
                  <span>{t(`notifications.types.${notification.type}.message`, notificationValues(notification.payload))}</span>
                  <time dateTime={notification.createdAt}>{formatTime(notification.createdAt, i18n.resolvedLanguage)}</time>
                </span>
              </button>
            ))}
            {listQuery.hasNextPage && (
              <button className={styles.more} disabled={listQuery.isFetchingNextPage} onClick={() => void listQuery.fetchNextPage()} type="button">
                {listQuery.isFetchingNextPage ? t('notifications.loading') : t('notifications.more')}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function notificationValues(payload: Record<string, unknown>): Record<string, string | number> {
  const values: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' || typeof value === 'number') values[key] = value
  }
  return values
}

function uniqueNotifications(items: AppNotification[]): AppNotification[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function formatTime(value: string, language?: string): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
