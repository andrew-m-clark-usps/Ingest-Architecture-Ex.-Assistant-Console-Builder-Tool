import { Layout } from './Layout'
import { AppRouter } from './components/AppRouter'

// DEMO/REFERENCE SCAFFOLD -- ../Console.md section 4: Layout mounts the
// theme/shell once; AppRouter declares every route in one file.
export function App() {
  return (
    <Layout>
      <AppRouter />
    </Layout>
  )
}
