import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const [, , dist = 'dist/web', base = '/forge-ops/'] = process.argv

function tabsOf(name) {
  const source = readFileSync('frontend/src/technical/Router/ScreenTab.ts', 'utf8')
  const list = new RegExp(`${name} = \\[([^\\]]*)\\]`).exec(source)
  return [...(list?.[1] ?? '').matchAll(/'([^']+)'/g)].map((tab) => tab[1])
}

const routes = [
  'projects',
  'me',
  'settings',
  'statistics',
  'connect',
  'login',
  ...tabsOf('PROJECT_TABS').map((tab) => `projects/${tab}`),
  ...tabsOf('PERSONAL_TABS').map((tab) => `me/${tab}`),
]

for (const route of routes) {
  const target = join(dist, route, 'index.html')
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(join(dist, 'index.html'), target)
}

const redirect = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Forge.ops</title>
    <script>
      ;(function () {
        var base = ${JSON.stringify(base)}
        var here = window.location
        var path = here.pathname.indexOf(base) === 0 ? here.pathname.slice(base.length) : here.pathname.replace(/^\\//, '')
        here.replace(base + '?p=' + encodeURIComponent(path + here.search) + here.hash)
      })()
    </script>
  </head>
  <body></body>
</html>
`

writeFileSync(join(dist, '404.html'), redirect)
