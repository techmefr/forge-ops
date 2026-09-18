import { describe, expect, it } from 'vitest'
import {
  SHIPPED_TEMPLATE,
  TEMPLATE_STAGES,
  fromJsonl,
  refusalOf,
  toJsonl,
} from '../../../src/domain/Template/Template.js'
import type { TemplateColumn } from '../../../src/domain/Template/Template.js'

const COLUMNS = SHIPPED_TEMPLATE.columns

function without(stage: string): readonly TemplateColumn[] {
  return COLUMNS.filter((column) => column.state !== stage)
}

describe('refusalOf', () => {
  it('accepte le modele livre avec l outil', () => {
    expect(refusalOf(COLUMNS)).toBeNull()
  })

  it('refuse un modele qui perd une etape, une colonne ne supprime pas une preuve', () => {
    expect(refusalOf(without('gating'))).toEqual({ reason: 'MissingStage', stage: 'gating' })
  })

  it('refuse une etape inconnue, le tableau ne s invente pas des etats', () => {
    expect(refusalOf([...COLUMNS, { ...COLUMNS[0]!, state: 'sieste' as never }])).toEqual({
      reason: 'UnknownStage',
      stage: 'sieste',
    })
  })

  it('refuse deux colonnes pour la meme etape', () => {
    expect(refusalOf([...COLUMNS, COLUMNS[0]!])).toEqual({
      reason: 'RepeatedStage',
      stage: COLUMNS[0]!.state,
    })
  })

  it('refuse une colonne sans nom', () => {
    const blank = COLUMNS.map((column) =>
      column.state === 'building' ? { ...column, label: '  ' } : column,
    )

    expect(refusalOf(blank)).toEqual({ reason: 'EmptyLabel', stage: 'building' })
  })

  it('refuse un delai negatif', () => {
    const wrong = COLUMNS.map((column) =>
      column.state === 'building' ? { ...column, delayHours: -2 } : column,
    )

    expect(refusalOf(wrong)).toEqual({ reason: 'NegativeDelay', stage: 'building' })
  })

  it('laisse renommer, recolorer et reordonner, c est ce qu un modele decide', () => {
    const rewritten = [...COLUMNS]
      .reverse()
      .map((column) => ({ ...column, label: `Etape ${column.state}`, colour: 'violet' }))

    expect(refusalOf(rewritten)).toBeNull()
  })

  it('laisse nommer l agent, son prompt et son delai', () => {
    const staffed = COLUMNS.map((column) => ({
      ...column,
      agent: 'elrond',
      prompt: 'ouvre la story et lis sa spec',
      delayHours: 24,
    }))

    expect(refusalOf(staffed)).toBeNull()
  })
})

describe('les etapes du modele', () => {
  it('couvrent exactement les colonnes du tableau', () => {
    expect([...TEMPLATE_STAGES].sort()).toEqual([...COLUMNS.map((one) => one.state)].sort())
  })
})

describe('le voyage en jsonl', () => {
  const template = { id: 1, version: 3, ...SHIPPED_TEMPLATE }

  it('ecrit un enregistrement par ligne, l entete puis les colonnes', () => {
    const lines = toJsonl(template).split('\n')

    expect(lines).toHaveLength(COLUMNS.length + 1)
    expect(JSON.parse(lines[0] ?? '{}').record).toBe('template')
    expect(JSON.parse(lines[1] ?? '{}').record).toBe('column')
  })

  it('se relit tel qu il a ete ecrit', () => {
    const read = fromJsonl(toJsonl(template))

    expect(read.draft?.slug).toBe(template.slug)
    expect(read.draft?.columns).toEqual(COLUMNS)
  })

  it('refuse un fichier sans entete, on ne devine pas le nom d un modele', () => {
    const headless = toJsonl(template).split('\n').slice(1).join('\n')

    expect(fromJsonl(headless)).toEqual({ refusal: 'NoHeader' })
  })

  it('refuse une ligne qui n est pas du json', () => {
    expect(fromJsonl('{"record":"template"}\nnawak')).toEqual({ refusal: 'MalformedLine' })
  })

  it('refuse un fichier auquel il manque une etape', () => {
    const cut = toJsonl({ ...template, columns: without('shipping') })

    expect(fromJsonl(cut)).toEqual({ refusal: { reason: 'MissingStage', stage: 'shipping' } })
  })

  it('ignore les lignes vides, un fichier voyage mal', () => {
    const spaced = toJsonl(template).split('\n').join('\n\n')

    expect(fromJsonl(spaced).refusal).toBeUndefined()
  })
})
