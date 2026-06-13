export const isMobile = (userAgent: string) => {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent)
}

/**
 * Whether the app is running on a mobile device (Android/iOS). Used to hide
 * desktop-only affordances such as the native folder picker. Safe during SSR
 * (`navigator` may be undefined), where it returns false.
 */
export const isMobileDevice = (): boolean => {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator
  return typeof nav?.userAgent === 'string' && isMobile(nav.userAgent)
}
