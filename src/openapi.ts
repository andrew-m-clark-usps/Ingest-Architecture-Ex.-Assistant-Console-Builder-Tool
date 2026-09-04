import type { Candidate } from './profiles/types.js'

interface OpenApiDocument {
  openapi?: string
  swagger?: string
  paths?: Record<string, Record<string, unknown>>
  components?: {
    schemas?: Record<string, unknown>
  }
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonDocument(bytes: Uint8Array): unknown {
  const text = new TextDecoder('utf-8').decode(bytes)
  return JSON.parse(text)
}

function isOpenApiDocument(value: unknown): value is OpenApiDocument {
  if (!isObject(value)) return false
  const doc = value as OpenApiDocument
  return isObject(doc.paths) && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string')
}

function appendFieldCandidates(candidates: Candidate[], schema: unknown, ref: string, because: string): void {
  if (!isObject(schema)) return
  const properties = schema.properties
  if (!isObject(properties)) return

  for (const name of Object.keys(properties).sort((a, b) => a.localeCompare(b))) {
    candidates.push({ kind: 'field', text: name, ref, because })
  }
}

function appendSchemaFields(candidates: Candidate[], schemas: Record<string, unknown> | undefined, refBase: string): void {
  if (!schemas) return
  for (const schemaName of Object.keys(schemas).sort((a, b) => a.localeCompare(b))) {
    appendFieldCandidates(candidates, schemas[schemaName], `${refBase}#/components/schemas/${schemaName}`, 'OpenAPI schema property')
  }
}

function escapeJsonPointerToken(token: string): string {
  return token.replaceAll('~', '~0').replaceAll('/', '~1')
}

function appendRequestBodyFields(candidates: Candidate[], operation: Record<string, unknown>, opRef: string): void {
  const requestBody = operation.requestBody
  if (!isObject(requestBody) || !isObject(requestBody.content)) return

  for (const mediaType of Object.keys(requestBody.content).sort((a, b) => a.localeCompare(b))) {
    const mediaDef = requestBody.content[mediaType]
    if (isObject(mediaDef)) {
      appendFieldCandidates(
        candidates,
        mediaDef.schema,
        `${opRef}/requestBody/content/${mediaType}`,
        'OpenAPI request body schema property',
      )
    }
  }
}

function appendParameterCandidates(candidates: Candidate[], operation: Record<string, unknown>, opRef: string): void {
  const parameters = operation.parameters
  if (!Array.isArray(parameters)) return

  for (const parameter of parameters) {
    if (!isObject(parameter) || typeof parameter.name !== 'string') continue
    candidates.push({
      kind: 'field',
      text: parameter.name,
      ref: `${opRef}/parameters/${parameter.name}`,
      because: 'OpenAPI parameter name',
    })
  }
}

function appendOperationCandidates(
  candidates: Candidate[],
  pathName: string,
  method: string,
  operation: Record<string, unknown>,
  refBase: string,
): void {
  const opRef = `${refBase}#/paths/${escapeJsonPointerToken(pathName)}/${method}`
  candidates.push({
    kind: 'endpoint',
    text: `${method.toUpperCase()} ${pathName}`,
    ref: opRef,
    because: 'OpenAPI path + method declaration',
  })
  appendRequestBodyFields(candidates, operation, opRef)
  appendParameterCandidates(candidates, operation, opRef)
}

function appendPathCandidates(candidates: Candidate[], paths: Record<string, Record<string, unknown>>, refBase: string): void {
  for (const pathName of Object.keys(paths).sort((a, b) => a.localeCompare(b))) {
    const pathItem = paths[pathName]
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method]
      if (!isObject(operation)) continue
      appendOperationCandidates(candidates, pathName, method, operation, refBase)
    }
  }
}

export function readOpenApiCandidates(bytes: Uint8Array, refBase: string): Candidate[] | undefined {
  let parsed: unknown
  try {
    parsed = parseJsonDocument(bytes)
  } catch {
    return undefined
  }
  if (!isOpenApiDocument(parsed)) return undefined

  const candidates: Candidate[] = []
  appendPathCandidates(candidates, parsed.paths ?? {}, refBase)
  appendSchemaFields(candidates, parsed.components?.schemas, refBase)
  return candidates
}