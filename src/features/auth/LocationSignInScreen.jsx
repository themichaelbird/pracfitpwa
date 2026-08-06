import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// One-time-per-device sign-in with a location's shared Supabase Auth
// account (see supabase/README.md, Option B). The resulting session
// persists via supabase-js (localStorage), so this screen only reappears
// if the device is signed out or the session is cleared.
export function LocationSignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="max-w-md text-center text-slate-600">
          Supabase client not configured — missing env vars.
        </p>
      </div>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)
    if (signInError) {
      setError(signInError.message)
    }
    // On success, useSupabaseSession's onAuthStateChange listener updates
    // the session and the app moves on — no local success handling needed.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Location Sign-In
          </h1>
          <p className="text-slate-600">
            Sign in with this location's shared account. This is a one-time
            step for this device.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="location-email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="location-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-14 w-full rounded-xl border border-slate-300 px-4 text-lg text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="location-password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="location-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-14 w-full rounded-xl border border-slate-300 px-4 text-lg text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
