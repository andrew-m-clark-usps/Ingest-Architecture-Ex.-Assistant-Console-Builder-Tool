import type { Profile } from './types.js'

// The generic default profile named in Spec-Ingest-Tool.md section 8 —
// no domain-specific vocabulary. DEMO/REFERENCE SCAFFOLD.
export const genericProfile: Profile = {
  id: 'generic',
  name: 'Generic application brief',
  description: 'Default profile with no domain-specific vocabulary (demo scaffold).',
  sections: [
    { section: '1', title: 'Screens', kinds: ['field', 'heading'], from: ['document', 'recording'], fill: 'A screenshot, a recorded session, or a UI spec.' },
    { section: '2', title: 'States', kinds: ['state'], from: ['document', 'recording'], fill: 'A backlog with status words, or a recorded session.' },
    { section: '3', title: 'Flows', kinds: ['step'], from: ['document', 'recording'], fill: 'A numbered procedure or a user story.' },
    { section: '4', title: 'Rules', kinds: ['rule'], from: ['document'], fill: 'A technical guide, standard, or specification.' },
    { section: '5', title: 'Records', kinds: ['record', 'field'], from: ['document', 'recording'], fill: 'A spreadsheet, API spec, or codebase.' },
    { section: '6', title: 'Versions', kinds: ['version'], from: ['document'], fill: 'A licence agreement or release note.' },
    { section: '7', title: 'Design', kinds: ['style'], from: ['recording'], fill: 'A captured session or a style guide.' },
    { section: '8', title: 'Links', kinds: ['url'], from: ['document'], fill: 'A reference directory.' },
  ],
}
