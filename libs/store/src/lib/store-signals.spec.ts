import { describe, expect, it, vi } from 'vitest'
import { notifyTabsChanged, onTabsChanged, useKlankStore } from './store.js'

describe('tab change signal', () => {
  it('notifies subscribers and stops after unsubscribe', () => {
    const fn = vi.fn()
    const unsubscribe = onTabsChanged(fn)
    notifyTabsChanged()
    expect(fn).toHaveBeenCalledTimes(1)
    unsubscribe()
    notifyTabsChanged()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fires when a tab-setting write happens', () => {
    useKlankStore.setState({
      baseDirectory: '/tabs',
      tab: { ...useKlankStore.getState().tab, path: '/tabs/a.tab.txt' },
    })
    const fn = vi.fn()
    const unsubscribe = onTabsChanged(fn)
    useKlankStore.getState().setTabFontSize(15)
    expect(fn).toHaveBeenCalled()
    unsubscribe()
  })
})

describe('syncSettings', () => {
  it('merges partial updates without disturbing other fields', () => {
    useKlankStore.getState().setSyncSettings({ intervalMinutes: 10 })
    expect(useKlankStore.getState().syncSettings.intervalMinutes).toBe(10)
    expect(useKlankStore.getState().syncSettings.enabled).toBe(true)

    useKlankStore.getState().setSyncSettings({ enabled: false })
    expect(useKlankStore.getState().syncSettings.enabled).toBe(false)
    expect(useKlankStore.getState().syncSettings.intervalMinutes).toBe(10)
  })
})

describe('setPlaylistSectionCollapsed', () => {
  it('sets the flag without disturbing the rest of the ui slice', () => {
    const before = useKlankStore.getState().ui
    useKlankStore.getState().setPlaylistSectionCollapsed(true)
    expect(useKlankStore.getState().ui.isPlaylistSectionCollapsed).toBe(true)
    expect(useKlankStore.getState().ui.isMenuExtended).toBe(before.isMenuExtended)
    expect(useKlankStore.getState().ui.menuWidth).toBe(before.menuWidth)

    useKlankStore.getState().setPlaylistSectionCollapsed(false)
    expect(useKlankStore.getState().ui.isPlaylistSectionCollapsed).toBe(false)
  })
})
