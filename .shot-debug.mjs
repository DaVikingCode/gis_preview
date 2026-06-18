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
// Color every [data-docker] element distinctly + label, hide plates to see the cage
await page.evaluate(() => {
  const cols = [
    'rgba(255,0,0,0.35)',
    'rgba(0,255,0,0.35)',
    'rgba(0,128,255,0.35)',
    'rgba(255,0,255,0.35)',
    'rgba(255,255,0,0.5)',
    'rgba(0,255,255,0.5)',
    'rgba(255,128,0,0.6)',
  ]
  const ds = [...document.querySelectorAll('[data-docker]')]
  ds.forEach((d, i) => {
    d.style.background = cols[i % cols.length]
    d.style.boxShadow = 'inset 0 0 0 1px #fff'
  })
  document.querySelectorAll('[data-layer]').forEach((l) => (l.style.opacity = '0.12'))
})
await page.waitForTimeout(300)
const card = await page.$('#techstack-diagram')
const box = await card.boundingBox()
await page.screenshot({
  path: '/tmp/ts-debug.png',
  clip: {
    x: box.x + box.width * 0.26,
    y: box.y + box.height * 0.12,
    width: box.width * 0.5,
    height: box.height * 0.52,
  },
})
console.log('saved', (ds) => 0)
await browser.close()
