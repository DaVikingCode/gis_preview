import { chromium } from 'playwright-core'
const out = process.argv[2] || '/tmp/ts.png'
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
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
const card = await page.$('#techstack-diagram')
const box = await card.boundingBox()
const clip = {
  x: box.x + box.width * 0.28,
  y: box.y + box.height * 0.1,
  width: box.width * 0.46,
  height: box.height * 0.58,
}
await page.screenshot({ path: out, clip })
console.log('saved', out)
await browser.close()
