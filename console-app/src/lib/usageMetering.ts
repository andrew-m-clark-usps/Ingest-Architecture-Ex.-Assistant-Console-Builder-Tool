// See ../../Console.md section 4.3/6.6. Usage metering domain core --
// built and unit-tested before wiring the Usage page.

export type Channel = 'Tracking API' | 'Tracking Webhook' | 'Scan Event Extract'

export type PartyType =
  | 'Shipper'
  | 'Platform'
  | 'Label Provider'
  | 'Consolidator'
  | 'Service Provider'
  | 'Auditor'
  | 'Software Vendor'
  | 'Tracking Analytics Vendor'
  | 'Public Tracking Website'
  | 'Consumer Business'

export type AgreementStatus = 'Active' | 'Pending' | 'Suspended'
export type FeeModel = 'unlimited' | 'transaction'

export interface IpAgreement {
  id: string
  customerName: string
  crid: string
  epaAccount: string
  partyType: PartyType
  feeModel: FeeModel
  unitRate: number
  monthlyFee: number
  authorizedMids: string[] // empty = unlimited
  status: AgreementStatus
  effectiveDate: string
}

export interface UsageEvent {
  id: string
  date: string // ISO yyyy-mm-dd
  channel: Channel
  agreementId?: string
  crid: string
  mid?: string
  packageCount: number
  trackingNumber: string
  succeeded: boolean
}

export interface MeteredEvent extends UsageEvent {
  billableUnits: number
  charge: number
  billable: boolean
  reason: string
}

// Who pays is a property of the PARTY, not the channel.
const NO_COST_PARTY_TYPES = new Set<PartyType>([
  'Shipper',
  'Platform',
  'Label Provider',
  'Consolidator',
  'Service Provider',
])

// Access-controls effective date -- events before this never meter,
// regardless of agreement state.
const ACCESS_CONTROLS_EFFECTIVE_DATE = '2026-04-01'

export const CHARGE_LINE_ITEM = 'Tracking Data Usage Fee'

// Ingestion must be idempotent -- replace by event ID, never append, so
// repeated loads of overlapping exports don't double-count.
export function mergeUsageEvents(existing: UsageEvent[], incoming: UsageEvent[]): UsageEvent[] {
  const byId = new Map(existing.map((e) => [e.id, e]))
  for (const e of incoming) byId.set(e.id, e)
  return [...byId.values()]
}

// Dedupe of a tracking number's "first event" spans the ENTIRE loaded
// history, not the current month or dataset window -- recomputed over
// the full set, in date order, every run.
export function meterUsageEvents(events: UsageEvent[], agreements: IpAgreement[]): MeteredEvent[] {
  const agreementById = new Map(agreements.map((a) => [a.id, a]))
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
  const seenFirstEvent = new Set<string>()

  return sorted.map((event): MeteredEvent => {
    const agreement = event.agreementId ? agreementById.get(event.agreementId) : undefined
    const notBillable = (reason: string): MeteredEvent => ({ ...event, billableUnits: 0, charge: 0, billable: false, reason })

    if (!event.succeeded) return notBillable('call failed')
    if (event.date < ACCESS_CONTROLS_EFFECTIVE_DATE) {
      return notBillable(`before access-controls effective date (${ACCESS_CONTROLS_EFFECTIVE_DATE})`)
    }
    if (!agreement) return notBillable('no IP agreement on file')
    if (agreement.status !== 'Active') return notBillable(`agreement not Active (${agreement.status})`)
    if (NO_COST_PARTY_TYPES.has(agreement.partyType)) return notBillable(`no-cost party type (${agreement.partyType})`)

    if (event.channel === 'Tracking API') {
      const billableUnits = event.packageCount
      const charge = agreement.feeModel === 'transaction' ? billableUnits * agreement.unitRate : 0
      return { ...event, billableUnits, charge, billable: true, reason: 'billable: Tracking API call' }
    }

    // Tracking Webhook / Scan Event Extract: unit is the tracking number,
    // metered once on its first event ever.
    if (seenFirstEvent.has(event.trackingNumber)) {
      return notBillable('already charged for this tracking number')
    }
    seenFirstEvent.add(event.trackingNumber)
    const charge = agreement.feeModel === 'transaction' ? agreement.unitRate : 0
    return { ...event, billableUnits: 1, charge, billable: true, reason: `billable: first event for tracking number (${event.channel})` }
  })
}

export interface AgreementInvoice {
  agreementId: string
  customerName: string
  feeModel: FeeModel
  transactionCharges: number
  flatFeeCharged: number
  totalCharge: number
  billableUnits: number
  lineItem: string
}

// Invoice: `transaction` fee model sums per-unit charges for the month;
// `unlimited` charges a flat fee once if used at all that month (volume
// is still tracked/shown, just not billed per unit).
export function computeInvoice(metered: MeteredEvent[], agreements: IpAgreement[], month: string): AgreementInvoice[] {
  const inMonth = metered.filter((e) => e.date.startsWith(month) && e.billable && e.agreementId)
  const byAgreement = new Map<string, MeteredEvent[]>()
  for (const e of inMonth) {
    const list = byAgreement.get(e.agreementId!) ?? []
    list.push(e)
    byAgreement.set(e.agreementId!, list)
  }

  const invoices: AgreementInvoice[] = []
  for (const agreement of agreements) {
    const events = byAgreement.get(agreement.id) ?? []
    if (events.length === 0) continue
    const billableUnits = events.reduce((sum, e) => sum + e.billableUnits, 0)
    if (agreement.feeModel === 'unlimited') {
      invoices.push({
        agreementId: agreement.id,
        customerName: agreement.customerName,
        feeModel: agreement.feeModel,
        transactionCharges: 0,
        flatFeeCharged: agreement.monthlyFee,
        totalCharge: agreement.monthlyFee,
        billableUnits,
        lineItem: CHARGE_LINE_ITEM,
      })
    } else {
      const transactionCharges = events.reduce((sum, e) => sum + e.charge, 0)
      invoices.push({
        agreementId: agreement.id,
        customerName: agreement.customerName,
        feeModel: agreement.feeModel,
        transactionCharges,
        flatFeeCharged: 0,
        totalCharge: transactionCharges,
        billableUnits,
        lineItem: CHARGE_LINE_ITEM,
      })
    }
  }
  return invoices
}

export interface DailyAccrual {
  date: string
  charge: number
}

// Daily accrual shows TRANSACTION charges only -- a flat unlimited fee
// isn't earned day-by-day, so it never appears in this series.
export function computeDailyAccrual(metered: MeteredEvent[], agreements: IpAgreement[]): DailyAccrual[] {
  const agreementById = new Map(agreements.map((a) => [a.id, a]))
  const byDate = new Map<string, number>()
  for (const e of metered) {
    if (!e.billable || !e.agreementId) continue
    const agreement = agreementById.get(e.agreementId)
    if (!agreement || agreement.feeModel !== 'transaction') continue
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.charge)
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, charge]) => ({ date, charge }))
}
