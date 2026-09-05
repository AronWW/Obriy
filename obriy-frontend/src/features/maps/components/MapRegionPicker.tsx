import { Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MapRegionOption } from '../model/map.types'
import styles from '../Maps.module.css'

export function MapRegionPicker({
  disabled = false,
  onChange,
  regions,
  selectedRegionId,
}: {
  disabled?: boolean
  onChange: (region: MapRegionOption) => void
  regions: MapRegionOption[]
  selectedRegionId: string | null
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const searchId = useId()
  const selectId = useId()
  const selected = regions.find((region) => region.id === selectedRegionId)
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return regions
    const matches = regions.filter((region) =>
      [region.name, region.nameEn, region.nameUk, region.isoCode].some(
        (value) => value.toLocaleLowerCase().includes(normalized),
      ),
    )
    if (selected && !matches.some((region) => region.id === selected.id)) {
      return [selected, ...matches]
    }
    return matches
  }, [query, regions, selected])

  return (
    <div className={styles.regionPicker}>
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
      <label htmlFor={selectId}>{t('maps.region.list')}</label>
      <select
        disabled={disabled || regions.length === 0}
        id={selectId}
        onChange={(event) => {
          const region = regions.find(
            (candidate) => candidate.id === event.target.value,
          )
          if (region) onChange(region)
        }}
        value={selectedRegionId ?? ''}
      >
        <option value="">{t('maps.region.choose')}</option>
        {filtered.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name} · {region.isoCode}
          </option>
        ))}
      </select>
      {query && filtered.length === 0 && (
        <small>{t('maps.region.noResults')}</small>
      )}
      {selected && (
        <p className={styles.selectedRegion}>
          <span>{t('maps.region.selected')}</span>
          <strong>{selected.name}</strong>
          <small>{selected.isoCode}</small>
        </p>
      )}
    </div>
  )
}
