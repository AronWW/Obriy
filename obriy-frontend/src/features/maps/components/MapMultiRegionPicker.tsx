import { Search, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MapRegionOption } from '../model/map.types'
import styles from '../Maps.module.css'

interface MapMultiRegionPickerProps {
  disabled?: boolean
  maxSelections: number
  onClear: () => void
  onToggle: (region: MapRegionOption) => void
  regions: MapRegionOption[]
  selectedRegionIds: string[]
}

export function MapMultiRegionPicker({
  disabled = false,
  maxSelections,
  onClear,
  onToggle,
  regions,
  selectedRegionIds,
}: MapMultiRegionPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const searchId = useId()
  const selectedIds = useMemo(
    () => new Set(selectedRegionIds),
    [selectedRegionIds],
  )
  const selectedRegions = useMemo(
    () => regions.filter((region) => selectedIds.has(region.id)),
    [regions, selectedIds],
  )
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return regions
    return regions.filter((region) =>
      [region.name, region.nameEn, region.nameUk, region.isoCode].some(
        (value) => value.toLocaleLowerCase().includes(normalized),
      ),
    )
  }, [query, regions])
  const isAtLimit = selectedRegionIds.length >= maxSelections

  return (
    <div className={styles.multiRegionPicker}>
      <div className={styles.multiRegionPickerHeader}>
        <div>
          <strong>{t('maps.region.selectedCount')}</strong>
          <small>
            {t('maps.region.selectionCounter', {
              count: selectedRegionIds.length,
              max: maxSelections,
            })}
          </small>
        </div>
        <button
          disabled={disabled || selectedRegionIds.length === 0}
          onClick={onClear}
          type="button"
        >
          {t('maps.region.clear')}
        </button>
      </div>

      {selectedRegions.length > 0 && (
        <div className={styles.multiRegionChips}>
          {selectedRegions.map((region) => (
            <button
              aria-label={t('maps.region.removeNamed', { name: region.name })}
              disabled={disabled}
              key={region.id}
              onClick={() => onToggle(region)}
              type="button"
            >
              <span>{region.name}</span>
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <label htmlFor={searchId}>{t('maps.region.search')}</label>
      <div className={styles.regionSearchField}>
        <Search size={15} aria-hidden="true" />
        <input
          disabled={disabled || regions.length === 0}
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('maps.region.searchPlaceholder')}
          type="search"
          value={query}
        />
      </div>

      <div
        aria-label={t('maps.region.list')}
        className={styles.multiRegionList}
        role="group"
      >
        {filtered.map((region) => {
          const checked = selectedIds.has(region.id)
          return (
            <label
              className={checked ? styles.multiRegionRowSelected : undefined}
              key={region.id}
            >
              <input
                checked={checked}
                disabled={disabled || (isAtLimit && !checked)}
                onChange={() => onToggle(region)}
                type="checkbox"
              />
              <span>
                <strong>{region.name}</strong>
                <small>{region.isoCode}</small>
              </span>
            </label>
          )
        })}
        {filtered.length === 0 && <p>{t('maps.region.noResults')}</p>}
      </div>
    </div>
  )
}
