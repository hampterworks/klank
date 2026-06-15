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

test.describe('Inline panels', () => {
  test('default view shows the sheet player', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await saveScreenshot(page, '05-default-tab-view')
  })

  test('settings panel opens inline replacing the sheet', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Click the settings icon button (aria-label or tooltip)
    const settingsBtn = page.locator('button[aria-pressed]').first()
    await settingsBtn.click()
    await page.waitForTimeout(300)
    await saveScreenshot(page, '06-settings-panel-inline')
    // Verify the settings content is visible
    await expect(page.getByText('General')).toBeVisible()
    // Verify no full-page navigation happened (URL still at /)
    expect(page.url()).toMatch(/\/$|\/index/)
  })

  test('harmony panel opens inline replacing the sheet', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Second aria-pressed button is harmony
    const harmonyBtn = page.locator('button[aria-pressed]').nth(1)
    await harmonyBtn.click()
    await page.waitForTimeout(300)
    await saveScreenshot(page, '07-harmony-panel-inline')
    await expect(page.getByText('Key')).toBeVisible()
    expect(page.url()).toMatch(/\/$|\/index/)
  })

  test('clicking settings icon again closes the panel', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const settingsBtn = page.locator('button[aria-pressed]').first()
    await settingsBtn.click()
    await page.waitForTimeout(200)
    await settingsBtn.click()
    await page.waitForTimeout(200)
    await saveScreenshot(page, '08-panel-closed-back-to-tab')
  })

  test('clicking the logo resets to tab view', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const settingsBtn = page.locator('button[aria-pressed]').first()
    await settingsBtn.click()
    await page.waitForTimeout(200)
    const logoBtn = page.locator('button[aria-label="Back to tab view"]')
    await logoBtn.click()
    await page.waitForTimeout(200)
    await saveScreenshot(page, '09-logo-resets-to-tab')
  })
})
