import { useMutation } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../auth/model/session.store'
import { profileApi } from '../api/profile.api'
import styles from './ProfileControls.module.css'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function AvatarEditor({ hasAvatar }: { hasAvatar: boolean }) {
  const { t } = useTranslation()
  const updateUser = useSessionStore((state) => state.updateUser)
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixels, setPixels] = useState<Area | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const closeDialog = useCallback(() => {
    if (source) URL.revokeObjectURL(source)
    setSource(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setPixels(null)
    setLocalError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [source])

  useEffect(() => () => {
    if (source) URL.revokeObjectURL(source)
  }, [source])

  useEffect(() => {
    if (!source) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeDialog, source])

  const upload = useMutation({
    mutationFn: profileApi.uploadAvatar,
    onSuccess: (user) => {
      updateUser(user)
      closeDialog()
    },
  })
  const remove = useMutation({
    mutationFn: profileApi.removeAvatar,
    onSuccess: updateUser,
  })

  const selectFile = (file?: File) => {
    setLocalError(null)
    if (!file) return
    if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
      setLocalError(t('profileSettings.avatar.invalid'))
      return
    }
    setSource(URL.createObjectURL(file))
  }

  const confirm = async () => {
    if (!source || !pixels) return
    try {
      upload.mutate(await cropImage(source, pixels))
    } catch {
      setLocalError(t('profileSettings.avatar.error'))
    }
  }

  const pending = upload.isPending || remove.isPending

  return (
    <>
      <div className={styles.avatarEditor}>
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <button
          className={styles.avatarButton}
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus size={16} aria-hidden="true" />
          {t('profileSettings.avatar.upload')}
        </button>
        {hasAvatar && (
          <button
            className={styles.removeButton}
            type="button"
            disabled={pending}
            onClick={() => remove.mutate()}
          >
            <Trash2 size={16} aria-hidden="true" />
            {t('profileSettings.avatar.remove')}
          </button>
        )}
      </div>
      {(localError || upload.isError || remove.isError) && (
        <p className={styles.error} role="alert">
          {localError ?? t('profileSettings.avatar.error')}
        </p>
      )}

      {source && (
        <div className={styles.dialogBackdrop} role="presentation">
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-crop-title"
          >
            <h2 id="avatar-crop-title">{t('profileSettings.avatar.cropTitle')}</h2>
            <div className={styles.cropArea}>
              <Cropper
                image={source}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={(_, areaPixels) => setPixels(areaPixels)}
                onZoomChange={setZoom}
              />
            </div>
            <label className={styles.zoom}>
              <span>{t('profileSettings.avatar.zoom')}</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <div className={styles.dialogActions}>
              <button className={styles.secondaryButton} type="button" autoFocus onClick={closeDialog}>
                {t('profileSettings.cancel')}
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!pixels || upload.isPending}
                onClick={() => void confirm()}
              >
                {upload.isPending
                  ? t('profileSettings.avatar.uploading')
                  : t('profileSettings.avatar.confirm')}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

async function cropImage(source: string, area: Area): Promise<Blob> {
  const image = await loadImage(source)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    512,
    512,
  )
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Crop failed'))),
      'image/webp',
      0.9,
    ),
  )
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image load failed'))
    image.src = source
  })
}
