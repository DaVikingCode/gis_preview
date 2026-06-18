import { chromium } from 'playwright-core'
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 3,
})
await page.goto('http://localhost:5174', { waitUntil: 'networkidle' })
try {
  await page.getByRole('button', { name: /Démarrer la visite/i }).click({ timeout: 5000 })
} catch {}
await page.waitForTimeout(1000)
await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(200)
const b = page.locator('.debug-panel button')
const n = await b.count()
for (let i = 0; i < n; i++) {
  const t = (await b.nth(i).innerText()).toLowerCase()
  if (t.includes('stack') || t.includes('technique')) {
    await b.nth(i).click()
    break
  }
}
await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(4000)
// rotate the stack a little via drag so the side faces are clearly visible
const scene = await page.$('[data-scene]')
const sb = await scene.boundingBox()
await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
await page.mouse.down()
for (let i = 1; i <= 8; i++)
  await page.mouse.move(sb.x + sb.width / 2 - i * 6, sb.y + sb.height / 2 - i * 1)
await page.mouse.up()
await page.waitForTimeout(500)
const card = await page.$('#techstack-diagram')
const box = await card.boundingBox()
await page.screenshot({
  path: '/tmp/ts-box.png',
  clip: {
    x: box.x + box.width * 0.3,
    y: box.y + box.height * 0.14,
    width: box.width * 0.46,
    height: box.height * 0.46,
  },
})
console.log('saved')
await browser.close()
