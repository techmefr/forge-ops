import { writeFileSync } from 'node:fs'

import { clusterCounts, edgeKey, reportOfRoot } from './ImportDirection.js'
import { BASELINE_PATH, LAYER_ROOTS } from './ImportRoot.js'

const shouldWriteBaseline = process.argv.includes('--write-baseline')

const baseline: string[] = []

for (const root of LAYER_ROOTS) {
  const report = reportOfRoot(root)
  process.stdout.write(`\n${root.name}\n`)
  process.stdout.write(`  internal cross-layer imports: ${report.edges.length}\n`)
  process.stdout.write(`  respecting the direction: ${report.respected}\n`)
  process.stdout.write(`  violating technical -> domain: ${report.violations.length}\n`)
  for (const violation of report.violations) {
    process.stdout.write(`    ${edgeKey(violation)}\n`)
    baseline.push(edgeKey(violation))
  }
  const clusters = clusterCounts(report.violations)
  if (clusters.size > 0) {
    process.stdout.write('  clusters:\n')
    for (const [file, count] of clusters) {
      process.stdout.write(`    ${count} ${file}\n`)
    }
  }
}

process.stdout.write(`\ntotal violations: ${baseline.length}\n`)

if (shouldWriteBaseline) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline.sort(), null, 2)}\n`, 'utf8')
  process.stdout.write(`baseline written to ${BASELINE_PATH}\n`)
}
