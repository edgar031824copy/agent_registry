import { AgentManifest } from './manifest'

export interface BreakingChange {
  field: string
  reason: string
}

export function detectBreakingChanges(
  oldManifest: AgentManifest,
  newManifest: AgentManifest
): BreakingChange[] {
  const changes: BreakingChange[] = []

  const oldInputRequired = oldManifest.inputs.required ?? []
  const newInputProps = newManifest.inputs.properties
  const oldInputProps = oldManifest.inputs.properties

  // Rule 1: required input field removed or renamed
  for (const field of oldInputRequired) {
    if (!newInputProps[field]) {
      changes.push({
        field: `inputs.${field}`,
        reason: `Required input field "${field}" was removed`
      })
    }
  }

  // Rule 2: input field type changed
  for (const [field, oldDef] of Object.entries(oldInputProps)) {
    const newDef = newInputProps[field]
    if (newDef && oldDef.type !== newDef.type) {
      changes.push({
        field: `inputs.${field}`,
        reason: `Input field "${field}" type changed from "${oldDef.type}" to "${newDef.type}"`
      })
    }
  }

  // Rule 3: new required input field added without default
  const newInputRequired = newManifest.inputs.required ?? []
  for (const field of newInputRequired) {
    if (!oldInputProps[field] && !newInputProps[field]?.default) {
      changes.push({
        field: `inputs.${field}`,
        reason: `New required input field "${field}" added without a default value`
      })
    }
  }

  // Rule 4: required output field removed
  const oldOutputRequired = oldManifest.outputs.required ?? []
  const newOutputProps = newManifest.outputs.properties

  for (const field of oldOutputRequired) {
    if (!newOutputProps[field]) {
      changes.push({
        field: `outputs.${field}`,
        reason: `Required output field "${field}" was removed`
      })
    }
  }

  // Rule 5: output field type changed
  const oldOutputProps = oldManifest.outputs.properties
  for (const [field, oldDef] of Object.entries(oldOutputProps)) {
    const newDef = newOutputProps[field]
    if (newDef && oldDef.type !== newDef.type) {
      changes.push({
        field: `outputs.${field}`,
        reason: `Output field "${field}" type changed from "${oldDef.type}" to "${newDef.type}"`
      })
    }
  }

  return changes
}
