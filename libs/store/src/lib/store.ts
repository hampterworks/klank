import {create} from 'zustand'
import {devtools, persist} from 'zustand/middleware'
import type {} from '@redux-devtools/extension'
import { FileService, PerTabSettings, type Instrument } from '@klank/platform-api'

export type { Instrument }

export type Mode = "Read" | "Edit"
export type Theme = "Light" | "Dark"
export type Ui = {
  isMenuExtended: boolean
  menuWidth: number
}

export type Playlist = {
  id: string
  name: string
  /** Ordered list of full file-system paths to .tab.txt files. */
  paths: string[]
  createdAt: number
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

type KlankState = {
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
  /** @persisted Instrument used for chord diagram tooltips. */
  instrument: Instrument
  setInstrument: (instrument: Instrument) => void
  /** Named playlists — persisted to localStorage. */
  playlists: Playlist[]
  /** ID of the currently active playlist, or null when none is active. Persisted. */
  activePlaylistId: string | null
  /** Index of the currently playing song within the active playlist. Persisted. */
  activePlaylistIndex: number | null
  createPlaylist: (name: string) => void
  deletePlaylist: (id: string) => void
  renamePlaylist: (id: string, name: string) => void
  addTabToPlaylist: (id: string, path: string) => void
  removeTabFromPlaylist: (id: string, path: string) => void
  reorderPlaylist: (id: string, paths: string[]) => void
  setActivePlaylist: (id: string | null) => void
  nextInPlaylist: () => void
  prevInPlaylist: () => void
}

/** All valid scroll speed levels (0–9, displayed as 1–10). */
export const SCROLL_SPEEDS = [...new Array(10).keys()] as const
export type ScrollSpeeds = typeof SCROLL_SPEEDS[number]

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
        theme: "Light",
        instrument: "guitar" as Instrument,
        playlists: [],
        activePlaylistId: null,
        activePlaylistIndex: null,
        setBaseDirectory: (baseDirectory) => set((state) => ({...state, baseDirectory})),
        setFileService: (fileService) => set((state) => ({...state, fileService})),
        setMode: (mode) => set((state) => ({...state, mode})),
        toggleMenu: (isMenuExtended) => set((state) => ({...state, ui: {...state.ui, isMenuExtended}})),
        setMenuWidth: (menuWidth) => set((state) => ({...state, ui: {...state.ui, menuWidth}})),
        setTheme: (theme) => set((state) => ({...state, theme})),
        setInstrument: (instrument) => set((state) => ({...state, instrument})),
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
          if (state.tab.path && state.baseDirectory)
            state.fileService?.writeTabSetting(state.tab.path, entry, state.baseDirectory)
          return { ...state, tab, tabSettingByPath }
        }),
        setTabTranspose: (transpose) => set((state) => {
          const tab = { ...state.tab, transpose }
          const entry: PerTabSettings = { fontSize: state.tab.fontSize, transpose, scrollSpeed: state.tab.scrollSpeed }
          const tabSettingByPath = state.tab.path
            ? { ...state.tabSettingByPath, [state.tab.path]: entry }
            : state.tabSettingByPath
          if (state.tab.path && state.baseDirectory)
            state.fileService?.writeTabSetting(state.tab.path, entry, state.baseDirectory)
          return { ...state, tab, tabSettingByPath }
        }),
        setTabScrollSpeed: (scrollSpeed) => set((state) => {
          const tab = { ...state.tab, scrollSpeed }
          const entry: PerTabSettings = { fontSize: state.tab.fontSize, transpose: state.tab.transpose, scrollSpeed }
          const tabSettingByPath = state.tab.path
            ? { ...state.tabSettingByPath, [state.tab.path]: entry }
            : state.tabSettingByPath
          if (state.tab.path && state.baseDirectory)
            state.fileService?.writeTabSetting(state.tab.path, entry, state.baseDirectory)
          return { ...state, tab, tabSettingByPath }
        }),
        setTabIsScrolling: (isScrolling) => set((state) => ({...state, tab: {...state.tab, isScrolling}})),
        setTabSettingByPath: (path, tabSetting) => set((state) => ({...state, tabSettingByPath: {...state.tabSettingByPath, [path]: tabSetting}})),
        setTabSettings: (tabSettingByPath) => set((state) => ({...state, tabSettingByPath})),
        setTabDetails: (details) => set((state) => ({...state,tab: {...state.tab, details}})),
        setTabLink: (link) => set( state => ({...state, tab: {...state.tab, link}})),
        setServerMode: (serverMode) => set((state) => ({...state, serverMode})),
        createPlaylist: (name) => set((state) => ({
          ...state,
          playlists: [
            ...state.playlists,
            { id: crypto.randomUUID(), name, paths: [], createdAt: Date.now() },
          ],
        })),
        deletePlaylist: (id) => set((state) => ({
          ...state,
          playlists: state.playlists.filter((p) => p.id !== id),
          activePlaylistId: state.activePlaylistId === id ? null : state.activePlaylistId,
          activePlaylistIndex: state.activePlaylistId === id ? null : state.activePlaylistIndex,
        })),
        renamePlaylist: (id, name) => set((state) => ({
          ...state,
          playlists: state.playlists.map((p) => p.id === id ? { ...p, name } : p),
        })),
        addTabToPlaylist: (id, path) => set((state) => ({
          ...state,
          playlists: state.playlists.map((p) =>
            p.id === id && !p.paths.includes(path)
              ? { ...p, paths: [...p.paths, path] }
              : p
          ),
        })),
        removeTabFromPlaylist: (id, path) => set((state) => {
          const playlist = state.playlists.find((p) => p.id === id)
          const newPaths = playlist?.paths.filter((p) => p !== path) ?? []
          const removedIndex = playlist?.paths.indexOf(path) ?? -1
          let newIndex = state.activePlaylistIndex
          if (state.activePlaylistId === id && newIndex !== null) {
            if (removedIndex < newIndex) newIndex = newIndex - 1
            if (newIndex >= newPaths.length) newIndex = Math.max(0, newPaths.length - 1)
          }
          return {
            ...state,
            playlists: state.playlists.map((p) => p.id === id ? { ...p, paths: newPaths } : p),
            activePlaylistIndex: newIndex,
          }
        }),
        reorderPlaylist: (id, paths) => set((state) => ({
          ...state,
          playlists: state.playlists.map((p) => p.id === id ? { ...p, paths } : p),
        })),
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
      }),
      {
        name: 'klank-storage',
        partialize: (state) => ({
          tab: { ...state.tab, isScrolling: false },
          theme: state.theme,
          ui: state.ui,
          baseDirectory: state.baseDirectory,
          playlists: state.playlists,
          activePlaylistId: state.activePlaylistId,
          activePlaylistIndex: state.activePlaylistIndex,
        }),
      }
    )
  )
)
