import { chromium } from 'playwright-core'
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
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
await page.evaluate(() => {
  const cols = [
    '#e6194b',
    '#3cb44b',
    '#4363d8',
    '#f032e6',
    '#ffe119',
    '#42d4f4',
    '#f58231',
    '#911eb4',
    '#bfef45',
    '#fabed4',
  ]
  const ds = [...document.querySelectorAll('[data-docker]')]
  ds.forEach((d, i) => {
    d.style.background = cols[i % cols.length]
    d.style.opacity = '0.92'
    d.style.boxShadow = 'inset 0 0 0 2px #000'
  })
  document.querySelectorAll('[data-layer]').forEach((l) => (l.style.visibility = 'hidden'))
  document.querySelector('[data-graticule]').style.visibility = 'hidden'
})
await page.waitForTimeout(300)
const card = await page.$('#techstack-diagram')
const box = await card.boundingBox()
await page.screenshot({
  path: '/tmp/ts-debug2.png',
  clip: {
    x: box.x + box.width * 0.24,
    y: box.y + box.height * 0.1,
    width: box.width * 0.54,
    height: box.height * 0.56,
  },
})
console.log('saved')
await browser.close()
