import { Routes, Route } from 'react-router-dom'
import { Hub } from '../pages/Hub'
import { Gateway } from '../pages/Gateway'
import { Usage } from '../pages/Usage'
import { Ledger } from '../pages/Ledger'
import { ChangeOfAddress } from '../pages/ChangeOfAddress'
import { Validator } from '../pages/Validator'
import { Reports } from '../pages/Reports'
import { DataSources } from '../pages/DataSources'
import { PafLicensing } from '../pages/PafLicensing'
import { Reference } from '../pages/Reference'
import { Help } from '../pages/Help'
import { NotFound } from '../pages/NotFound'

// DEMO/REFERENCE SCAFFOLD -- ../Console.md section 4: every route in one
// file, with a catch-all so an nginx try_files fallback never shows a blank
// shell for a typo'd path.
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/gateway/*" element={<Gateway />} />
      <Route path="/usage/*" element={<Usage />} />
      <Route path="/ledger" element={<Ledger />} />
      <Route path="/change-of-address" element={<ChangeOfAddress />} />
      <Route path="/validator" element={<Validator />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/data-sources" element={<DataSources />} />
      <Route path="/paf-licensing" element={<PafLicensing />} />
      <Route path="/reference" element={<Reference />} />
      <Route path="/help" element={<Help />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
