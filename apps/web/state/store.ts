import {create} from 'zustand'
import {devtools, persist} from 'zustand/middleware'
import type {} from '@redux-devtools/extension' // required for devtools typing

export type Mode = "Read" | "Edit"
export type Theme = "Light" | "Dark"
export type TabSetting = {
  path: string
  fontSize: number
  transpose: number
  scrollSpeed: number
  details: string
  isScrolling: boolean
  link?: string
}

type KlankState = {
  baseDirectory?: string
  tab: TabSetting
  mode: Mode
  theme: Theme
  streamerSongListEnabled: boolean
  streamerSongListUser: string
  tabSettingByPath: Record<string, TabSetting>
  setBaseDirectory: (directory: string) => void
  setMode: (mode: Mode) => void
  setTheme: (theme: Theme) => void
  setTabPath: (path: string) => void
  setStreamerSongListUser: (user: string) => void
  setTabFontSize: (size: number) => void
  setTabTranspose: (transpose: number) => void
  setTabScrollSpeed: (speed: number) => void
  incrementScrollSpeed: () => void
  decrementScrollSpeed: () => void
  setTabIsScrolling: (isScrolling: boolean) => void
  setStreamerSongListToggle: (streamerSongListEnabled: boolean) => void
  setTabSettingByPath: (path: string, tabSetting: TabSetting) => void
  setTabSettings: (tabSettingByPath: Record<string, TabSetting>) => void
  setTabDetails: (details: string) => void
  setTabLink: (link: string) => void
}

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

const clampScrollSpeed = (size: number) => {
  if (size < 0) {
    return 0
  } else if (size >= SCROLL_SPEEDS.length) {
    return SCROLL_SPEEDS.length
  }
  return size
}

const useKlankStore = create<KlankState>()(
  devtools(
    persist(
      (set) => ({
        streamerSongListEnabled: false,
        streamerSongListUser: "",
        tab: {
          path: "",
          fontSize: 14,
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
        setMode: (mode) => set((state) => ({...state, mode})),
        setStreamerSongListToggle: (streamerSongListEnabled) => set((state) => ({...state, streamerSongListEnabled})),
        setTheme: (theme) => set((state) => ({...state, theme})),
        setTabPath: (path) => set((state) => ({...state, tab: {...state.tab, path}})),
        setStreamerSongListUser: (user) => set((state) => ({...state, streamerSongListUser: user})),
        setTabFontSize: (fontSize) => set((state) => ({...state, tab: {...state.tab, fontSize: clampFontSize(fontSize)}})),
        setTabTranspose: (transpose) => set((state) => ({...state, tab: {...state.tab, transpose}})),
        setTabScrollSpeed: (scrollSpeed) => set((state) => ({...state, tab: {...state.tab, scrollSpeed: clampScrollSpeed(scrollSpeed)}})),
        incrementScrollSpeed: () => set((state) => ({...state, tab: {...state.tab, scrollSpeed: clampScrollSpeed(state.tab.scrollSpeed + 1)}})),
        decrementScrollSpeed: () => set((state) => ({...state, tab: {...state.tab, scrollSpeed: clampScrollSpeed(state.tab.scrollSpeed - 1)}})),
        setTabIsScrolling: (isScrolling) => set((state) => ({...state, tab: {...state.tab, isScrolling}})),
        setTabSettingByPath: (path, tabSetting) => set((state) => ({...state, tabSettingByPath: {...state.tabSettingByPath, [path]: tabSetting}})),
        setTabSettings: (tabSettingByPath) => set((state) => ({...state, tabSettingByPath})),
        setTabDetails: (details) => set((state) => ({...state,tab: {...state.tab, details}})),
        setTabLink: (link) => set( state => ({...state, tab: {...state.tab, link}})),
      }),
      {
        name: 'klank-storage',

      }
    )
  )
)

export default useKlankStore
