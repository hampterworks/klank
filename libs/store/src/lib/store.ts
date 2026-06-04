import {create} from 'zustand'
import {devtools, persist} from 'zustand/middleware'
import type {} from '@redux-devtools/extension'
import { FileService } from '@klank/platform-api'

export type Mode = "Read" | "Edit"
export type Theme = "Light" | "Dark"
export type Ui = {
  isMenuExtended: boolean
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
  /** Per-file saved settings keyed by full file path. Prepared; not yet wired to UI. */
  tabSettingByPath: Record<string, TabSetting>
  setBaseDirectory: (directory: string) => void
  setFileService: (service: FileService) => void
  setMode: (mode: Mode) => void
  setTheme: (theme: Theme) => void
  setTabPath: (path: string) => void
  setTabFontSize: (size: number) => void
  setTabTranspose: (transpose: number) => void
  setTabScrollSpeed: (speed: number) => void
  setTabIsScrolling: (isScrolling: boolean) => void
  setTabSettingByPath: (path: string, tabSetting: TabSetting) => void
  setTabSettings: (tabSettingByPath: Record<string, TabSetting>) => void
  setTabDetails: (details: string) => void
  setTabLink: (link: string) => void
  setServerMode: (serverMode: boolean) => void
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
        setBaseDirectory: (baseDirectory) => set((state) => ({...state, baseDirectory})),
        setFileService: (fileService) => set((state) => ({...state, fileService})),
        setMode: (mode) => set((state) => ({...state, mode})),
        toggleMenu: (isMenuExtended) => set((state) => ({...state, ui: {...state.ui, isMenuExtended}})),
        setTheme: (theme) => set((state) => ({...state, theme})),
        setTabPath: (path) => set((state) => ({...state, tab: {...state.tab, path}})),
        setTabFontSize: (fontSize) => set((state) => ({...state, tab: {...state.tab, fontSize: clampFontSize(fontSize)}})),
        setTabTranspose: (transpose) => set((state) => ({...state, tab: {...state.tab, transpose}})),
        setTabScrollSpeed: (scrollSpeed) => set((state) => ({...state, tab: {...state.tab, scrollSpeed: scrollSpeed}})),
        setTabIsScrolling: (isScrolling) => set((state) => ({...state, tab: {...state.tab, isScrolling}})),
        setTabSettingByPath: (path, tabSetting) => set((state) => ({...state, tabSettingByPath: {...state.tabSettingByPath, [path]: tabSetting}})),
        setTabSettings: (tabSettingByPath) => set((state) => ({...state, tabSettingByPath})),
        setTabDetails: (details) => set((state) => ({...state,tab: {...state.tab, details}})),
        setTabLink: (link) => set( state => ({...state, tab: {...state.tab, link}})),
        setServerMode: (serverMode) => set((state) => ({...state, serverMode})),
      }),
      {
        name: 'klank-storage',
      }
    )
  )
)
