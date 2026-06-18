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
const info = await page.evaluate(() => {
  const describe = (el) =>
    el
      ? `${el.tagName}.${(el.className || '').toString().slice(0, 40)}${el.dataset?.scene !== undefined ? '[data-scene]' : ''}${el.dataset?.layer !== undefined ? '[data-layer]' : ''} pe=${getComputedStyle(el).pointerEvents}`
      : 'null'
  const pts = [
    [720, 420],
    [720, 530],
    [720, 640],
    [700, 300],
  ]
  const out = {}
  for (const [x, y] of pts) {
    const el = document.elementFromPoint(x, y)
    const chain = []
    let p = el
    for (let i = 0; i < 6 && p; i++) {
      chain.push(describe(p))
      p = p.parentElement
    }
    out[`${x},${y}`] = chain
  }
  const scene = document.querySelector('[data-scene]')
  out.sceneRect = scene?.getBoundingClientRect()
  out.scenePE = scene ? getComputedStyle(scene).pointerEvents : 'no-scene'
  out.card = (() => {
    const c = document.querySelector('#techstack-diagram')
    return c ? getComputedStyle(c).pointerEvents : 'no-card'
  })()
  return out
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
