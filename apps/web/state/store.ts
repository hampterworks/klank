import {create} from 'zustand'
import {devtools, persist} from 'zustand/middleware'
import type {} from '@redux-devtools/extension' // required for devtools typing
// import {appLocalDataDir, join} from '@tauri-apps/api/path';

export type Mode = "Read" | "Edit"
export type Theme = "Light" | "Dark"

type KlankState = {
  baseDirectory: string
  tab: {
    path: string
    fontSize: number
    transpose: number
    scrollSpeed: number
    isScrolling: boolean
  }
  mode: Mode
  theme: Theme
  setBaseDirectory: (directory: string) => void
  setMode: (mode: Mode) => void
  setTheme: (theme: Theme) => void
  setTabPath: (path: string) => void
  setTabFontSize: (size: number) => void
  setTabTranspose: (transpose: number) => void
  setTabScrollSpeed: (speed: number) => void
  setTabIsScrolling: (isScrolling: boolean) => void
}

const clampFontSize = (size: number) => {
  if (size < 0) {
    return 0
  } else if (size > 22) {
    return 22
  }
  return size
}

const clampScrollSpeed = (size: number) => {
  if (size < 0) {
    return 0
  } else if (size > 22) {
    return 22
  }
  return size
}

const useKlankStore = create<KlankState>()(
  devtools(
    persist(
      (set) => ({
        baseDirectory: "",
        tab: {
          path: "",
          fontSize: 14,
          transpose: 0,
          scrollSpeed: 1,
          isScrolling: false
        },
        mode: "Read",
        theme: "Light",
        setBaseDirectory: (baseDirectory) => set((state) => ({...state, baseDirectory})),
        setMode: (mode) => set((state) => ({...state, mode})),
        setTheme: (theme) => set((state) => ({...state, theme})),
        setTabPath: (path) => set((state) => ({...state, tab: {...state.tab, path}})),
        setTabFontSize: (fontSize) => set((state) => ({...state, tab: {...state.tab, fontSize: clampFontSize(fontSize)}})),
        setTabTranspose: (transpose) => set((state) => ({...state, tab: {...state.tab, transpose}})),
        setTabScrollSpeed: (scrollSpeed) => set((state) => ({...state, tab: {...state.tab, scrollSpeed: clampScrollSpeed(scrollSpeed)}})),
        setTabIsScrolling: (isScrolling) => set((state) => ({...state, tab: {...state.tab, isScrolling}})),
      }),
      {
        name: 'klank-storage',
      }
    )
  )
)

export default useKlankStore
