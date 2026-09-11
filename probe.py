import pathlib
p = pathlib.Path('/home/gaetan/starfleet/frontend/src/domain/Resource/MachineBadge.vue')
t = p.read_text(encoding='utf-8')
t = t.replace("""import { gaugesOf, type MachineSnapshot } from './MachineGauge'""",
"""import { gaugesOf, type MachineSnapshot } from './MachineGauge'
import Glyph from '@/technical/Ui/Glyph.vue'""", 1)
t = t.replace("""      <span class="font-mono text-[9.5px] tracking-[0.14em] text-txt-low uppercase">{{ gauge.name }}</span>""",
"""      <span class="flex items-center gap-1 font-mono text-[9.5px] tracking-[0.14em] text-txt-low uppercase">
        <Glyph :name="gauge.glyph" :size="13" />
        {{ gauge.name }}
      </span>""", 1)
p.write_text(t, encoding='utf-8')

g = pathlib.Path('/home/gaetan/starfleet/frontend/src/domain/Resource/MachineGauge.ts')
s = g.read_text(encoding='utf-8')
s = s.replace("""export type MachineGauge = {
  name: string
  said: string
  percent: number | null
}""", """export type MachineGauge = {
  name: string
  glyph: string
  said: string
  percent: number | null
}""", 1)
s = s.replace("""function percentGauge(name: string, percent: number | null): MachineGauge {
  return {
    name,""", """function percentGauge(name: string, glyph: string, percent: number | null): MachineGauge {
  return {
    name,
    glyph,""", 1)
s = s.replace("""    return { name: 'RAM', said: NOTHING, percent: null }""",
              """    return { name: 'RAM', glyph: 'ram', said: NOTHING, percent: null }""", 1)
s = s.replace("""  return {
    name: 'RAM',
    said:""", """  return {
    name: 'RAM',
    glyph: 'ram',
    said:""", 1)
s = s.replace("""    percentGauge('CPU', snapshot.cpuPercent),
    memoryGauge(snapshot),
    percentGauge('DISQUE', snapshot.diskPercent),""",
"""    percentGauge('CPU', 'cpu', snapshot.cpuPercent),
    memoryGauge(snapshot),
    percentGauge('DISQUE', 'disk', snapshot.diskPercent),""", 1)
g.write_text(s, encoding='utf-8')
print('ok')
