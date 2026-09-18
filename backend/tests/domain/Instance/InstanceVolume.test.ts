import { describe, expect, it } from 'vitest'
import {
  complaintOf,
  saidAloud,
  startsAnyway,
  type VolumeState,
} from '../../../src/domain/Instance/InstanceVolume.js'

function volume(state: Partial<VolumeState> = {}): VolumeState {
  return { path: '/data', exists: true, writable: true, hasDatabase: true, ...state }
}

describe('an instance that says what it is missing', () => {
  it('is quiet when the volume carries its database', () => {
    expect(complaintOf(volume())).toBeNull()
  })

  it('complains about a volume nobody mounted', () => {
    expect(complaintOf(volume({ exists: false }))).toBe('missingVolume')
  })

  it('complains about a volume it cannot write to', () => {
    expect(complaintOf(volume({ writable: false }))).toBe('unwritableVolume')
  })

  it('says it is starting empty rather than starting silent', () => {
    expect(complaintOf(volume({ hasDatabase: false }))).toBe('emptyDatabase')
  })

  it('refuses to start without a volume, and starts empty when only the base is missing', () => {
    expect(startsAnyway('missingVolume')).toBe(false)
    expect(startsAnyway('unwritableVolume')).toBe(false)
    expect(startsAnyway('emptyDatabase')).toBe(true)
  })

  it('names the volume in what it says', () => {
    expect(saidAloud(volume({ path: '/data' }), 'missingVolume')).toContain('/data')
  })
})
