import { chromium } from 'playwright-core'

const match = process.argv[2] || 'écosystème'
const out = process.argv[3] || `/tmp/shot.png`

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })

try {
  await page.getByRole('button', { name: /Démarrer la visite/i }).click({ timeout: 5000 })
} catch {}
await page.waitForTimeout(1500)

await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(300)
const buttons = page.locator('.debug-panel button')
const count = await buttons.count()
for (let i = 0; i < count; i++) {
  const t = (await buttons.nth(i).innerText()).toLowerCase()
  if (t.includes(match.toLowerCase())) {
    await buttons.nth(i).click()
    break
  }
}
await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(4500)
// Crop to the upper-centre of the diagram to inspect the graticule + spokes.
const card = await page.$('#ecosystem-diagram')
const box = await card.boundingBox()
await page.screenshot({
  path: out,
  clip: {
    x: box.x + box.width * 0.28,
    y: box.y + box.height * 0.18,
    width: box.width * 0.44,
    height: box.height * 0.42,
  },
})
console.log('saved', out)
await browser.close()
