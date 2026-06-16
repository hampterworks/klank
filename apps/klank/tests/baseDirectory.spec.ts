import { describe, expect, it } from 'vitest'
import { needsBaseDirResolution, resolveBaseDir } from '../app/baseDirectory'

const MOBILE = true
const DESKTOP = false

describe('needsBaseDirResolution', () => {
  it('always resolves when no directory is persisted', () => {
    expect(needsBaseDirResolution(undefined, DESKTOP)).toBe(true)
    expect(needsBaseDirResolution('', MOBILE)).toBe(true)
  })

  it('always resolves on mobile, even with a persisted directory', () => {
    expect(needsBaseDirResolution('/data/app/files', MOBILE)).toBe(true)
  })

  it('does not resolve on desktop when a directory is already persisted', () => {
    expect(needsBaseDirResolution('/home/user/tabs', DESKTOP)).toBe(false)
  })
})

describe('resolveBaseDir', () => {
  it('uses the resolved dir when nothing is persisted (any platform)', () => {
    expect(resolveBaseDir(undefined, '/data/app/files', MOBILE)).toEqual({
      dir: '/data/app/files',
      changed: true,
    })
    expect(resolveBaseDir('', '/home/user/tabs', DESKTOP)).toEqual({
      dir: '/home/user/tabs',
      changed: true,
    })
  })

  // The regression: on a mobile relaunch the persisted path differs from the
  // freshly-resolved app-local data dir, which previously left the tree empty.
  it('prefers the freshly-resolved dir on mobile when it differs from persisted', () => {
    expect(resolveBaseDir('/stale/old/files', '/data/app/files', MOBILE)).toEqual({
      dir: '/data/app/files',
      changed: true,
    })
  })

  it('reports no change on mobile when persisted already matches the resolved dir', () => {
    expect(resolveBaseDir('/data/app/files', '/data/app/files', MOBILE)).toEqual({
      dir: '/data/app/files',
      changed: false,
    })
  })

  it('never overrides a user-chosen desktop folder', () => {
    expect(resolveBaseDir('/home/user/tabs', '/home/user/.local/share/klank', DESKTOP)).toEqual({
      dir: '/home/user/tabs',
      changed: false,
    })
  })
})
