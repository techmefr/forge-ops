import { describe, expect, it } from 'vitest'
import { gaugesOf } from '@/domain/Resource/MachineGauge'

const SNAPSHOT = {
  cpuPercent: 12.5,
  memoryUsedMb: 24576,
  memoryFreeMb: 8192,
  diskPercent: 75,
  loadAverage: 1.25,
}

describe('gaugesOf', () => {
  it('rend trois jauges, dans l ordre processeur memoire disque', () => {
    expect(gaugesOf(SNAPSHOT).map((gauge) => gauge.nameKey)).toEqual([
      'machine.cpu',
      'machine.ram',
      'machine.disk',
    ])
  })

  it('dit le processeur en pourcentage entier', () => {
    expect(gaugesOf(SNAPSHOT)[0]).toMatchObject({
      said: { key: 'common.percent', values: { value: 13 }, count: null },
      percent: 12.5,
    })
  })

  it('dit la memoire en gigaoctets utilises sur le total', () => {
    expect(gaugesOf(SNAPSHOT)[1]?.said).toEqual({
      key: 'machine.gigabytes',
      values: { used: 24, total: 32 },
      count: null,
    })
  })

  it('tire le pourcentage de memoire de la part utilisee', () => {
    expect(gaugesOf(SNAPSHOT)[1]?.percent).toBe(75)
  })

  it('dit le disque en pourcentage', () => {
    expect(gaugesOf(SNAPSHOT)[2]).toMatchObject({
      said: { key: 'common.percent', values: { value: 75 }, count: null },
      percent: 75,
    })
  })

  it('avoue un tiret quand la machine n a rien rendu', () => {
    expect(
      gaugesOf({ cpuPercent: null, memoryUsedMb: null, memoryFreeMb: null, diskPercent: null, loadAverage: null }).map(
        (gauge) => gauge.said.key,
      ),
    ).toEqual(['common.nothing', 'common.nothing', 'common.nothing'])
  })

  it('ne rend aucune jauge sans lecture', () => {
    expect(gaugesOf(null)).toEqual([])
  })
})
