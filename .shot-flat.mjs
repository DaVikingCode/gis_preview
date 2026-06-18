import { chromium } from 'playwright-core'
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
await page.waitForTimeout(3500)
// Flatten: kill rotation so we see the box face-on (Z becomes screen depth-> we tilt slightly to read it)
await page.evaluate(() => {
  const s = document.querySelector('[data-stack]')
  s.style.transform = 'rotateX(8deg) rotateZ(0deg)'
  const f = document.querySelector('[data-float]')
  f.style.transform = 'scale(0.9)'
  const t = document.querySelector('[data-tilt]')
  t.style.transform = 'none'
})
await page.waitForTimeout(400)
const card = await page.$('#techstack-diagram')
const box = await card.boundingBox()
await page.screenshot({
  path: '/tmp/ts-flat.png',
  clip: {
    x: box.x + box.width * 0.22,
    y: box.y + box.height * 0.08,
    width: box.width * 0.56,
    height: box.height * 0.6,
  },
})
console.log('saved')
await browser.close()
