/**
 * Decides which directory the app should treat as the tab directory at startup.
 *
 * On mobile there is no folder picker: tabs always live in the app-local data
 * directory, which the platform owns and resolves fresh each launch. A persisted
 * absolute path from a previous launch can't be trusted there — reading it on a
 * relaunch yields an empty file tree (the bug this guards against) — so mobile
 * always prefers the freshly-resolved directory. On desktop the user picks the
 * folder, so a persisted value is authoritative and is never overridden.
 *
 * @param persisted  baseDirectory restored from storage (undefined/'' if unset)
 * @param resolved   the directory returned by `getBaseDirectoryPath()`
 * @param mobile     whether the app is running on a mobile device
 * @returns the directory to use, and whether it differs from `persisted`
 *          (so the caller knows to write it back to the store)
 */
export const resolveBaseDir = (
  persisted: string | undefined,
  resolved: string,
  mobile: boolean,
): { dir: string; changed: boolean } => {
  if (!persisted) return { dir: resolved, changed: true }
  if (mobile && resolved !== persisted) return { dir: resolved, changed: true }
  return { dir: persisted, changed: false }
}

/**
 * Whether the base directory must be (re)resolved from the platform before the
 * file tree can be read: always on mobile (see {@link resolveBaseDir}), and on
 * any platform when it has not been set yet.
 */
export const needsBaseDirResolution = (
  persisted: string | undefined,
  mobile: boolean,
): boolean => !persisted || mobile
