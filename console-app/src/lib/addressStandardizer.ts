// See ../../Console.md section 6.1 (Publication 28 address standardizer).
// Parsing order matters: scanning from the end first would wrongly
// consume a street-name token that looks like a suffix or directional
// (e.g. "KEY" in "123 KEY WEST BLVD").

export interface AddressIssue {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  reference: string
  field?: string
}

const SECONDARY_DESIGNATORS = new Set([
  'APT',
  'STE',
  'SUITE',
  'UNIT',
  'BLDG',
  'FL',
  'FLOOR',
  'RM',
  'ROOM',
  'LOT',
  'SLIP',
  'TRLR',
  'DEPT',
])

const STREET_SUFFIXES: Record<string, string> = {
  ST: 'ST',
  STREET: 'ST',
  AVE: 'AVE',
  AVENUE: 'AVE',
  BLVD: 'BLVD',
  BOULEVARD: 'BLVD',
  DR: 'DR',
  DRIVE: 'DR',
  RD: 'RD',
  ROAD: 'RD',
  LN: 'LN',
  LANE: 'LN',
  CT: 'CT',
  COURT: 'CT',
  PL: 'PL',
  PLACE: 'PL',
  WAY: 'WAY',
  HWY: 'HWY',
  HIGHWAY: 'HWY',
  PKWY: 'PKWY',
  PARKWAY: 'PKWY',
  CIR: 'CIR',
  CIRCLE: 'CIR',
  TER: 'TER',
  TERRACE: 'TER',
}

const DIRECTIONALS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'])

function normalize(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface ParsedDeliveryLine {
  deliveryLine: string
  primaryNumber?: string
  preDirectional?: string
  streetName?: string
  suffix?: string
  postDirectional?: string
  secondary?: string
  transformations: string[]
  issues: AddressIssue[]
}

export function standardizeDeliveryLine(raw: string): ParsedDeliveryLine {
  const transformations: string[] = []
  const issues: AddressIssue[] = []
  const normalized = normalize(raw)
  if (normalized !== raw.trim()) transformations.push('uppercased and normalized whitespace/punctuation')

  const tokens = normalized.split(' ').filter(Boolean)
  if (tokens.length === 0) {
    issues.push({ code: 'NO_DELIVERY_LINE', severity: 'error', message: 'No delivery line provided', reference: 'Publication 28', field: 'deliveryLine' })
    return { deliveryLine: '', transformations, issues }
  }

  // 1. Primary number: leading digits, or PO BOX / RR / HC forms.
  let idx = 0
  let primaryNumber: string | undefined
  if (/^P\.?O\.?$/.test(tokens[0]) && /^BOX$/.test(tokens[1] ?? '')) {
    idx = Math.min(3, tokens.length)
    primaryNumber = tokens.slice(0, idx).join(' ')
  } else if (/^(RR|HC)$/.test(tokens[0])) {
    idx = Math.min(2, tokens.length)
    primaryNumber = tokens.slice(0, idx).join(' ')
  } else if (/^\d+[-/]?\d*$/.test(tokens[0])) {
    primaryNumber = tokens[0]
    idx = 1
  } else {
    issues.push({ code: 'NO_PRIMARY_NUMBER', severity: 'error', message: 'No primary/house number found', reference: 'Publication 28 Ch. 2', field: 'deliveryLine' })
  }

  // 2. Bound the suffix search by the LAST plausible secondary-unit
  // designator token anywhere in the line (requires a primary number +
  // street name before it) -- this only prevents the suffix scan from
  // running past a real secondary designator, it is NOT necessarily
  // where the secondary unit actually starts (see step 4).
  let lastDesignatorIdx = -1
  for (let i = tokens.length - 1; i > idx; i--) {
    if (SECONDARY_DESIGNATORS.has(tokens[i])) {
      lastDesignatorIdx = i
      break
    }
  }
  const streetEnd = lastDesignatorIdx === -1 ? tokens.length : lastDesignatorIdx

  // 3. Street suffix is between the street name and that bound.
  let suffixIdx = -1
  for (let i = streetEnd - 1; i > idx; i--) {
    if (STREET_SUFFIXES[tokens[i]]) {
      suffixIdx = i
      break
    }
  }
  if (suffixIdx === -1) {
    issues.push({ code: 'NO_SUFFIX', severity: 'info', message: 'No recognized street suffix', reference: 'Publication 28 Appendix C1', field: 'deliveryLine' })
  }

  // 4. The secondary unit actually starts at the FIRST designator token
  // occurring after the suffix -- this keeps a multi-designator value
  // like "BLDG 14 STE 2200" together as one secondary field, rather than
  // only capturing the last designator found in step 2.
  let secondaryIdx = -1
  if (suffixIdx !== -1) {
    for (let i = suffixIdx + 1; i < tokens.length; i++) {
      if (SECONDARY_DESIGNATORS.has(tokens[i])) {
        secondaryIdx = i
        break
      }
    }
  } else {
    secondaryIdx = lastDesignatorIdx
  }

  let secondary: string | undefined
  if (secondaryIdx !== -1) {
    secondary = tokens.slice(secondaryIdx).join(' ')
    const hasUnitNumber = tokens[secondaryIdx + 1] !== undefined && /^[\dA-Z-]+$/.test(tokens[secondaryIdx + 1])
    if (!hasUnitNumber) {
      issues.push({
        code: 'MISSING_UNIT_NUMBER',
        severity: 'error',
        message: `${tokens[secondaryIdx]} designator has no unit value`,
        reference: 'Publication 28 Appendix C2',
        field: 'secondary',
      })
    }
  }
  if (normalized.includes('#')) {
    issues.push({
      code: 'HASH_INSTEAD_OF_DESIGNATOR',
      severity: 'warning',
      message: 'Use a recognized unit designator instead of "#"',
      reference: 'Publication 28 Appendix C2',
      field: 'secondary',
    })
  }

  const deliveryEnd = secondaryIdx === -1 ? tokens.length : secondaryIdx
  const nameBoundEnd = suffixIdx === -1 ? deliveryEnd : suffixIdx

  // 5. Pre-directional only counts if a street name of at least one
  // token would still remain after removing it -- "100 W ST" keeps W as
  // the street name itself, not a directional, since nothing would
  // remain otherwise.
  let preDirectional: string | undefined
  if (nameBoundEnd - idx > 1 && DIRECTIONALS.has(tokens[idx])) {
    preDirectional = tokens[idx]
  }

  const nameStart = idx + (preDirectional ? 1 : 0)
  const streetName = nameStart < nameBoundEnd ? tokens.slice(nameStart, nameBoundEnd).join(' ') : undefined

  // Post-directional is the token right after the suffix (before any
  // secondary designator).
  let postDirectional: string | undefined
  if (suffixIdx !== -1 && suffixIdx + 1 < deliveryEnd && DIRECTIONALS.has(tokens[suffixIdx + 1])) {
    postDirectional = tokens[suffixIdx + 1]
  }

  const deliveryLine = tokens.slice(0, deliveryEnd).join(' ')
  if (deliveryLine.length > 64) {
    issues.push({ code: 'DELIVERY_LINE_TOO_LONG', severity: 'warning', message: 'Delivery line exceeds 64 characters', reference: 'Publication 28 Ch. 2', field: 'deliveryLine' })
  }

  return { deliveryLine, primaryNumber, preDirectional, streetName, suffix: suffixIdx !== -1 ? STREET_SUFFIXES[tokens[suffixIdx]] : undefined, postDirectional, secondary, transformations, issues }
}

export interface AddressInput {
  deliveryLine: string
  city: string
  state: string
  zip5: string
  zip4?: string
}

export interface StandardizedAddress {
  input: AddressInput
  deliveryLine: string
  secondary?: string
  city: string
  state: string
  zip5: string
  zip4?: string
  lastLine: string
  formatted: string
  transformations: string[]
  pub28Compliant: boolean
  issues: AddressIssue[]
}

export function standardizeAddress(input: AddressInput): StandardizedAddress {
  const parsed = standardizeDeliveryLine(input.deliveryLine)
  const issues = [...parsed.issues]

  const city = input.city.trim().toUpperCase()
  const state = input.state.trim().toUpperCase()
  const zip5 = input.zip5.trim()

  if (!city) issues.push({ code: 'NO_CITY', severity: 'error', message: 'City is required', reference: 'Publication 28', field: 'city' })
  if (!/^[A-Z]{2}$/.test(state)) {
    issues.push({ code: 'NO_STATE', severity: 'error', message: 'A 2-letter state abbreviation is required', reference: 'Publication 28 Appendix B', field: 'state' })
  }
  if (!/^\d{5}$/.test(zip5)) {
    issues.push({ code: 'NO_ZIP5', severity: 'error', message: 'A 5-digit ZIP Code is required', reference: 'Publication 28', field: 'zip5' })
  } else if (!input.zip4) {
    issues.push({ code: 'MISSING_ZIP4', severity: 'warning', message: 'Missing ZIP+4', reference: 'Publication 28', field: 'zip4' })
  }

  const lastLine = [city, state, input.zip4 ? `${zip5}-${input.zip4}` : zip5].filter(Boolean).join(' ')
  const formatted = [parsed.deliveryLine, parsed.secondary, lastLine].filter(Boolean).join('\n')
  const pub28Compliant = issues.every((i) => i.severity !== 'error')

  return {
    input,
    deliveryLine: parsed.deliveryLine,
    secondary: parsed.secondary,
    city,
    state,
    zip5,
    zip4: input.zip4,
    lastLine,
    formatted,
    transformations: parsed.transformations,
    pub28Compliant,
    issues,
  }
}
