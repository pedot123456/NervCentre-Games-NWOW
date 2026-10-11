import { useEffect, useRef, useState } from 'react'
import { ArrowRight, House, ListOrdered, Trophy, Users } from 'lucide-react'
import type { BoardRow, RunResult, WinsRow } from '@shared/types'
import { nameKey } from '@shared/validation'
import { TimesTable, WinsTable } from '../components/Boards'
import { FeedbackForm } from '../components/Feedback'
import { ResultsView } from '../components/Results'
import { IdleHint } from '../components/ui'
import { boardsStore, configStore, refreshBoards } from '../lib/data'
import { useIdle, useIsPhone } from '../lib/hooks'
import { fetchFeedbackStatus, fetchResult } from '../lib/results'
import { connectionStore } from '../lib/socket'
import { useStore } from '../lib/store'
import type { Seat } from '../lib/useRun'
import { KioskFrame } from './Frame'

type SeatRef = Pick<Seat, 'run_id' | 'token'>

/** "Saving your score…" until the server has it; then the questions (or straight on if answered today). */
export function FeedbackStep({ seat, who, onDone, onIdle, onAdmin }: { seat: SeatRef; who?: string; onDone: () => void; onIdle: () => void; onAdmin?: () => void }) {
  const config = useStore(configStore)
  const phone = useIsPhone()
  const [required, setRequired] = useState<boolean | null>(null)
  // A kiosk left alone goes back Home (the score is already saved). Phones never time out.
  useIdle((config?.settings.idle_seconds ?? 30) * 3, onIdle, !phone)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const signal = { cancelled: false }
    void fetchFeedbackStatus(seat, signal).then((s) => {
      if (signal.cancelled) return
      if (!s || !s.required) done.current()
      else setRequired(true)
    })
    return () => {
      signal.cancelled = true
    }
  }, [seat.run_id, seat.token])

  return (
    <KioskFrame onAdmin={onAdmin} scroll>
      {required === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4" data-testid="feedback">
          <span className="size-[2.2rem] animate-spin rounded-full border-4 border-nc-blue-soft/30 border-t-nc-blue-soft" aria-hidden="true" />
          <p className="font-display text-[1.6rem] font-bold text-nc-blue-soft">Saving your score…</p>
        </div>
      ) : phone ? (
        <div className="fb-page -mx-4 -mb-[1.4rem] flex-1 px-4 pt-4" data-testid="feedback">
          <div className="mx-auto max-w-[34rem]">
            <FeedbackForm seat={seat} who={who} phone onDone={onDone} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-start justify-center pb-4" data-testid="feedback">
          <div className="fb-page w-full max-w-[64rem] rounded-[1.5rem] p-6 shadow-[0_1.6rem_3.5rem_-1.4rem_rgb(0_0_0/0.65)]">
            <FeedbackForm seat={seat} who={who} onDone={onDone} />
          </div>
        </div>
      )}
    </KioskFrame>
  )
}

/** Loads the result card (retries while the server finishes the run, and while offline). */
export function useResult(seat: SeatRef | null) {
  const [result, setResult] = useState<RunResult | null>(null)
  useEffect(() => {
    if (!seat) return
    const signal = { cancelled: false }
    void fetchResult(seat, signal).then((r) => {
      if (!signal.cancelled && r) setResult(r)
    })
    void refreshBoards()
    return () => {
      signal.cancelled = true
    }
  }, [seat])
  return result
}

export function ResultsLoading() {
  const conn = useStore(connectionStore)
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="font-display text-[2rem] text-nc-blue-soft">{conn === 'offline' ? 'Waiting for the connection to the game server…' : 'Loading your results…'}</p>
    </div>
  )
}

/** Solo results ("Well played, …!"). */
export function ResultsScreen({ seat, onLeaderboard, onHome, onAdmin }: { seat: SeatRef; onLeaderboard: () => void; onHome: () => void; onAdmin?: () => void }) {
  const config = useStore(configStore)
  const result = useResult(seat)
  const idle = useIdle(config?.settings.idle_seconds ?? 30, onHome)
  const first = result?.name.split(' ')[0] ?? ''
  return (
    <KioskFrame title="Your results" onHome={onHome} onAdmin={onAdmin} scroll>
      {!result ? (
        <ResultsLoading />
      ) : (
        <div className="flex flex-1 flex-col">
          <h2 className="mb-4 font-display text-[3rem] font-bold phone:text-[1.9rem]">Well played, {first}!</h2>
          <ResultsView result={result} />
          <Footer idle={idle}>
            <button type="button" className="btn btn-go btn-xl" onClick={onLeaderboard}>
              <ListOrdered className="size-[1em]" aria-hidden="true" /> Leaderboard <ArrowRight className="size-[1em]" aria-hidden="true" />
            </button>
          </Footer>
        </div>
      )}
    </KioskFrame>
  )
}

export function Footer({ idle, children }: { idle: number; children: React.ReactNode }) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5">
      <IdleHint seconds={idle} />
      <div className="flex flex-wrap gap-3 phone:w-full [&>*]:phone:flex-1">{children}</div>
    </div>
  )
}

export type BoardTab = 'today' | 'all' | 'wins'

/** Who to highlight with "YOU": this game's player(s). */
export interface Me {
  run_ids: string[]
  people: { name: string; affiliation: string }[]
}

export function meMatcher(me: Me | null) {
  const keys = new Set(me?.people.map((p) => `${nameKey(p.name)}|${p.affiliation.trim().toLowerCase()}`) ?? [])
  return (r: BoardRow | WinsRow) => {
    if (!me) return false
    if ('run_id' in r && me.run_ids.includes(r.run_id)) return true
    return keys.has(`${nameKey(r.name)}|${r.affiliation.trim().toLowerCase()}`)
  }
}

export function LeaderboardScreen({ initial = 'today', me, onBack, onHome, onAdmin }: { initial?: BoardTab; me: Me | null; onBack: () => void; onHome: () => void; onAdmin?: () => void }) {
  const config = useStore(configStore)
  const boards = useStore(boardsStore)
  const phone = useIsPhone()
  const [tab, setTab] = useState<BoardTab>(initial)
  const idle = useIdle(config?.settings.idle_seconds ?? 30, onHome)
  useEffect(() => {
    void refreshBoards()
  }, [])
  const isMe = meMatcher(me)
  const tabs: { id: BoardTab; label: string; short: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Fastest today', short: 'Today', icon: <Trophy className="size-[1.1em]" aria-hidden="true" /> },
    { id: 'all', label: 'All-time', short: 'All-time', icon: <ListOrdered className="size-[1.1em]" aria-hidden="true" /> },
    { id: 'wins', label: 'Multiplayer wins', short: 'Wins', icon: <Users className="size-[1.1em]" aria-hidden="true" /> },
  ]
  return (
    <KioskFrame
      title="Leaderboard"
      onBack={onBack}
      onHome={onHome}
      onAdmin={onAdmin}
      scroll
      right={
        <div className="flex gap-2 phone:w-full" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`btn phone:flex-1 phone:px-2 ${tab === t.id ? (t.id === 'wins' ? 'btn-purple' : 'btn-go') : 'btn-ghost'}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              {phone ? t.short : t.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-1 flex-col">
        {tab === 'wins' ? (
          <div className="grid grid-cols-2 gap-6 phone:grid-cols-1 portrait:grid-cols-1">
            <section>
              <p className="label mb-2 !text-nc-purple-soft">Today</p>
              <WinsTable rows={boards?.wins_today ?? []} size="md" isMe={isMe} />
            </section>
            <section>
              <p className="label mb-2 !text-nc-purple-soft">All-time</p>
              <WinsTable rows={boards?.wins_all_time ?? []} size="md" isMe={isMe} />
            </section>
          </div>
        ) : (
          <TimesTable rows={(tab === 'today' ? boards?.today : boards?.all_time) ?? []} size="lg" isMe={isMe} />
        )}
        <Footer idle={idle}>
          <button type="button" className="btn btn-go btn-xl" onClick={onHome}>
            <House className="size-[1em]" aria-hidden="true" /> Back to Home
          </button>
        </Footer>
      </div>
    </KioskFrame>
  )
}
