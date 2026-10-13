import { chromium } from 'playwright-core'
const browser = await chromium.launch()
for (const [w, h, tag] of [[375, 812, 'm'], [1000, 700, 't']] as const) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', colorScheme: 'dark' })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/projects/subjects')
  await page.waitForTimeout(2500)
  for (const name of ['Passer', 'Skip']) { const b = page.locator('button', { hasText: new RegExp(`^${name}$`) }); if ((await b.count()) > 0) await b.first().click() }
  await page.screenshot({ path: `/tmp/n-${tag}.png` })
  const tabs = await page.$$eval('nav a, [role="tablist"] a, header a', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${(e.textContent ?? '').trim()}@${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(e).pointerEvents}` }))
  console.log(tag, tabs.join(' | '))
  await context.close()
}
await browser.close()
