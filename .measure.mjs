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
const res = await page.evaluate(() => {
  const stack = document.querySelector('[data-stack]')
  // marker at an arbitrary 3D point in stack space
  const mk = (x, y, z) => {
    const d = document.createElement('div')
    d.style.cssText = `position:absolute;inset:0;margin:auto;width:6px;height:6px;background:lime;transform:translate3d(${x}px,${y}px,${z}px)`
    stack.appendChild(d)
    const r = d.getBoundingClientRect()
    return { cx: +(r.x + r.width / 2).toFixed(1), cy: +(r.y + r.height / 2).toFixed(1) }
  }
  // Read DOCK constants from a pad/post by reading their transforms is hard; hardcode from source:
  const PLATE_W = 340,
    PLATE_H = 116,
    GAP = 64,
    N = 6
  const zFor = (i) => Math.round((i - (N - 1) / 2) * GAP)
  const PAD = 26
  const BASE = zFor(1) - PAD,
    TOP = zFor(N - 1) + PAD
  const DW = PLATE_W + 46,
    DH = PLATE_H + 40
  // pad top-right corner (top pad at z=TOP)
  const padCornerTopRight = mk(DW / 2, -DH / 2, TOP)
  // post top end for that same corner: post center (DW/2,-DH/2, (BASE+TOP)/2), end at z=TOP
  const postTopEnd = mk(DW / 2, -DH / 2, TOP)
  // also measure the actual rendered post element (corner 0 is top-left in source: {x:-DW/2,y:-DH/2})
  const posts = [...document.querySelectorAll('[data-docker]')].filter(
    (e) => e.style.height && e.style.transform.includes('rotateX'),
  )
  const postRects = posts.map((p) => {
    const r = p.getBoundingClientRect()
    return {
      x: +r.x.toFixed(0),
      y: +r.y.toFixed(0),
      w: +r.width.toFixed(0),
      h: +r.height.toFixed(0),
    }
  })
  return { padCornerTopRight, postTopEnd, BASE, TOP, DW, DH, nPosts: posts.length, postRects }
})
console.log(JSON.stringify(res, null, 1))
await browser.close()
