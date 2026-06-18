import { chromium } from 'playwright-core'

const out = process.argv[2] || '/tmp/techstack.png'
const wait = Number(process.argv[3] || 3500)
const reduce = process.argv[4] === 'reduce'
const width = Number(process.argv[5] || 1440)

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({
  viewport: { width, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: reduce ? 'reduce' : 'no-preference',
})
await page.goto('http://localhost:5174', { waitUntil: 'networkidle' })

try {
  await page.getByRole('button', { name: /Démarrer la visite/i }).click({ timeout: 5000 })
} catch {}
await page.waitForTimeout(1200)

await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(300)
const buttons = page.locator('.debug-panel button')
const count = await buttons.count()
for (let i = 0; i < count; i++) {
  const t = (await buttons.nth(i).innerText()).toLowerCase()
  if (t.includes('stack') || t.includes('technique')) {
    await buttons.nth(i).click()
    break
  }
}
await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(wait)

const card = await page.$('#techstack-diagram')
const box = await card.boundingBox()
await page.screenshot({
  path: out,
  clip: { x: box.x, y: box.y, width: box.width, height: box.height },
})
console.log('saved', out, box)
await browser.close()
