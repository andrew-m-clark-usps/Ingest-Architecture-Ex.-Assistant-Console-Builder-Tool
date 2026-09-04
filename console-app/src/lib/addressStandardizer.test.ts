import { describe, expect, it } from 'vitest'
import { standardizeDeliveryLine, standardizeAddress } from './addressStandardizer'

describe('standardizeDeliveryLine', () => {
  it('does not let the suffix scan consume a street-name token that looks like a directional/suffix word', () => {
    const parsed = standardizeDeliveryLine('123 Key West Blvd')
    expect(parsed.streetName).toBe('KEY WEST')
    expect(parsed.suffix).toBe('BLVD')
  })

  it('keeps a multi-token secondary unit together', () => {
    const parsed = standardizeDeliveryLine('456 Main St Bldg 14 Ste 2200')
    expect(parsed.secondary).toBe('BLDG 14 STE 2200')
    expect(parsed.deliveryLine).toBe('456 MAIN ST')
  })

  it('keeps a pre-directional as part of the street name when nothing would remain otherwise', () => {
    const parsed = standardizeDeliveryLine('100 W St')
    expect(parsed.streetName).toBe('W')
    expect(parsed.preDirectional).toBeUndefined()
  })

  it('treats a leading directional as pre-directional when a street name remains', () => {
    const parsed = standardizeDeliveryLine('100 N Main St')
    expect(parsed.preDirectional).toBe('N')
    expect(parsed.streetName).toBe('MAIN')
  })

  it('flags a missing unit number after a designator as an error', () => {
    const parsed = standardizeDeliveryLine('123 Main St Apt')
    expect(parsed.issues.some((i) => i.code === 'MISSING_UNIT_NUMBER')).toBe(true)
  })

  it('flags "#" instead of a recognized designator as a warning', () => {
    const parsed = standardizeDeliveryLine('123 Main St #4')
    expect(parsed.issues.some((i) => i.code === 'HASH_INSTEAD_OF_DESIGNATOR' && i.severity === 'warning')).toBe(true)
  })

  it('flags a missing primary number as an error', () => {
    const parsed = standardizeDeliveryLine('Main St')
    expect(parsed.issues.some((i) => i.code === 'NO_PRIMARY_NUMBER' && i.severity === 'error')).toBe(true)
  })

  it('recognizes PO BOX as a primary-number form', () => {
    const parsed = standardizeDeliveryLine('PO Box 123')
    expect(parsed.primaryNumber).toBe('PO BOX 123')
  })
})

describe('standardizeAddress', () => {
  it('is not Pub28-compliant when a required field is missing', () => {
    const result = standardizeAddress({ deliveryLine: '123 Main St', city: '', state: 'TX', zip5: '78701' })
    expect(result.pub28Compliant).toBe(false)
  })

  it('is Pub28-compliant when every required field is present and valid', () => {
    const result = standardizeAddress({ deliveryLine: '123 Main St', city: 'Austin', state: 'TX', zip5: '78701', zip4: '1234' })
    expect(result.pub28Compliant).toBe(true)
    expect(result.lastLine).toBe('AUSTIN TX 78701-1234')
  })
})
