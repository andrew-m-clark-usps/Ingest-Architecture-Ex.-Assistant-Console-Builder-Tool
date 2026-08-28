// DEMO/REFERENCE SCAFFOLD — see Spec-Ingest-Tool.md section 10 (reconciling
// an old artifact against a newer system).

export interface ReconcileResult {
  alreadyHeld: string[]
  stillManual: string[]
  newInTarget: string[]
}

export function reconcile(_oldFields: string[], _newFields: string[]): ReconcileResult {
  return { alreadyHeld: [], stillManual: [], newInTarget: [] }
}
