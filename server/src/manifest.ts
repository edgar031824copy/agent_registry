import yaml from 'js-yaml'
import Ajv from 'ajv'

export interface EvalEntry {
  id: string
  input: Record<string, unknown>
  expected_output_contains: string[]
  score: number
}

export interface AgentManifest {
  name: string
  version: string
  description: string
  author_team: string
  model_recommendations?: string[]
  inputs: {
    type: 'object'
    required?: string[]
    properties: Record<string, { type: string; description?: string; default?: unknown }>
  }
  outputs: {
    type: 'object'
    required?: string[]
    properties: Record<string, { type: string; description?: string }>
  }
  eval_suite?: EvalEntry[]
  tags?: string[]
}

const ajv = new Ajv()

const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['name', 'version', 'description', 'author_team', 'inputs', 'outputs'],
  properties: {
    name: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    description: { type: 'string', minLength: 1 },
    author_team: { type: 'string', minLength: 1 },
    model_recommendations: { type: 'array', items: { type: 'string' } },
    inputs: {
      type: 'object',
      required: ['type', 'properties'],
      properties: {
        type: { type: 'string', enum: ['object'] },
        required: { type: 'array', items: { type: 'string' } },
        properties: { type: 'object' }
      }
    },
    outputs: {
      type: 'object',
      required: ['type', 'properties'],
      properties: {
        type: { type: 'string', enum: ['object'] },
        required: { type: 'array', items: { type: 'string' } },
        properties: { type: 'object' }
      }
    },
    eval_suite: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'input', 'expected_output_contains', 'score'],
        properties: {
          id: { type: 'string' },
          input: { type: 'object' },
          expected_output_contains: { type: 'array', items: { type: 'string' } },
          score: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    tags: { type: 'array', items: { type: 'string' } }
  },
  additionalProperties: false
}

const validate = ajv.compile(MANIFEST_SCHEMA)

export function validateManifestShape(data: unknown): AgentManifest {
  const valid = validate(data)
  if (!valid) {
    const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join('; ')
    throw new Error(`Invalid manifest: ${errors}`)
  }
  return data as unknown as AgentManifest
}

export function parseManifest(yamlContent: string): AgentManifest {
  let parsed: unknown
  try {
    parsed = yaml.load(yamlContent)
  } catch (e) {
    throw new Error(`YAML parse error: ${(e as Error).message}`)
  }
  return validateManifestShape(parsed)
}
