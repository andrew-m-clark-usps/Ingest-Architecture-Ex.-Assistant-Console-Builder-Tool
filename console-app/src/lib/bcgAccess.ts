// See ../../Console.md section 6.5 (Business Customer Gateway access
// model).

export interface Location {
  id: string
  crid: string
  mids: string[]
  permits: string[]
  address: string
}

export type AccessStatus = 'Pending' | 'Approved' | 'Rejected'
export type AccessRole = 'BSA' | 'User'

export interface AccessRequest {
  id: string
  userId: string
  service: string
  locationId: string
  status: AccessStatus
  role: AccessRole
  requestedAt: string
}

let cridSequence = 1000

// A location added WITHOUT an existing CRID always gets a NEW one. This
// reproduces the duplicate-CRID trap deliberately (per Console.md section
// 6.5) rather than silently deduping against a location that should have
// shared a CRID -- that's the real BCG behavior being modeled, not a bug
// to paper over here.
export function addLocation(existing: Location[], input: { address: string; crid?: string; mids?: string[]; permits?: string[] }): Location {
  const crid = input.crid ?? `CRID-${cridSequence++}`
  return {
    id: `LOC-${existing.length + 1}`,
    crid,
    mids: input.mids ?? [],
    permits: input.permits ?? [],
    address: input.address,
  }
}

// Access is a triple: user x service x location. The first requester of
// a service at a location becomes its Business Service Administrator for
// that service+location only; every later request for the same
// service+location starts as a plain User. An unadministered request
// simply stays Pending -- that's correct behavior, not something to
// special-case away.
export function requestAccess(
  existing: AccessRequest[],
  input: { userId: string; service: string; locationId: string },
  now: () => string = () => new Date().toISOString().slice(0, 10),
): AccessRequest {
  const approvedForServiceLocation = existing.filter(
    (r) => r.service === input.service && r.locationId === input.locationId && r.status === 'Approved',
  )
  const role: AccessRole = approvedForServiceLocation.length === 0 ? 'BSA' : 'User'

  return {
    id: `REQ-${existing.length + 1}`,
    userId: input.userId,
    service: input.service,
    locationId: input.locationId,
    status: 'Pending',
    role,
    requestedAt: now(),
  }
}
