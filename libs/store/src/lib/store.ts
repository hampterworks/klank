import {create} from 'zustand'
import {devtools, persist} from 'zustand/middleware'
import type {} from '@redux-devtools/extension'
import { FileService, PerTabSettings, type Instrument, type JamSnapshot, type Playlist, type SyncErrorKind } from '@klank/platform-api'
import type { CustomTuning } from '@klank/audio'

// JamSnapshot is defined once in @klank/platform-api; re-exported here so jam
// consumers can import it alongside the store.
export type { Instrument, Playlist, CustomTuning, JamSnapshot }

/** Whether this client is currently hosting, following as a guest, or off. */
export type JamRole = 'off' | 'host' | 'guest'

/**
 * Ephemeral jam state — NOT persisted (excluded from `partialize`).
 * Resets to defaults on every app launch.
 */
export type JamState = {
  role: JamRole
  // host
  port: number | null
  urls: string[]
  /** Host-chosen jam name advertised on the LAN (host only). */
  name: string
  // guest
  /** "ip:port" string the user typed, e.g. "192.168.1.5:7070". */
  hostAddress: string
  connected: boolean
  /** Latest snapshot received from the host (guest only). */
  snapshot: JamSnapshot | null
  /** Live connected-guest count — host polls status, guest reads it from snapshots. */
  clients: number
}

export type Mode = "Read" | "Edit"
export type Theme = "Light" | "Dark"
export type Ui = {
  isMenuExtended: boolean
  menuWidth: number
}

/**
 * Settings for a single open tab. Fields marked with `@persisted` are saved to
 * `klank-storage` in localStorage — never rename them.
 */
export type TabSetting = {
  /** @persisted Full file-system path to the .tab.txt file. */
  path: string
  /** @persisted Display font size in px. Clamped 0–22 by `setTabFontSize`. */
  fontSize: number
  /** @persisted Transposition offset in semitones. Positive = up, negative = down. */
  transpose: number
  /** @persisted Auto-scroll speed level. Range 1–10; maps to px/s via 8 * 1.5^(speed-1). */
  scrollSpeed: number
  /** @persisted Metadata string (e.g. artist info). */
  details: string
  /** Ephemeral — not persisted. True while auto-scroll is running. */
  isScrolling: boolean
  /** @persisted Source URL (e.g. Ultimate Guitar link) if the tab was downloaded. */
  link?: string
}

/** User-configurable auto-sync cadence. Persisted to localStorage. */
export type SyncSettings = {
  /** Master switch for background git sync. */
  enabled: boolean
  /** Periodic sync interval in minutes. */
  intervalMinutes: number
  /** Debounce after a local edit before syncing, in minutes. */
  debounceMinutes: number
}

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: true,
  intervalMinutes: 30,
  debounceMinutes: 5,
}

/** Which tab of the Harmony browser is active. */
export type HarmonyTab = 'chords' | 'scales' | 'chord-scales'

/**
 * Persisted UI memory for the Harmony section (scale/chord browser).
 * Additive slice — safe to extend; never rename existing fields.
 */
export type HarmonySettings = {
  /** Selected root pitch class, C=0. */
  rootPitch: number
  /** Selected scale id (see SCALES in @klank/platform-api). */
  scaleId: string
  /** Selected chord quality suffix (see CHORD_QUALITIES); '' = major. */
  quality: string
  /** Active browser tab. */
  tab: HarmonyTab
}

export const DEFAULT_HARMONY_SETTINGS: HarmonySettings = {
  rootPitch: 0,
  scaleId: 'ionian',
  quality: '',
  tab: 'scales',
}

export type SyncRunState = 'idle' | 'syncing' | 'error' | 'offline'

/** Live status of the background sync loop, surfaced in Settings. Not persisted. */
export type SyncStatus = {
  state: SyncRunState
  /** Epoch ms of the last successful sync, or null if never. */
  lastSyncedAt: number | null
  message: string
  /** Failure category for actionable feedback (set on error/offline). */
  kind?: SyncErrorKind
}

/**
 * Lightweight change signal driving debounced auto-sync. Tab/settings/playlist
 * writes call `notifyTabsChanged`; the auto-sync hook subscribes via `onTabsChanged`.
 * Kept module-level (not React state) so store mutators can fire it like the
 * existing fire-and-forget file writes.
 */
const tabsChangedListeners = new Set<() => void>()
export const onTabsChanged = (fn: () => void): (() => void) => {
  tabsChangedListeners.add(fn)
  return () => {
    tabsChangedListeners.delete(fn)
  }
}
export const notifyTabsChanged = (): void => {
  for (const fn of tabsChangedListeners) fn()
}

type KlankState = {
  /** Ephemeral — not persisted. Which panel is shown on the right. */
  activeView: 'tab' | 'settings' | 'harmony'
  setActiveView: (view: 'tab' | 'settings' | 'harmony') => void
  /** Active tab directory chosen by the user. Not persisted. */
  baseDirectory?: string
  /** True when running outside Tauri (browser/server). Not persisted. */
  serverMode?: boolean
  /** Tauri FileService instance. Never persisted (runtime object). */
  fileService?: FileService
  tab: TabSetting
  mode: Mode
  theme: Theme
  ui: Ui
  toggleMenu: (isMenuExtended: boolean) => void
  setMenuWidth: (width: number) => void
  /** Atomically update menu open state and optionally its width in one render. */
  setMenuState: (isMenuExtended: boolean, menuWidth?: number) => void
  /** Per-file saved settings keyed by full file path. Loaded from and written to tab-settings.json. */
  tabSettingByPath: Record<string, PerTabSettings>
  setBaseDirectory: (directory: string) => void
  setFileService: (service: FileService) => void
  setMode: (mode: Mode) => void
  setTheme: (theme: Theme) => void
  setTabPath: (path: string) => void
  setTabFontSize: (size: number) => void
  setTabTranspose: (transpose: number) => void
  setTabScrollSpeed: (speed: number) => void
  setTabIsScrolling: (isScrolling: boolean) => void
  setTabSettingByPath: (path: string, settings: PerTabSettings) => void
  setTabSettings: (tabSettingByPath: Record<string, PerTabSettings>) => void
  setTabDetails: (details: string) => void
  setTabLink: (link: string) => void
  setServerMode: (serverMode: boolean) => void
  /** @persisted Instrument used for chord diagram tooltips and the Harmony section. */
  instrument: Instrument
  setInstrument: (instrument: Instrument) => void
  /** @persisted Harmony section (scale/chord browser) UI memory. */
  harmony: HarmonySettings
  setHarmony: (partial: Partial<HarmonySettings>) => void
  /** Named playlists — persisted to `.klank-settings.json` in the tab directory. */
  playlists: Playlist[]
  /** ID of the currently active playlist, or null when none is active. Persisted to localStorage. */
  activePlaylistId: string | null
  /** Index of the currently playing song within the active playlist. Persisted to localStorage. */
  activePlaylistIndex: number | null
  /**
   * Replaces all playlists — used to hydrate from `.klank-settings.json` at
   * startup. Clears or clamps the active selection when it no longer matches
   * the loaded playlists. Does not write back to the settings file.
   */
  setPlaylists: (playlists: Playlist[]) => void
  createPlaylist: (name: string) => void
  deletePlaylist: (id: string) => void
  renamePlaylist: (id: string, name: string) => void
  addTabToPlaylist: (id: string, path: string) => void
  removeTabFromPlaylist: (id: string, path: string) => void
  reorderPlaylist: (id: string, paths: string[]) => void
  setActivePlaylist: (id: string | null) => void
  nextInPlaylist: () => void
  prevInPlaylist: () => void
  /**
   * Cleans up all state referencing a tab file that was deleted from disk:
   * clears `tab.path` if it was open, drops its `tabSettingByPath` entry, and
   * removes it from every playlist (adjusting `activePlaylistIndex`).
   * Does not touch the file system — callers delete the file via FileService first.
   */
  deleteTab: (path: string) => void
  /** @persisted Auto-sync cadence (interval, debounce, on/off). */
  syncSettings: SyncSettings
  setSyncSettings: (partial: Partial<SyncSettings>) => void
  /** Live sync status for the Settings UI. Not persisted. */
  syncStatus: SyncStatus
  setSyncStatus: (status: Partial<SyncStatus>) => void
  /** @persisted User-defined custom tunings for the tuner. */
  customTunings: CustomTuning[]
  addCustomTuning: (tuning: CustomTuning) => void
  deleteCustomTuning: (id: string) => void
  /**
   * Ephemeral jam state. Not persisted — excluded from `partialize`.
   * Use setters below to transition between roles.
   */
  jam: JamState
  /** Called when this client becomes the host after jam server starts. */
  setJamHosting: (info: { port: number; urls: string[]; name: string }) => void
  /** Called when the user chooses to join as a guest. Sets address, clears snapshot. */
  setJamGuest: (hostAddress: string) => void
  /** Resets jam to the default off state. */
  setJamOff: () => void
  /** Updates guest WebSocket connection status. */
  setJamConnected: (connected: boolean) => void
  /** Stores the latest snapshot received from the host. */
  setJamSnapshot: (snapshot: JamSnapshot) => void
  /** Updates the live connected-guest count. */
  setJamClients: (clients: number) => void
}

/** All valid scroll speed levels (0–9, displayed as 1–10). */
export const SCROLL_SPEEDS = [...new Array(10).keys()] as const
export type ScrollSpeeds = typeof SCROLL_SPEEDS[number]

/** The slice of KlankState saved to localStorage — must match what `partialize` returns. */
type PersistedKlankState = Pick<
  KlankState,
  'tab' | 'theme' | 'ui' | 'baseDirectory' | 'activePlaylistId' | 'activePlaylistIndex' | 'syncSettings' | 'instrument' | 'harmony' | 'customTunings'
>

/** Fire-and-forget write of all playlists to `.klank-settings.json`. No-op until a directory and FileService are set. */
const persistPlaylists = (
  state: Pick<KlankState, 'fileService' | 'baseDirectory'>,
  playlists: Playlist[],
) => {
  if (state.baseDirectory) {
    state.fileService?.writePlaylists(playlists, state.baseDirectory)
    notifyTabsChanged()
  }
}

const clampFontSize = (size: number) => {
  if (size < 0) {
    return 0
  } else if (size >= 22) {
    return 22
  }
  return size
}

/**
 * Global Zustand store for klank.
 *
 * Persisted to `localStorage` under the key `klank-storage` via Zustand's
 * `persist` middleware. Redux DevTools are enabled in development.
 *
 * Usage: `const { tab, setTabTranspose } = useKlankStore()`
 */
export const useKlankStore = create<KlankState>()(
  devtools(
    persist(
      (set) => ({
        activeView: 'tab' as const,
        setActiveView: (activeView) => set((state) => ({ ...state, activeView })),
        ui: {
          isMenuExtended: true,
          menuWidth: 400,
        },
        tab: {
          path: "",
          fontSize: 12,
          transpose: 0,
          scrollSpeed: 1,
          isScrolling: false,
          details: "",
          link: '',
        },
        tabSettingByPath: {},
        mode: "Read",
        theme: (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'Dark' : 'Light',
        instrument: "guitar" as Instrument,
        playlists: [],
        activePlaylistId: null,
        activePlaylistIndex: null,
        setBaseDirectory: (baseDirectory) => set((state) => ({...state, baseDirectory})),
        setFileService: (fileService) => set((state) => ({...state, fileService})),
        setMode: (mode) => set((state) => ({...state, mode})),
        toggleMenu: (isMenuExtended) => set((state) => ({...state, ui: {...state.ui, isMenuExtended}})),
        setMenuWidth: (menuWidth) => set((state) => ({...state, ui: {...state.ui, menuWidth}})),
        setMenuState: (isMenuExtended, menuWidth) => set((state) => ({
          ...state,
          ui: { ...state.ui, isMenuExtended, ...(menuWidth !== undefined ? { menuWidth } : {}) },
        })),
        setTheme: (theme) => set((state) => ({...state, theme})),
        setInstrument: (instrument) => set((state) => ({...state, instrument})),
        harmony: DEFAULT_HARMONY_SETTINGS,
        setHarmony: (partial) => set((state) => ({...state, harmony: {...state.harmony, ...partial}})),
        syncSettings: DEFAULT_SYNC_SETTINGS,
        setSyncSettings: (partial) => set((state) => ({...state, syncSettings: {...state.syncSettings, ...partial}})),
        syncStatus: { state: 'idle', lastSyncedAt: null, message: '' },
        setSyncStatus: (status) => set((state) => ({...state, syncStatus: {...state.syncStatus, ...status}})),
        customTunings: [],
        addCustomTuning: (tuning) => set((state) => ({...state, customTunings: [...state.customTunings, tuning]})),
        deleteCustomTuning: (id) => set((state) => ({...state, customTunings: state.customTunings.filter((t) => t.id !== id)})),
        // ── Jam slice (ephemeral — not in partialize) ──────────────────────────
        jam: { role: 'off', port: null, urls: [], name: '', hostAddress: '', connected: false, snapshot: null, clients: 0 },
        setJamHosting: (info) => set((state) => ({
          ...state,
          jam: { ...state.jam, role: 'host', port: info.port, urls: info.urls, name: info.name, clients: 0 },
        })),
        setJamGuest: (hostAddress) => set((state) => ({
          ...state,
          jam: { ...state.jam, role: 'guest', hostAddress, connected: false, snapshot: null, clients: 0 },
        })),
        setJamOff: () => set((state) => ({
          ...state,
          jam: { role: 'off', port: null, urls: [], name: '', hostAddress: '', connected: false, snapshot: null, clients: 0 },
        })),
        setJamConnected: (connected) => set((state) => ({
          ...state,
          jam: { ...state.jam, connected },
        })),
        setJamSnapshot: (snapshot) => set((state) => ({
          ...state,
          // The host injects `clients` into each frame; mirror it into state so
          // guests can show the count without a separate message.
          jam: {
            ...state.jam,
            snapshot,
            clients: typeof snapshot.clients === 'number' ? snapshot.clients : state.jam.clients,
          },
        })),
        setJamClients: (clients) => set((state) => ({
          ...state,
          jam: { ...state.jam, clients },
        })),
        setTabPath: (path) => set((state) => {
          const saved = state.tabSettingByPath[path]
          const tab: TabSetting = {
            ...state.tab,
            path,
            isScrolling: false,
            fontSize: saved?.fontSize ?? state.tab.fontSize,
            transpose: saved?.transpose ?? 0,
            scrollSpeed: saved?.scrollSpeed ?? state.tab.scrollSpeed,
          }
          // Snapshot current tab's settings to file before leaving it
          if (state.tab.path && state.baseDirectory) {
            state.fileService?.writeTabSetting(state.tab.path, {
              fontSize: state.tab.fontSize,
              transpose: state.tab.transpose,
              scrollSpeed: state.tab.scrollSpeed,
            }, state.baseDirectory)
            notifyTabsChanged()
          }
          const tabSettingByPath = state.tab.path
            ? {
                ...state.tabSettingByPath,
                [state.tab.path]: {
                  fontSize: state.tab.fontSize,
                  transpose: state.tab.transpose,
                  scrollSpeed: state.tab.scrollSpeed,
                },
              }
            : state.tabSettingByPath
          return { ...state, tab, tabSettingByPath }
        }),
        setTabFontSize: (fontSize) => set((state) => {
          const clamped = clampFontSize(fontSize)
          const tab = { ...state.tab, fontSize: clamped }
          const entry: PerTabSettings = { fontSize: clamped, transpose: state.tab.transpose, scrollSpeed: state.tab.scrollSpeed }
          const tabSettingByPath = state.tab.path
            ? { ...state.tabSettingByPath, [state.tab.path]: entry }
            : state.tabSettingByPath
          if (state.tab.path && state.baseDirectory) {
            state.fileService?.writeTabSetting(state.tab.path, entry, state.baseDirectory)
            notifyTabsChanged()
          }
          return { ...state, tab, tabSettingByPath }
        }),
        setTabTranspose: (transpose) => set((state) => {
          const tab = { ...state.tab, transpose }
          const entry: PerTabSettings = { fontSize: state.tab.fontSize, transpose, scrollSpeed: state.tab.scrollSpeed }
          const tabSettingByPath = state.tab.path
            ? { ...state.tabSettingByPath, [state.tab.path]: entry }
            : state.tabSettingByPath
          if (state.tab.path && state.baseDirectory) {
            state.fileService?.writeTabSetting(state.tab.path, entry, state.baseDirectory)
            notifyTabsChanged()
          }
          return { ...state, tab, tabSettingByPath }
        }),
        setTabScrollSpeed: (scrollSpeed) => set((state) => {
          const tab = { ...state.tab, scrollSpeed }
          const entry: PerTabSettings = { fontSize: state.tab.fontSize, transpose: state.tab.transpose, scrollSpeed }
          const tabSettingByPath = state.tab.path
            ? { ...state.tabSettingByPath, [state.tab.path]: entry }
            : state.tabSettingByPath
          if (state.tab.path && state.baseDirectory) {
            state.fileService?.writeTabSetting(state.tab.path, entry, state.baseDirectory)
            notifyTabsChanged()
          }
          return { ...state, tab, tabSettingByPath }
        }),
        setTabIsScrolling: (isScrolling) => set((state) => ({...state, tab: {...state.tab, isScrolling}})),
        setTabSettingByPath: (path, tabSetting) => set((state) => ({...state, tabSettingByPath: {...state.tabSettingByPath, [path]: tabSetting}})),
        setTabSettings: (tabSettingByPath) => set((state) => ({...state, tabSettingByPath})),
        setTabDetails: (details) => set((state) => ({...state,tab: {...state.tab, details}})),
        setTabLink: (link) => set( state => ({...state, tab: {...state.tab, link}})),
        setServerMode: (serverMode) => set((state) => ({...state, serverMode})),
        setPlaylists: (playlists) => set((state) => {
          const active = playlists.find((p) => p.id === state.activePlaylistId)
          let activePlaylistIndex = active ? state.activePlaylistIndex : null
          if (active && activePlaylistIndex !== null) {
            activePlaylistIndex = active.paths.length === 0
              ? null
              : Math.min(activePlaylistIndex, active.paths.length - 1)
          }
          return {
            ...state,
            playlists,
            activePlaylistId: active ? state.activePlaylistId : null,
            activePlaylistIndex,
          }
        }),
        createPlaylist: (name) => set((state) => {
          const playlists = [
            ...state.playlists,
            { id: crypto.randomUUID(), name, paths: [], createdAt: Date.now() },
          ]
          persistPlaylists(state, playlists)
          return { ...state, playlists }
        }),
        deletePlaylist: (id) => set((state) => {
          const playlists = state.playlists.filter((p) => p.id !== id)
          persistPlaylists(state, playlists)
          return {
            ...state,
            playlists,
            activePlaylistId: state.activePlaylistId === id ? null : state.activePlaylistId,
            activePlaylistIndex: state.activePlaylistId === id ? null : state.activePlaylistIndex,
          }
        }),
        renamePlaylist: (id, name) => set((state) => {
          const playlists = state.playlists.map((p) => p.id === id ? { ...p, name } : p)
          persistPlaylists(state, playlists)
          return { ...state, playlists }
        }),
        addTabToPlaylist: (id, path) => set((state) => {
          const playlists = state.playlists.map((p) =>
            p.id === id && !p.paths.includes(path)
              ? { ...p, paths: [...p.paths, path] }
              : p
          )
          persistPlaylists(state, playlists)
          return { ...state, playlists }
        }),
        removeTabFromPlaylist: (id, path) => set((state) => {
          const playlist = state.playlists.find((p) => p.id === id)
          const newPaths = playlist?.paths.filter((p) => p !== path) ?? []
          const removedIndex = playlist?.paths.indexOf(path) ?? -1
          let newIndex = state.activePlaylistIndex
          if (state.activePlaylistId === id && newIndex !== null) {
            if (removedIndex < newIndex) newIndex = newIndex - 1
            if (newIndex >= newPaths.length) newIndex = Math.max(0, newPaths.length - 1)
          }
          const playlists = state.playlists.map((p) => p.id === id ? { ...p, paths: newPaths } : p)
          persistPlaylists(state, playlists)
          return {
            ...state,
            playlists,
            activePlaylistIndex: newIndex,
          }
        }),
        reorderPlaylist: (id, paths) => set((state) => {
          const playlists = state.playlists.map((p) => p.id === id ? { ...p, paths } : p)
          persistPlaylists(state, playlists)
          return { ...state, playlists }
        }),
        setActivePlaylist: (id) => set((state) => {
          if (id === null) return { ...state, activePlaylistId: null, activePlaylistIndex: null }
          const playlist = state.playlists.find((p) => p.id === id)
          if (!playlist || playlist.paths.length === 0) return { ...state, activePlaylistId: id, activePlaylistIndex: null }
          const firstPath = playlist.paths[0]
          const saved = state.tabSettingByPath[firstPath]
          return {
            ...state,
            activePlaylistId: id,
            activePlaylistIndex: 0,
            tab: {
              ...state.tab,
              path: firstPath,
              isScrolling: false,
              fontSize: saved?.fontSize ?? state.tab.fontSize,
              transpose: saved?.transpose ?? 0,
              scrollSpeed: saved?.scrollSpeed ?? state.tab.scrollSpeed,
            },
          }
        }),
        nextInPlaylist: () => set((state) => {
          const { activePlaylistId, activePlaylistIndex, playlists } = state
          if (activePlaylistId === null || activePlaylistIndex === null) return state
          const playlist = playlists.find((p) => p.id === activePlaylistId)
          if (!playlist || playlist.paths.length === 0) return state
          const nextIndex = (activePlaylistIndex + 1) % playlist.paths.length
          const path = playlist.paths[nextIndex]
          const saved = state.tabSettingByPath[path]
          return {
            ...state,
            activePlaylistIndex: nextIndex,
            tab: {
              ...state.tab,
              path,
              isScrolling: false,
              fontSize: saved?.fontSize ?? state.tab.fontSize,
              transpose: saved?.transpose ?? 0,
              scrollSpeed: saved?.scrollSpeed ?? state.tab.scrollSpeed,
            },
          }
        }),
        prevInPlaylist: () => set((state) => {
          const { activePlaylistId, activePlaylistIndex, playlists } = state
          if (activePlaylistId === null || activePlaylistIndex === null) return state
          const playlist = playlists.find((p) => p.id === activePlaylistId)
          if (!playlist || playlist.paths.length === 0) return state
          const prevIndex = (activePlaylistIndex - 1 + playlist.paths.length) % playlist.paths.length
          const path = playlist.paths[prevIndex]
          const saved = state.tabSettingByPath[path]
          return {
            ...state,
            activePlaylistIndex: prevIndex,
            tab: {
              ...state.tab,
              path,
              isScrolling: false,
              fontSize: saved?.fontSize ?? state.tab.fontSize,
              transpose: saved?.transpose ?? 0,
              scrollSpeed: saved?.scrollSpeed ?? state.tab.scrollSpeed,
            },
          }
        }),
        deleteTab: (path) => set((state) => {
          const tabSettingByPath = { ...state.tabSettingByPath }
          delete tabSettingByPath[path]
          const tab = state.tab.path === path
            ? { ...state.tab, path: "", isScrolling: false }
            : state.tab

          const playlistsChanged = state.playlists.some((p) => p.paths.includes(path))
          let activePlaylistIndex = state.activePlaylistIndex
          const playlists = state.playlists.map((p) => {
            const removedIndex = p.paths.indexOf(path)
            if (removedIndex === -1) return p
            const newPaths = p.paths.filter((x) => x !== path)
            if (p.id === state.activePlaylistId && activePlaylistIndex !== null) {
              if (newPaths.length === 0) {
                activePlaylistIndex = null
              } else {
                if (removedIndex < activePlaylistIndex) activePlaylistIndex = activePlaylistIndex - 1
                if (activePlaylistIndex >= newPaths.length) activePlaylistIndex = newPaths.length - 1
              }
            }
            return { ...p, paths: newPaths }
          })
          if (playlistsChanged) persistPlaylists(state, playlists)

          return { ...state, tab, tabSettingByPath, playlists, activePlaylistIndex }
        }),
      }),
      {
        name: 'klank-storage',
        version: 4,
        // v0 persisted playlists in localStorage; they now live in
        // .klank-settings.json, so stale localStorage copies are dropped.
        // v2 adds syncSettings; defaults fill in for older persisted state.
        // v3 persists instrument and the Harmony section settings.
        // v4 adds customTunings; older persisted state gets customTunings: [].
        migrate: (persistedState) => {
          const state = { ...((persistedState ?? {}) as Record<string, unknown>) }
          delete state['playlists']
          return {
            ...state,
            syncSettings: { ...DEFAULT_SYNC_SETTINGS, ...(state.syncSettings as Partial<SyncSettings> | undefined) },
            instrument: (state.instrument as Instrument | undefined) ?? 'guitar',
            harmony: { ...DEFAULT_HARMONY_SETTINGS, ...(state.harmony as Partial<HarmonySettings> | undefined) },
            customTunings: (state.customTunings as CustomTuning[] | undefined) ?? [],
          } as unknown as PersistedKlankState
        },
        partialize: (state) => ({
          tab: { ...state.tab, isScrolling: false },
          theme: state.theme,
          ui: state.ui,
          baseDirectory: state.baseDirectory,
          activePlaylistId: state.activePlaylistId,
          activePlaylistIndex: state.activePlaylistIndex,
          syncSettings: state.syncSettings,
          instrument: state.instrument,
          harmony: state.harmony,
          customTunings: state.customTunings,
        }),
      }
    )
  )
)
