import React from 'react'
import { AgentManifest } from '../api'

interface Props {
  baseline: AgentManifest
  target: AgentManifest
}

function FieldRow({ field, baseType, targetType, required }: {
  field: string; baseType?: string; targetType?: string; required: boolean
}) {
  const changed = baseType && targetType && baseType !== targetType
  const added = !baseType && targetType
  const removed = baseType && !targetType
  const bg = changed || removed ? 'bg-red-50' : added ? 'bg-green-50' : ''

  return (
    <tr className={bg}>
      <td className="px-3 py-1.5 text-sm font-mono text-gray-800">
        {field} {required && <span className="text-red-500 text-xs">*</span>}
      </td>
      <td className="px-3 py-1.5 text-sm font-mono text-gray-500">{baseType ?? '—'}</td>
      <td className="px-3 py-1.5 text-sm font-mono">
        {removed ? <span className="text-red-600">removed</span> :
         added ? <span className="text-green-600">{targetType} (new)</span> :
         changed ? <span className="text-red-600">{targetType} ⚠ changed</span> :
         <span className="text-gray-500">{targetType}</span>}
      </td>
    </tr>
  )
}

function DiffTable({ title, baseline, target, requiredFields }: {
  title: string
  baseline: { version: string; properties: Record<string, { type: string }> }
  target: { version: string; properties: Record<string, { type: string }> }
  requiredFields: Set<string>
}) {
  const allFields = new Set([
    ...Object.keys(baseline.properties),
    ...Object.keys(target.properties)
  ])

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">{title}</h3>
      <table className="w-full text-left border border-gray-100 rounded-lg overflow-hidden">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2">v{baseline.version}</th>
            <th className="px-3 py-2">v{target.version}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {[...allFields].map(field => (
            <FieldRow
              key={field}
              field={field}
              baseType={baseline.properties[field]?.type}
              targetType={target.properties[field]?.type}
              required={requiredFields.has(field)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SchemaDiff({ baseline, target }: Props) {
  return (
    <div className="space-y-6">
      <DiffTable
        title="Inputs"
        baseline={{ version: baseline.version, properties: baseline.inputs.properties }}
        target={{ version: target.version, properties: target.inputs.properties }}
        requiredFields={new Set(target.inputs.required ?? [])}
      />
      <DiffTable
        title="Outputs"
        baseline={{ version: baseline.version, properties: baseline.outputs.properties }}
        target={{ version: target.version, properties: target.outputs.properties }}
        requiredFields={new Set(target.outputs.required ?? [])}
      />
    </div>
  )
}
