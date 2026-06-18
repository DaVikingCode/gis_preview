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
const nn = await buttons.count()
for (let i = 0; i < nn; i++) {
  const t = (await buttons.nth(i).innerText()).toLowerCase()
  if (t.includes('stack') || t.includes('technique')) {
    await buttons.nth(i).click()
    break
  }
}
await page.locator('.debug-panel button').first().click()
await page.waitForTimeout(3000)
const r = await page.evaluate(() => {
  const card = document.querySelector('#techstack-diagram')
  const root = card?.parentElement
  const scene = document.querySelector('[data-scene]')
  const rep = (el) =>
    el && { cls: el.className?.toString?.().slice(0, 140), pe: getComputedStyle(el).pointerEvents }
  return {
    root: rep(root),
    card: rep(card),
    scene: rep(scene),
    cardZ: card && getComputedStyle(card).zIndex,
  }
})
console.log(JSON.stringify(r, null, 1))
await browser.close()
