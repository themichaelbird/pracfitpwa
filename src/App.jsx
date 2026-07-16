import { supabase } from './lib/supabaseClient'

function App() {
  const configured = Boolean(supabase)

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Practical Fitness Coach Platform
        </h1>
        <p className="text-slate-600">
          Scaffold only — session logging UI is out of scope until Week 5+.
        </p>
        <p className="text-sm text-slate-500">
          Supabase client: {configured ? 'configured' : 'missing env vars'}
        </p>
      </div>
    </div>
  )
}

export default App
