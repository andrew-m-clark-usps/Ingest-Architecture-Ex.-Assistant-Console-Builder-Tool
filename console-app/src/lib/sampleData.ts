// Sample seed data so pages can demonstrate the Loaded state without a
// backend -- loaded on demand from the Data Sources page or a page's own
// "load sample data" action. Data never leaves the tab; this is bundled
// static data, not a network fetch.

import type { LedgerTransaction } from './ledger'
import type { IpAgreement, UsageEvent } from './usageMetering'
import type { ChangeOfAddressRecord } from './changeOfAddressAudit'

export const SAMPLE_LEDGER_TRANSACTIONS: LedgerTransaction[] = [
  { id: 'T1', transactionId: 'TXN-1001', accountNumber: 'ACCT-100', crid: 'CRID-1000', mid: 'MID-01', postedDate: '2026-08-01', transactionType: 'Deposit', channel: 'ACH', productType: 'Permit Imprint', amount: 500, balanceAfter: 500, status: 'Posted', statementId: 'STMT-08' },
  { id: 'T2', transactionId: 'TXN-1002', accountNumber: 'ACCT-100', crid: 'CRID-1000', mid: 'MID-01', postedDate: '2026-08-03', transactionType: 'Postage', channel: 'Meter', productType: 'First-Class Mail', amount: -120, balanceAfter: 380, status: 'Posted', statementId: 'STMT-08' },
  { id: 'T3', transactionId: 'TXN-1003', accountNumber: 'ACCT-100', crid: 'CRID-1000', mid: 'MID-01', postedDate: '2026-08-05', transactionType: 'Postage', channel: 'Meter', productType: 'Priority Mail', amount: -60, balanceAfter: 320, status: 'Pending', statementId: 'STMT-08' },
  { id: 'T4', transactionId: 'TXN-1004', accountNumber: 'ACCT-200', crid: 'CRID-1001', mid: 'MID-02', postedDate: '2026-08-02', transactionType: 'Deposit', channel: 'ACH', productType: 'EPS', amount: 1000, balanceAfter: 1000, status: 'Posted', statementId: 'STMT-08' },
  { id: 'T5', transactionId: 'TXN-1005', accountNumber: 'ACCT-200', crid: 'CRID-1001', mid: 'MID-02', postedDate: '2026-08-06', transactionType: 'Fee', channel: 'Tracking Data Usage Fee', productType: 'Usage', amount: -45, balanceAfter: 955, status: 'Posted', statementId: 'STMT-08' },
  { id: 'T6', transactionId: 'TXN-1006', accountNumber: 'ACCT-200', crid: 'CRID-1001', mid: 'MID-02', postedDate: '2026-08-07', transactionType: 'Postage', channel: 'Meter', productType: 'Marketing Mail', amount: -200, balanceAfter: 755, status: 'Rejected', statementId: 'STMT-08' },
]

export const SAMPLE_IP_AGREEMENTS: IpAgreement[] = [
  { id: 'AGMT-1', customerName: 'Acme Logistics', crid: 'CRID-1000', epaAccount: 'EPS-500', partyType: 'Auditor', feeModel: 'transaction', unitRate: 0.01, monthlyFee: 0, authorizedMids: ['MID-01'], status: 'Active', effectiveDate: '2026-04-01' },
  { id: 'AGMT-2', customerName: 'Northwind Analytics', crid: 'CRID-1001', epaAccount: 'EPS-501', partyType: 'Tracking Analytics Vendor', feeModel: 'unlimited', unitRate: 0, monthlyFee: 250, authorizedMids: [], status: 'Active', effectiveDate: '2026-04-01' },
  { id: 'AGMT-3', customerName: 'Contoso Shipping', crid: 'CRID-1002', epaAccount: 'EPS-502', partyType: 'Shipper', feeModel: 'transaction', unitRate: 0.02, monthlyFee: 0, authorizedMids: ['MID-03'], status: 'Active', effectiveDate: '2026-04-01' },
]

export const SAMPLE_USAGE_EVENTS: UsageEvent[] = [
  { id: 'EVT-1', date: '2026-08-01', channel: 'Tracking API', agreementId: 'AGMT-1', crid: 'CRID-1000', mid: 'MID-01', packageCount: 40, trackingNumber: 'TN-0001', succeeded: true },
  { id: 'EVT-2', date: '2026-08-01', channel: 'Tracking Webhook', agreementId: 'AGMT-2', crid: 'CRID-1001', mid: 'MID-02', packageCount: 1, trackingNumber: 'TN-0100', succeeded: true },
  { id: 'EVT-3', date: '2026-08-02', channel: 'Tracking Webhook', agreementId: 'AGMT-2', crid: 'CRID-1001', mid: 'MID-02', packageCount: 1, trackingNumber: 'TN-0100', succeeded: true },
  { id: 'EVT-4', date: '2026-08-02', channel: 'Tracking API', agreementId: 'AGMT-3', crid: 'CRID-1002', mid: 'MID-03', packageCount: 10, trackingNumber: 'TN-0002', succeeded: false },
  { id: 'EVT-5', date: '2026-03-15', channel: 'Tracking API', agreementId: 'AGMT-1', crid: 'CRID-1000', mid: 'MID-01', packageCount: 5, trackingNumber: 'TN-0003', succeeded: true },
]

export const SAMPLE_CHANGE_OF_ADDRESS_RECORDS: ChangeOfAddressRecord[] = [
  { id: 'COA-1', inputRecordId: 'REC-1', firstName: 'Jordan', lastName: 'Rivera', inputAddress: '123 Key West Blvd', inputCity: 'Austin', inputState: 'TX', inputZip: '78701', newAddress: '456 New Home Ave', newCity: 'Round Rock', newState: 'TX', newZip: '78664', moveEffectiveDate: '2026-06-01', moveType: 'I', returnCode: '01' },
  { id: 'COA-2', inputRecordId: 'REC-2', firstName: 'Sam', lastName: 'Nguyen', inputAddress: '90 Elm St', inputCity: 'Boise', inputState: 'ID', inputZip: '83702', returnCode: '03' },
  { id: 'COA-3', inputRecordId: 'REC-3', firstName: 'Casey', lastName: 'Brooks', inputAddress: '77 Ocean Dr', inputCity: 'Miami', inputState: 'FL', inputZip: '33139', newAddress: '12 Rue de Paris', newCity: 'Paris', returnCode: '05', moveType: 'F' },
]
