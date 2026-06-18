import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5174', { waitUntil: 'networkidle' })
try {
  await page.getByRole('button', { name: /Démarrer la visite/i }).click({ timeout: 5000 })
} catch {}
await page.waitForTimeout(1000)
await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(200)
const buttons = page.locator('.debug-panel button')
const n = await buttons.count()
for (let i = 0; i < n; i++) {
  const t = (await buttons.nth(i).innerText()).toLowerCase()
  if (t.includes('stack') || t.includes('technique')) {
    await buttons.nth(i).click()
    break
  }
}
await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(3500)

const before = await page.evaluate(() => {
  const c = window.__gpMap?.getCenter?.()
  const tilt = document.querySelector('[data-tilt]')
  const scene = document.querySelector('[data-scene]')
  return {
    center: c && [c.lng, c.lat],
    tilt: tilt?.style.transform || getComputedStyle(tilt).transform,
    sceneRect: scene?.getBoundingClientRect(),
  }
})
console.log('BEFORE', JSON.stringify(before))

// Drag across the centre of the scene.
const r = before.sceneRect
const cx = r.x + r.width / 2
const cy = r.y + r.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 12, cy + i * 2)
await page.mouse.up()
await page.waitForTimeout(600)

const after = await page.evaluate(() => {
  const c = window.__gpMap?.getCenter?.()
  const tilt = document.querySelector('[data-tilt]')
  return {
    center: c && [c.lng, c.lat],
    tilt: tilt?.style.transform || getComputedStyle(tilt).transform,
  }
})
console.log('AFTER ', JSON.stringify(after))
console.log('hasGpMap', !!(await page.evaluate(() => !!window.__gpMap)))
await browser.close()
