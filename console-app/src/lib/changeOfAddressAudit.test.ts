import { describe, expect, it } from 'vitest'
import { auditChangeOfAddressRecord, type ChangeOfAddressRecord, type ReturnCodeDef } from './changeOfAddressAudit'

const returnCodes: ReturnCodeDef[] = [
  { code: '01', label: 'Match - new address', matched: true, newAddressProvided: true, action: 'apply' },
  { code: '03', label: 'No match', matched: false, newAddressProvided: false, action: 'no change' },
]

function record(overrides: Partial<ChangeOfAddressRecord>): ChangeOfAddressRecord {
  return {
    id: 'C1',
    inputRecordId: 'R1',
    firstName: 'Jordan',
    lastName: 'Rivera',
    inputAddress: '1 Main St',
    inputCity: 'Austin',
    inputState: 'TX',
    inputZip: '78701',
    returnCode: '01',
    ...overrides,
  }
}

describe('auditChangeOfAddressRecord', () => {
  it('flags a code that promises a new address but supplies none', () => {
    const findings = auditChangeOfAddressRecord(record({ returnCode: '01', newAddress: undefined }), returnCodes)
    expect(findings.some((f) => f.code === 'PROMISED_NEW_ADDRESS_MISSING' && f.severity === 'error')).toBe(true)
  })

  it('flags a new address returned by a code that does not authorize a change', () => {
    const findings = auditChangeOfAddressRecord(record({ returnCode: '03', newAddress: '99 Somewhere Ave' }), returnCodes)
    expect(findings.some((f) => f.code === 'UNAUTHORIZED_NEW_ADDRESS')).toBe(true)
  })

  it('never crashes on an unrecognized return code, and still renders a finding', () => {
    const findings = auditChangeOfAddressRecord(record({ returnCode: '99' }), returnCodes)
    expect(findings).toEqual([{ code: 'UNRECOGNIZED_RETURN_CODE', severity: 'warning', message: expect.stringContaining('99') }])
  })

  it('flags a future move-effective-date as an error', () => {
    const findings = auditChangeOfAddressRecord(
      record({ newAddress: '99 Somewhere Ave', moveEffectiveDate: '2099-01-01', moveType: 'I' }),
      returnCodes,
      new Date('2026-08-01'),
    )
    expect(findings.some((f) => f.code === 'FUTURE_MOVE_DATE')).toBe(true)
  })

  it('flags a move date outside the 48-month retention window as a warning', () => {
    const findings = auditChangeOfAddressRecord(
      record({ newAddress: '99 Somewhere Ave', moveEffectiveDate: '2015-01-01', moveType: 'I' }),
      returnCodes,
      new Date('2026-08-01'),
    )
    expect(findings.some((f) => f.code === 'OUTSIDE_RETENTION' && f.severity === 'warning')).toBe(true)
  })

  it('has no findings for a clean matched record', () => {
    const findings = auditChangeOfAddressRecord(
      record({ newAddress: '99 Somewhere Ave', moveEffectiveDate: '2026-06-01', moveType: 'I' }),
      returnCodes,
      new Date('2026-08-01'),
    )
    expect(findings).toEqual([])
  })
})
