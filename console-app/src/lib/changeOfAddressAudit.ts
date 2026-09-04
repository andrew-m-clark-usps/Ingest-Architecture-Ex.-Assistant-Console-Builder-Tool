// See ../../Console.md section 6.2 (change-of-address return-code audit).

export type MoveType = 'I' | 'F' | 'B' // Individual / Family / Business

export interface ReturnCodeDef {
  code: string
  label: string
  matched: boolean
  newAddressProvided: boolean
  action: string
}

export interface ChangeOfAddressRecord {
  id: string
  inputRecordId: string
  firstName: string
  lastName: string
  company?: string
  inputAddress: string
  inputCity: string
  inputState: string
  inputZip: string
  newAddress?: string
  newCity?: string
  newState?: string
  newZip?: string
  moveEffectiveDate?: string
  moveType?: MoveType
  returnCode: string
}

export interface AuditFinding {
  code: string
  severity: 'error' | 'warning'
  message: string
}

const RETENTION_MONTHS = 48

function monthsBetween(from: string, to: Date): number {
  const d = new Date(from)
  if (Number.isNaN(d.getTime())) return NaN
  return (to.getFullYear() - d.getFullYear()) * 12 + (to.getMonth() - d.getMonth())
}

// An unrecognized code must still render a row, never crash -- callers
// should treat a missing return-code definition as "unrecognized", not a
// thrown error.
export function auditChangeOfAddressRecord(
  record: ChangeOfAddressRecord,
  returnCodes: ReturnCodeDef[],
  now: Date = new Date(),
): AuditFinding[] {
  const findings: AuditFinding[] = []
  const def = returnCodes.find((r) => r.code === record.returnCode)

  if (!def) {
    findings.push({ code: 'UNRECOGNIZED_RETURN_CODE', severity: 'warning', message: `Return code "${record.returnCode}" is not in the reference table` })
    return findings
  }

  if (def.newAddressProvided && !record.newAddress) {
    findings.push({ code: 'PROMISED_NEW_ADDRESS_MISSING', severity: 'error', message: `Code ${def.code} promises a new address but none was supplied` })
  }
  if (!def.matched && record.newAddress) {
    findings.push({ code: 'UNAUTHORIZED_NEW_ADDRESS', severity: 'warning', message: `Code ${def.code} does not authorize a change but a new address was returned -- do not apply it` })
  }
  if (def.matched && !record.moveEffectiveDate) {
    findings.push({ code: 'NO_MOVE_DATE', severity: 'warning', message: 'Match with no move-effective-date' })
  }
  if (record.moveEffectiveDate) {
    const age = monthsBetween(record.moveEffectiveDate, now)
    if (!Number.isNaN(age)) {
      if (age > RETENTION_MONTHS) {
        findings.push({ code: 'OUTSIDE_RETENTION', severity: 'warning', message: `Move date is outside the ${RETENTION_MONTHS}-month retention window` })
      }
      if (age < 0) {
        findings.push({ code: 'FUTURE_MOVE_DATE', severity: 'error', message: 'Move-effective-date is in the future' })
      }
    }
  }
  if (def.matched && !record.moveType) {
    findings.push({ code: 'NO_MOVE_TYPE', severity: 'warning', message: 'Match with no move type' })
  }

  return findings
}
