export const isMobile = (userAgent: string) => {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent)
}
