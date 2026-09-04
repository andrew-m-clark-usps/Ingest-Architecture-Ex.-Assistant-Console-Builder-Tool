import { describe, expect, it } from 'vitest'
import { meterUsageEvents, computeInvoice, computeDailyAccrual, mergeUsageEvents, type IpAgreement, type UsageEvent } from './usageMetering'

const activeTransactionAgreement: IpAgreement = {
  id: 'AGMT-1',
  customerName: 'Acme',
  crid: 'CRID-1',
  epaAccount: 'EPS-1',
  partyType: 'Auditor',
  feeModel: 'transaction',
  unitRate: 0.05,
  monthlyFee: 0,
  authorizedMids: [],
  status: 'Active',
  effectiveDate: '2026-04-01',
}

function evt(overrides: Partial<UsageEvent> & Pick<UsageEvent, 'id' | 'date' | 'channel' | 'trackingNumber'>): UsageEvent {
  return { agreementId: 'AGMT-1', crid: 'CRID-1', packageCount: 1, succeeded: true, ...overrides }
}

describe('meterUsageEvents', () => {
  it('meters a Tracking API event by package count', () => {
    const [metered] = meterUsageEvents([evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1', packageCount: 10 })], [activeTransactionAgreement])
    expect(metered.billable).toBe(true)
    expect(metered.billableUnits).toBe(10)
    expect(metered.charge).toBeCloseTo(0.5)
  })

  it('meters a webhook event only once for the same tracking number, across the FULL history', () => {
    const events = [
      evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking Webhook', trackingNumber: 'TN-SAME' }),
      evt({ id: 'E2', date: '2026-05-02', channel: 'Tracking Webhook', trackingNumber: 'TN-SAME' }),
      evt({ id: 'E3', date: '2026-06-15', channel: 'Tracking Webhook', trackingNumber: 'TN-SAME' }),
    ]
    const metered = meterUsageEvents(events, [activeTransactionAgreement])
    const billable = metered.filter((m) => m.billable)
    expect(billable).toHaveLength(1)
    expect(billable[0].id).toBe('E1')
    expect(metered.find((m) => m.id === 'E3')?.reason).toBe('already charged for this tracking number')
  })

  it('does not double-charge across a month boundary -- dedupe is recomputed over the whole set, not per month', () => {
    const events = [
      evt({ id: 'E1', date: '2026-04-30', channel: 'Scan Event Extract', trackingNumber: 'TN-X' }),
      evt({ id: 'E2', date: '2026-05-01', channel: 'Scan Event Extract', trackingNumber: 'TN-X' }),
    ]
    const metered = meterUsageEvents(events, [activeTransactionAgreement])
    expect(metered.filter((m) => m.billable)).toHaveLength(1)
  })

  it('does not meter a failed call', () => {
    const [metered] = meterUsageEvents([evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1', succeeded: false })], [activeTransactionAgreement])
    expect(metered.billable).toBe(false)
    expect(metered.reason).toBe('call failed')
  })

  it('does not meter an event before the access-controls effective date', () => {
    const [metered] = meterUsageEvents([evt({ id: 'E1', date: '2026-03-15', channel: 'Tracking API', trackingNumber: 'T1' })], [activeTransactionAgreement])
    expect(metered.billable).toBe(false)
    expect(metered.reason).toContain('effective date')
  })

  it('does not meter a no-cost party type even if otherwise eligible', () => {
    const shipperAgreement: IpAgreement = { ...activeTransactionAgreement, partyType: 'Shipper' }
    const [metered] = meterUsageEvents([evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1' })], [shipperAgreement])
    expect(metered.billable).toBe(false)
    expect(metered.reason).toContain('no-cost party type')
  })

  it('does not meter when the agreement is not Active', () => {
    const suspended: IpAgreement = { ...activeTransactionAgreement, status: 'Suspended' }
    const [metered] = meterUsageEvents([evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1' })], [suspended])
    expect(metered.billable).toBe(false)
    expect(metered.reason).toContain('not Active')
  })

  it('does not meter an event with no agreement on file', () => {
    const [metered] = meterUsageEvents([evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1', agreementId: undefined })], [activeTransactionAgreement])
    expect(metered.billable).toBe(false)
    expect(metered.reason).toBe('no IP agreement on file')
  })
})

describe('computeInvoice', () => {
  it('charges a flat monthly fee once for an unlimited agreement used that month', () => {
    const unlimited: IpAgreement = { ...activeTransactionAgreement, feeModel: 'unlimited', monthlyFee: 300 }
    const events = [
      evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking Webhook', trackingNumber: 'TN-1' }),
      evt({ id: 'E2', date: '2026-05-15', channel: 'Tracking Webhook', trackingNumber: 'TN-2' }),
    ]
    const metered = meterUsageEvents(events, [unlimited])
    const invoices = computeInvoice(metered, [unlimited], '2026-05')
    expect(invoices).toEqual([
      { agreementId: unlimited.id, customerName: unlimited.customerName, feeModel: 'unlimited', transactionCharges: 0, flatFeeCharged: 300, totalCharge: 300, billableUnits: 2, lineItem: 'Tracking Data Usage Fee' },
    ])
  })

  it('sums per-unit charges for a transaction agreement', () => {
    const events = [evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1', packageCount: 20 })]
    const metered = meterUsageEvents(events, [activeTransactionAgreement])
    const invoices = computeInvoice(metered, [activeTransactionAgreement], '2026-05')
    expect(invoices[0].transactionCharges).toBeCloseTo(1)
    expect(invoices[0].totalCharge).toBeCloseTo(1)
  })
})

describe('computeDailyAccrual', () => {
  it('includes only transaction-model charges, never a flat unlimited fee', () => {
    const unlimited: IpAgreement = { ...activeTransactionAgreement, id: 'AGMT-U', feeModel: 'unlimited', monthlyFee: 300 }
    const events = [
      evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1', packageCount: 10 }),
      evt({ id: 'E2', date: '2026-05-01', channel: 'Tracking Webhook', trackingNumber: 'T2', agreementId: 'AGMT-U' }),
    ]
    const metered = meterUsageEvents(events, [activeTransactionAgreement, unlimited])
    const daily = computeDailyAccrual(metered, [activeTransactionAgreement, unlimited])
    expect(daily).toEqual([{ date: '2026-05-01', charge: 0.5 }])
  })
})

describe('mergeUsageEvents', () => {
  it('replaces by event ID instead of appending, so repeated loads do not double-count', () => {
    const existing = [evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1', packageCount: 5 })]
    const incoming = [evt({ id: 'E1', date: '2026-05-01', channel: 'Tracking API', trackingNumber: 'T1', packageCount: 999 })]
    const merged = mergeUsageEvents(existing, incoming)
    expect(merged).toHaveLength(1)
    expect(merged[0].packageCount).toBe(999)
  })
})
