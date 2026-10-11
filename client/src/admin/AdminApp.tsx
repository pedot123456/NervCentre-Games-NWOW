import { useEffect, useState, type ReactNode } from 'react'
import { BarChart3, Database, ExternalLink, FolderKanban, House, KeyRound, ListChecks, LogOut, MessageSquare, Puzzle, Radio, ScrollText, Settings, Trophy } from 'lucide-react'
import { pinPolicyError } from '@shared/admin'
import { PartnerLogos, PmxBrand } from '../components/Brand'
import { configStore } from '../lib/data'
import { readLocal, useStore, writeLocal } from '../lib/store'
import { api, ApiError, getToken, setToken } from './api'
import { ContentSettings, ContentSolutions } from './ContentTabs'
import { AuditTab, ExportsTab, ProjectsTab } from './DataTabs'
import { FeedbackTab } from './FeedbackTab'
import { BoardsTab, LiveTab, ResultsTab } from './GameTabs'
import { DashboardTab } from './InsightTabs'
import { Note } from './shared'

const goHome = () => {
  location.hash = '#/'
}

type Tab = 'dashboard' | 'feedback' | 'live' | 'results' | 'boards' | 'solutions' | 'settings' | 'projects' | 'data' | 'audit' | 'pin'

const NAV: { group: string; items: { id: Tab; label: string; icon: ReactNode }[] }[] = [
  {
    group: 'Insights',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 /> },
      { id: 'feedback', label: 'Feedback', icon: <MessageSquare /> },
    ],
  },
  {
    group: 'Event desk',
    items: [
      { id: 'live', label: 'Live races', icon: <Radio /> },
      { id: 'results', label: 'Results & players', icon: <ListChecks /> },
      { id: 'boards', label: 'Leaderboards', icon: <Trophy /> },
    ],
  },
  {
    group: 'Game',
    items: [
      { id: 'solutions', label: 'Solutions & decoys', icon: <Puzzle /> },
      { id: 'settings', label: 'Settings', icon: <Settings /> },
    ],
  },
  {
    group: 'Data',
    items: [
      { id: 'projects', label: 'Project names', icon: <FolderKanban /> },
      { id: 'data', label: 'Exports & data', icon: <Database /> },
      { id: 'audit', label: 'Audit log', icon: <ScrollText /> },
      { id: 'pin', label: 'Change PIN', icon: <KeyRound /> },
    ],
  },
]
const ALL = NAV.flatMap((g) => g.items)

export default function AdminApp() {
  const [token, setTok] = useState(getToken)
  const [mustChange, setMustChange] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const out = () => {
      setToken(null)
      setTok(null)
    }
    window.addEventListener('wr-admin-signed-out', out)
    return () => window.removeEventListener('wr-admin-signed-out', out)
  }, [])

  useEffect(() => {
    if (!token) return setChecked(true)
    api<{ must_change_pin: boolean }>('/api/admin/me')
      .then((me) => setMustChange(me.must_change_pin))
      .catch(() => undefined)
      .finally(() => setChecked(true))
  }, [token])

  const signedIn = (t: string, must: boolean) => {
    setToken(t)
    setTok(t)
    setMustChange(must)
  }
  const signOut = async () => {
    await api('/api/admin/logout', { json: {} }).catch(() => undefined)
    setToken(null)
    setTok(null)
  }

  if (!checked) return null
  if (!token) return <Login onSignedIn={signedIn} />
  if (mustChange) {
    return (
      <Backdrop>
        <div className="card w-full max-w-md p-7 shadow-2xl">
          <PinForm first onDone={() => setMustChange(false)} />
          <button type="button" className="btn btn-light mt-3 w-full" onClick={signOut}>
            Sign out
          </button>
        </div>
      </Backdrop>
    )
  }
  return <Shell onSignOut={signOut} />
}

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_120%_80%_at_30%_-10%,#20419a_0%,#13286a_45%,#0b1a47_100%)] p-4">
      <button type="button" className="btn btn-go absolute left-4 top-4 min-h-0 py-2.5 text-base" onClick={goHome}>
        <House className="size-4" aria-hidden="true" /> Back to Home
      </button>
      {children}
    </div>
  )
}

function Login({ onSignedIn }: { onSignedIn: (token: string, mustChange: boolean) => void }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (pin.length < 4 || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ token: string; must_change_pin: boolean }>('/api/admin/login', { json: { pin } })
      onSignedIn(res.token, res.must_change_pin)
    } catch (e) {
      setError((e as ApiError).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Backdrop>
      <form
        className="card w-full max-w-[24rem] rounded-2xl p-7 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="mb-5 flex justify-center rounded-xl bg-nc-blue px-4 py-3">
          <PartnerLogos size="sm" />
        </div>
        <h1 className="text-xl font-extrabold">PMX Digital Challenge · Admin</h1>
        <p className="mb-4 text-muted">Enter the Admin PIN.</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={12}
          autoFocus
          aria-label="Admin PIN"
          className="afield text-center text-2xl tracking-[0.5em]"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
        />
        {error && <p className="mt-2 text-sm font-semibold text-error">{error}</p>}
        <button type="submit" className="btn btn-admin mt-4 w-full" disabled={pin.length < 4 || busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <button type="button" className="btn btn-light mt-2 w-full" onClick={goHome}>
          <House className="size-4" aria-hidden="true" /> Back to Home
        </button>
      </form>
    </Backdrop>
  )
}

/** Change the Admin PIN (forced at the first sign-in). */
export function PinForm({ first = false, onDone }: { first?: boolean; onDone?: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 12)
  const save = async () => {
    setError(null)
    setOk(false)
    const problem = pinPolicyError(next)
    if (problem) return setError(problem)
    if (next !== again) return setError('The new PINs do not match.')
    try {
      await api('/api/admin/pin', { json: { current, next } })
      setOk(true)
      setCurrent('')
      setNext('')
      setAgain('')
      onDone?.()
    } catch (e) {
      setError((e as ApiError).message)
    }
  }
  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{label}</span>
      <input type="password" inputMode="numeric" maxLength={12} className="afield tracking-[0.3em]" value={value} onChange={(e) => set(digits(e.target.value))} />
    </label>
  )
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {first && (
        <>
          <h2 className="text-xl font-extrabold">Choose your own Admin PIN</h2>
          <p className="text-sm text-muted">The default PIN only works once. Pick a 6–12 digit PIN (no repeated digits or runs like 123456) and keep it with the booth lead.</p>
        </>
      )}
      {field('Current PIN', current, setCurrent)}
      {field('New PIN', next, setNext)}
      {field('New PIN again', again, setAgain)}
      {error && <Note tone="error">{error}</Note>}
      {ok && <Note tone="ok">PIN changed.</Note>}
      <button type="submit" className="btn btn-admin" disabled={!current || !next || !again}>
        Save PIN
      </button>
    </form>
  )
}

function Shell({ onSignOut }: { onSignOut: () => void }) {
  const config = useStore(configStore)
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = readLocal<Tab | null>('wr.admin.tab', null)
    return saved && ALL.some((i) => i.id === saved) ? saved : 'dashboard'
  })
  const setTab = (t: Tab) => {
    setTabState(t)
    writeLocal('wr.admin.tab', t)
    window.scrollTo?.(0, 0)
  }
  const current = ALL.find((i) => i.id === tab)!

  return (
    <div className="flex min-h-dvh max-md:flex-col">
      {/* Sidebar (≥ 768 px) */}
      <aside className="sticky top-0 flex h-dvh w-[240px] shrink-0 flex-col gap-4 bg-nc-blue p-4 text-white max-md:hidden">
        <PmxBrand compact />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-nc-lime">Admin</p>
        <button type="button" className="btn btn-go min-h-0 py-2.5 text-base" onClick={goHome}>
          <House className="size-4" aria-hidden="true" /> Back to Home
        </button>
        <nav className="flex flex-col gap-3 overflow-y-auto">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{g.group}</p>
              {g.items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  aria-current={tab === i.id ? 'page' : undefined}
                  onClick={() => setTab(i.id)}
                  className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-semibold [&>svg]:size-4 ${tab === i.id ? 'bg-nc-lime text-sky' : 'text-white/85 hover:bg-white/10'}`}
                  data-testid={`${i.id}-tab`}
                >
                  {i.icon}
                  {i.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 text-sm">
          <a href="#/display" target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg p-2 font-semibold text-white/85 hover:bg-white/10">
            <ExternalLink className="size-4" aria-hidden="true" /> TV display
          </a>
          <button type="button" className="flex items-center gap-2 rounded-lg p-2 text-left font-semibold text-white/85 hover:bg-white/10" onClick={onSignOut}>
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
          <p className="px-2 text-[11px] text-white/40">v{config?.version ?? '1.0.0'}</p>
        </div>
      </aside>

      {/* Top bar (< 768 px) */}
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-nc-blue p-2 text-white md:hidden">
        <button type="button" className="btn btn-go min-h-11 px-3" aria-label="Back to Home" onClick={goHome}>
          <House className="size-5" />
        </button>
        <select className="afield flex-1 !text-text" value={tab} onChange={(e) => setTab(e.target.value as Tab)} aria-label="Section">
          {NAV.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" className="btn btn-light min-h-11 px-3" aria-label="Sign out" onClick={onSignOut}>
          <LogOut className="size-5" />
        </button>
      </div>

      <main className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-5 p-5 md:p-7">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-nc-blue">{current.label}</h1>
          <button type="button" className="btn btn-light min-h-0 py-2.5 text-base max-md:hidden" onClick={goHome}>
            <House className="size-4" aria-hidden="true" /> Back to Home
          </button>
        </div>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'live' && <LiveTab />}
        {tab === 'results' && <ResultsTab />}
        {tab === 'boards' && <BoardsTab />}
        {tab === 'solutions' && <ContentSolutions />}
        {tab === 'settings' && <ContentSettings />}
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'data' && <ExportsTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'pin' && (
          <section className="card max-w-md p-6">
            <PinForm />
          </section>
        )}
      </main>
    </div>
  )
}
