import { Crown, Medal, Swords, Trophy, Users } from 'lucide-react'
import type { BoardRow, WinsRow } from '@shared/types'
import { formatSeconds } from '@shared/time'

const TEXT = { sm: 'text-[1rem]', md: 'text-[1.2rem]', lg: 'text-[1.45rem]' } as const
type Size = keyof typeof TEXT

function Rank({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="grid size-[2.4em] place-items-center rounded-full bg-nc-yellow text-sky">
        <Crown className="size-[1.1em]" aria-label="1st" />
      </span>
    )
  }
  if (rank <= 3) {
    return (
      <span className="inline-flex h-[2.4em] min-w-[2.4em] items-center justify-center gap-0.5 rounded-full border-2 border-nc-blue-soft px-1.5 text-[0.9em] font-bold">
        <Medal className="size-[0.95em]" aria-hidden="true" />
        {rank}
      </span>
    )
  }
  return <span className="inline-block min-w-[2.4em] text-center font-bold text-white/70">{rank}</span>
}

const You = () => <span className="ml-2 rounded-md bg-sky px-1.5 py-0.5 text-[0.7em] font-extrabold tracking-wider text-nc-lime">YOU</span>

function Empty({ wins }: { wins?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-nc-blue-soft/35 px-5 py-10 text-center text-white/75">
      {wins ? <Swords className="size-8 text-nc-purple-soft" aria-hidden="true" /> : <Trophy className="size-8 text-nc-yellow" aria-hidden="true" />}
      {wins ? 'No battles won yet – start a Multiplayer Battle!' : 'No games yet – be the first!'}
    </div>
  )
}

function rowTone(rank: number, me: boolean, wins: boolean) {
  if (me) return 'bg-nc-lime text-sky'
  if (rank === 1) return wins ? 'bg-nc-purple/35' : 'bg-nc-yellow/12'
  return 'bg-white/[0.045]'
}

const th = 'px-3 pb-1 text-left text-[max(11px,0.72em)] font-bold uppercase tracking-[0.14em]'
const td = 'px-3 py-[0.55em] first:rounded-l-xl last:rounded-r-xl'

export function TimesTable({ rows, size = 'md', isMe, emptyText }: { rows: BoardRow[]; size?: Size; isMe?: (r: BoardRow) => boolean; emptyText?: string }) {
  if (!rows.length) {
    return emptyText ? (
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-nc-blue-soft/35 px-5 py-10 text-center text-white/75">
        <Trophy className="size-8 text-nc-yellow" aria-hidden="true" />
        {emptyText}
      </div>
    ) : (
      <Empty />
    )
  }
  return (
    <table className={`w-full border-separate border-spacing-y-[0.35em] ${TEXT[size]} phone:text-[1rem]`}>
      <thead>
        <tr className="text-nc-blue-soft">
          <th className={`${th} w-[3.5em]`}>Rank</th>
          <th className={th}>Name</th>
          <th className={`${th} phone:hidden`}>Project / OPU</th>
          <th className={`${th} text-right`}>Solved</th>
          <th className={`${th} text-right`}>Time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const mine = !!isMe?.(r)
          return (
            <tr key={r.player_key} className={rowTone(r.rank, mine, false)}>
              <td className={td}>
                <Rank rank={r.rank} />
              </td>
              <td className={`${td} font-semibold`}>
                <span className="break-words">{r.name}</span>
                {mine && <You />}
                <span className={`hidden text-[0.8em] font-normal phone:block ${mine ? 'text-sky/75' : 'text-white/60'}`}>{r.affiliation}</span>
              </td>
              <td className={`${td} phone:hidden ${mine ? 'text-sky/80' : 'text-white/75'}`}>{r.affiliation}</td>
              <td className={`${td} text-right tabular-nums`}>
                {r.solved}/6
              </td>
              <td className={`${td} whitespace-nowrap text-right font-display font-bold tabular-nums`}>{formatSeconds(r.time_ms)} s</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function WinsTable({ rows, size = 'md', isMe }: { rows: WinsRow[]; size?: Size; isMe?: (r: WinsRow) => boolean }) {
  if (!rows.length) return <Empty wins />
  return (
    <table className={`w-full border-separate border-spacing-y-[0.35em] ${TEXT[size]} phone:text-[1rem]`}>
      <thead>
        <tr className="text-nc-purple-soft">
          <th className={`${th} w-[3.5em]`}>Rank</th>
          <th className={th}>Name</th>
          <th className={`${th} phone:hidden`}>Project / OPU</th>
          <th className={`${th} text-right`}>
            <Users className="inline size-[1.2em]" aria-label="Wins" />
          </th>
          <th className={`${th} text-right`}>Best time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const mine = !!isMe?.(r)
          return (
            <tr key={r.player_key} className={rowTone(r.rank, mine, true)}>
              <td className={td}>
                <Rank rank={r.rank} />
              </td>
              <td className={`${td} font-semibold`}>
                {r.name}
                {mine && <You />}
                <span className={`hidden text-[0.8em] font-normal phone:block ${mine ? 'text-sky/75' : 'text-white/60'}`}>{r.affiliation}</span>
              </td>
              <td className={`${td} phone:hidden ${mine ? 'text-sky/80' : 'text-white/75'}`}>{r.affiliation}</td>
              <td className={`${td} text-right font-display font-bold tabular-nums`}>{r.wins}</td>
              <td className={`${td} whitespace-nowrap text-right font-display tabular-nums`}>{r.best_time_ms === null ? '—' : `${formatSeconds(r.best_time_ms)} s`}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
