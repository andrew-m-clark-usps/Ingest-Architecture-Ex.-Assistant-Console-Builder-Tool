// Reference tables ship as data, not conditionals. See ../../Console.md
// section 8 (URL directory), section 6.6 (party types), section 6.2
// (return codes), section 6.9 (PAF licence classes).

export const STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'PR', name: 'Puerto Rico' },
]

export const PARTY_TYPES: { type: string; billable: boolean }[] = [
  { type: 'Shipper', billable: false },
  { type: 'Platform', billable: false },
  { type: 'Label Provider', billable: false },
  { type: 'Consolidator', billable: false },
  { type: 'Service Provider', billable: false },
  { type: 'Auditor', billable: true },
  { type: 'Software Vendor', billable: true },
  { type: 'Tracking Analytics Vendor', billable: true },
  { type: 'Public Tracking Website', billable: true },
  { type: 'Consumer Business', billable: true },
]

export const RETURN_CODES: { code: string; label: string; matched: boolean; newAddressProvided: boolean; action: string }[] = [
  { code: '01', label: 'Match - New address provided', matched: true, newAddressProvided: true, action: 'Apply new address' },
  { code: '02', label: 'Match - No new address (non-forwardable)', matched: true, newAddressProvided: false, action: 'No change' },
  { code: '03', label: 'No match', matched: false, newAddressProvided: false, action: 'No change' },
  { code: '05', label: 'Match - Foreign move', matched: true, newAddressProvided: true, action: 'Apply new address, flag foreign' },
  { code: '06', label: 'Match - Moved, left no forwarding address', matched: true, newAddressProvided: false, action: 'Suppress mailing' },
]

export const PAF_LICENSE_CLASSES: { licenseClass: string; agreementVersion: string; annualFee: number; pafObligation: string }[] = [
  { licenseClass: 'Full Service Provider', agreementVersion: '2026-1', annualFee: 250, pafObligation: 'Full PAF' },
  { licenseClass: 'Limited Service Provider', agreementVersion: '2026-1', annualFee: 150, pafObligation: 'Limited PAF' },
  { licenseClass: 'Enhanced Line of Travel', agreementVersion: '2026-1', annualFee: 500, pafObligation: 'Full PAF + ELOT addendum' },
  { licenseClass: 'National Change of Address', agreementVersion: '2026-1', annualFee: 750, pafObligation: 'Full PAF + NCOALink addendum' },
]

export interface ReferenceUrl {
  group: string
  label: string
  url: string
  purpose: string
  access: 'open' | 'account required' | 'licence required'
}

// A representative subset of the full 69-URL directory in Console.md
// section 8 -- the full list belongs in that document; this ships enough
// to exercise the searchable directory UI without duplicating the brief.
export const REFERENCE_URLS: ReferenceUrl[] = [
  { group: 'Business Customer Gateway', label: 'Business Customer Gateway', url: 'https://gateway.usps.com/', purpose: 'Sign in / sign up for USPS business services', access: 'open' },
  { group: 'Business Customer Gateway', label: 'Manage Locations', url: 'https://gateway.usps.com/bcg/locations', purpose: 'Add/manage business locations and CRIDs', access: 'account required' },
  { group: 'Address Management', label: 'Publication 28', url: 'https://pe.usps.com/text/pub28/welcome.htm', purpose: 'Postal addressing standards', access: 'open' },
  { group: 'Address Management', label: 'Address Management System', url: 'https://postalpro.usps.com/address-management-systems-ams', purpose: 'ZIP/ZIP+4, city/state file products', access: 'account required' },
  { group: 'Change of Address', label: 'NCOALink Product Information', url: 'https://postalpro.usps.com/address-quality/ncoalink', purpose: 'National Change of Address processing', access: 'licence required' },
  { group: 'PAF & Licensing', label: 'PAF Program Overview', url: 'https://postalpro.usps.com/address-quality/paf', purpose: 'Processing Acknowledgement Form licensing', access: 'licence required' },
  { group: 'Reporting', label: 'Mailer Scorecard', url: 'https://gateway.usps.com/bcg/mailerscorecard', purpose: 'Mail quality diagnostics', access: 'account required' },
  { group: 'Tracking', label: 'Tracking API Documentation', url: 'https://developers.usps.com/tracking', purpose: 'Package Tracking API reference', access: 'account required' },
]
