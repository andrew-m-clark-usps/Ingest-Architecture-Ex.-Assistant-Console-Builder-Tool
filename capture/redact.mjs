// Pure, dependency-free helpers used by capture.mjs. Split out so the
// safety-critical logic (never recording a credential; structure-only
// bodies) can be unit tested without a real browser, which this sandboxed
// environment cannot download (see capture/README.md).

const SENSITIVE_HEADER_NAMES = new Set(['authorization', 'cookie', 'set-cookie'])

/** Never record an Authorization header, a cookie, or a Set-Cookie header — not even redacted. */
export function redactHeaders(headers) {
  const result = {}
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) continue
    result[name] = value
  }
  return result
}

function shapeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/** Strip a JSON body to its structure — keys, types, nullability — never the values. */
export function structureOfJsonBody(body) {
  if (body === undefined || body === null) return null
  let parsed
  try {
    parsed = typeof body === 'string' ? JSON.parse(body) : body
  } catch {
    return { shape: 'non-json-or-invalid' }
  }
  if (Array.isArray(parsed)) {
    return { shape: 'array', itemShape: parsed.length > 0 ? structureOfJsonBody(parsed[0]) : 'unknown', length: parsed.length }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { shape: shapeOf(parsed) }
  }
  const fields = {}
  for (const [key, value] of Object.entries(parsed)) {
    fields[key] = { type: shapeOf(value), nullable: value === null }
  }
  return { shape: 'object', fields }
}

/** Query strings carry session identifiers and record ids — not part of the route. */
export function dropQueryString(url) {
  const qIdx = url.indexOf('?')
  return qIdx === -1 ? url : url.slice(0, qIdx)
}

/** A network capture entry with headers and bodies reduced to structure only. */
export function summarizeExchange({ url, method, requestHeaders, requestBody, status, responseHeaders, responseBody }) {
  return {
    path: dropQueryString(url),
    method,
    status,
    requestHeaders: redactHeaders(requestHeaders),
    requestBodyShape: structureOfJsonBody(requestBody),
    responseHeaders: redactHeaders(responseHeaders),
    responseBodyShape: structureOfJsonBody(responseBody),
  }
}
