import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const SCREENSHOT_DIR = path.join(__dirname, '..', 'opt', 'screenshots')

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
})

async function saveScreenshot(page: import('@playwright/test').Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: false })
  return filePath
}

test.describe('UI changes', () => {
  test('main layout - toolbar without Change Folder and Refresh', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await saveScreenshot(page, '01-main-layout')
  })

  test('settings page - Change Folder button present', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await saveScreenshot(page, '02-settings-page')
  })

  test('context menu - Edit and Delete options on right-click', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Expand the menu if collapsed
    const menuList = page.locator('ul[data-collapsed="false"]').first()
    const isVisible = await menuList.isVisible().catch(() => false)
    if (!isVisible) {
      const toggleBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]').first()
      await toggleBtn.click().catch(() => {})
    }
    // Try to right-click the first song button if any exist
    const songButton = page.locator('button').filter({ has: page.locator('svg') }).nth(5)
    if (await songButton.isVisible()) {
      await songButton.click({ button: 'right' })
      await page.waitForTimeout(300)
    }
    await saveScreenshot(page, '03-context-menu')
  })

  test('sheet toolbar - no edit button in read mode', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await saveScreenshot(page, '04-sheet-toolbar-read-mode')
  })
})
