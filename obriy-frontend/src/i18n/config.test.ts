import { describe, expect, it } from 'vitest'
import i18n from './config'

describe('i18n resources', () => {
  it('keeps the Ukrainian and English dictionaries structurally identical', () => {
    const ukKeys = getLeafKeys(i18n.getResourceBundle('uk', 'translation'))
    const enKeys = getLeafKeys(i18n.getResourceBundle('en', 'translation'))

    expect(ukKeys).toEqual(enKeys)
  })
})

function getLeafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix]
  }

  return Object.entries(value)
    .flatMap(([key, child]) => getLeafKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort()
}
