import { test } from '@playwright/test'
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

test.describe('Mobile viewport: Inline panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('default mobile view', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await saveScreenshot(page, 'mobile-01-default')
  })

  test('settings panel opens inline on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const settingsBtn = page.locator('button[aria-pressed]').first()
    await settingsBtn.click()
    await page.waitForTimeout(400)
    await saveScreenshot(page, 'mobile-02-settings')
  })

  test('harmony panel opens inline on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const settingsBtn = page.locator('button[aria-pressed]').first()
    await settingsBtn.click()
    await page.waitForTimeout(200)
    const harmonyBtn = page.locator('button[aria-pressed]').nth(1)
    await harmonyBtn.click()
    await page.waitForTimeout(400)
    await saveScreenshot(page, 'mobile-03-harmony')
  })
})
