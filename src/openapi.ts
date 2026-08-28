import type { Candidate } from './profiles/types.js'
import { parseYamlSubset, type YamlValue } from './yamlSubset.js'

// See ../Spec-Ingest-Tool.md section 6A ("Reading an API specification").
// Handles OpenAPI 3.x and Swagger 2.0. Almost nothing here is inference —
// this transcribes a contract, so `because` says so. $ref is resolved one
// hop at a time with a depth limit, so a circular schema cannot hang the
// reader.

const MAX_REF_DEPTH = 8
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const

function isRecord(v: YamlValue): v is Record<string, YamlValue> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function resolveRef(root: Record<string, YamlValue>, ref: string, depth: number): YamlValue {
  if (depth > MAX_REF_DEPTH) throw new Error(`$ref depth exceeded ${MAX_REF_DEPTH} — refusing a likely-circular schema: ${ref}`)
  if (!ref.startsWith('#/')) throw new Error(`only local $ref (starting with "#/") is supported: ${ref}`)
  const path = ref.slice(2).split('/')
  let node: YamlValue = root
  for (const segment of path) {
    if (!isRecord(node)) return undefined as unknown as YamlValue
    node = node[segment]
  }
  if (isRecord(node) && typeof node.$ref === 'string') return resolveRef(root, node.$ref, depth + 1)
  return node
}

function resolve(root: Record<string, YamlValue>, value: YamlValue, depth = 0): YamlValue {
  if (isRecord(value) && typeof value.$ref === 'string') return resolveRef(root, value.$ref, depth)
  return value
}

function describeField(name: string, schema: YamlValue, requiredNames: Set<string>): string {
  const s = isRecord(schema) ? schema : {}
  const type = typeof s.type === 'string' ? s.type : 'unknown'
  const format = typeof s.format === 'string' ? ` (${s.format})` : ''
  const enumVals = Array.isArray(s.enum) ? ` enum[${s.enum.join(',')}]` : ''
  const required = requiredNames.has(name) ? 'required' : 'optional'
  return `${name}: ${type}${format}${enumVals}, ${required}`
}

/** Claim a .json/.yaml file only when it declares an openapi or swagger version. */
export function isOpenApiDocument(doc: YamlValue): boolean {
  return isRecord(doc) && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string')
}

export function parseOpenApiSource(raw: string, isJson: boolean): YamlValue {
  return isJson ? JSON.parse(raw) : parseYamlSubset(raw)
}

export function classifyOpenApi(doc: YamlValue, ref: string): Candidate[] {
  if (!isRecord(doc)) throw new Error('not an OpenAPI/Swagger document (root is not a mapping)')
  if (!isOpenApiDocument(doc)) {
    throw new Error('no "openapi" or "swagger" version key — falls through to another reader')
  }
  const root = doc
  const candidates: Candidate[] = []
  const paths = isRecord(root.paths) ? root.paths : {}

  for (const [path, pathItemRaw] of Object.entries(paths)) {
    const pathItem = resolve(root, pathItemRaw)
    if (!isRecord(pathItem)) continue

    for (const method of HTTP_METHODS) {
      const operationRaw = pathItem[method]
      if (operationRaw === undefined) continue
      const operation = resolve(root, operationRaw)
      if (!isRecord(operation)) continue

      const key = `${method.toUpperCase()} ${path}`
      candidates.push({ kind: 'endpoint', text: key, ref, because: 'OpenAPI operation (transcribed, not inferred)' })

      if (operation.deprecated === true) {
        candidates.push({ kind: 'rule', text: `${key} is deprecated`, ref, because: 'operation marked deprecated' })
      }
      if (Array.isArray(operation.security) && operation.security.length === 0) {
        candidates.push({ kind: 'rule', text: `${key} explicitly disables security (security: [])`, ref, because: 'operation overrides global security' })
      }

      const parameters = Array.isArray(operation.parameters) ? operation.parameters : []
      for (const paramRaw of parameters) {
        const param = resolve(root, paramRaw)
        if (!isRecord(param) || typeof param.name !== 'string') continue
        // A path parameter is required whether or not it says so.
        const required = param.in === 'path' ? true : param.required === true
        const schema = resolve(root, param.schema)
        const type = isRecord(schema) && typeof schema.type === 'string' ? schema.type : 'unknown'
        candidates.push({
          kind: 'field',
          text: `${key} param ${param.name} (${param.in}): ${type}, ${required ? 'required' : 'optional'}`,
          ref,
          because: 'OpenAPI parameter (transcribed, not inferred)',
        })
      }

      const requestBody = resolve(root, operation.requestBody)
      if (isRecord(requestBody)) {
        const content = isRecord(requestBody.content) ? requestBody.content : {}
        for (const media of Object.values(content)) {
          const schema = resolve(root, isRecord(media) ? media.schema : null)
          if (!isRecord(schema)) continue
          const props = isRecord(schema.properties) ? schema.properties : {}
          const requiredNames = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : [])
          for (const [propName, propSchema] of Object.entries(props)) {
            candidates.push({
              kind: 'field',
              text: `${key} body.${describeField(propName, resolve(root, propSchema), requiredNames)}`,
              ref,
              because: 'OpenAPI request body field (transcribed, not inferred)',
            })
          }
        }
      }

      const responses = isRecord(operation.responses) ? operation.responses : {}
      for (const [status] of Object.entries(responses)) {
        // Every 4xx/5xx response is a rule — the half of a contract callers
        // actually depend on. Success responses are not rules.
        if (/^[45]\d\d$/.test(status)) {
          candidates.push({
            kind: 'rule',
            text: `${key} -> ${status}`,
            ref,
            because: 'error response in the contract (transcribed, not inferred)',
          })
        }
      }
    }
  }

  const securitySchemes = isRecord(root.components) && isRecord(root.components.securitySchemes)
    ? root.components.securitySchemes
    : isRecord(root.securityDefinitions)
      ? root.securityDefinitions // Swagger 2.0 name
      : {}
  for (const [name, schemeRaw] of Object.entries(securitySchemes)) {
    const scheme = resolve(root, schemeRaw)
    const type = isRecord(scheme) && typeof scheme.type === 'string' ? scheme.type : 'unknown'
    candidates.push({
      kind: 'rule',
      text: `authenticates via ${name}: ${type}`,
      ref,
      because: 'security scheme (transcribed, not inferred)',
    })
  }

  return candidates
}
