import { useEffect, useState, type KeyboardEvent } from 'react'
import { Check, CheckCircle2, Hourglass, Lightbulb, SkipForward, Sparkles, X } from 'lucide-react'
import { canSkip } from '@shared/game'
import type { Puzzle, RunProgress } from '@shared/types'
import { formatSeconds } from '@shared/time'
import type { Flash } from '../lib/useRun'

export type BoardSize = 'wide' | 'half' | 'phone'

const SIZES: Record<BoardSize, { clue: string; clueText: string; tile: string; letter: string; gap: string; slot: string; letterSlot: string; skip: string }> = {
  wide: {
    clue: 'p-[1.8rem]',
    clueText: 'text-[2.5rem]',
    tile: 'min-h-[6.2rem] text-[2.3rem] px-[1.3em] rounded-[1.2rem]',
    letter: 'min-h-[6.2rem] min-w-[6.2rem] text-[2.3rem] rounded-[1.2rem]',
    gap: 'gap-[1.3rem]',
    slot: 'text-[2rem] min-h-[4.4rem]',
    letterSlot: 'text-[2rem] min-h-[4.4rem]',
    skip: 'min-h-[4.4rem] px-8 text-[1.5rem]',
  },
  half: {
    clue: 'p-[1.1rem]',
    clueText: 'text-[1.6rem]',
    tile: 'min-h-[max(56px,4rem)] text-[1.35rem] px-[0.9em]',
    letter: 'min-h-[max(56px,4rem)] min-w-[max(56px,4rem)] text-[1.35rem]',
    gap: 'gap-[0.7rem]',
    slot: 'text-[1.3rem] min-h-12',
    letterSlot: 'text-[1.3rem] min-h-12',
    skip: 'min-h-[max(56px,3.8rem)] text-[1.25rem]',
  },
  phone: {
    clue: 'p-4',
    clueText: 'text-[1.25rem]',
    tile: 'min-h-[56px] text-[1.15rem] px-[0.85em]',
    letter: 'min-h-[56px] min-w-[56px] text-[1.15rem]',
    gap: 'gap-2',
    slot: 'text-[1.05rem] min-h-[2.6rem]',
    letterSlot: 'text-[1.05rem] min-h-[2.6rem]',
    skip: '',
  },
}

interface Props {
  puzzles: Puzzle[]
  progress: RunProgress | null
  started: boolean
  onTap: (tileId: string) => void
  onSkip: () => void
  flash: Flash | null
  wrongTile: { id: string; key: number } | null
  size?: BoardSize
  skipPenaltyMs: number
  /** Head-to-Head: "Waiting for the other player…" under the run-over message. */
  waitingOther?: boolean
  className?: string
}

/** Clue, answer slots, word tiles and Skip, with the solved / penalty flashes over the board. */
export function PuzzleBoard({ puzzles, progress, started, onTap, onSkip, flash, wrongTile, size = 'wide', skipPenaltyMs, waitingOther, className = '' }: Props) {
  const s = SIZES[size]
  const ended = !!progress?.ended
  const current = progress && !ended ? progress.queue[0] : undefined
  const puzzle = current !== undefined ? puzzles[current] : undefined
  const total = puzzles.length || 6
  const solved = progress?.solved.length ?? 0
  const n = ended ? solved : Math.min(solved + 1, total)

  // A wrong tile shakes red for 450 ms.
  const [shaking, setShaking] = useState<string | null>(null)
  useEffect(() => {
    if (!wrongTile) return
    setShaking(wrongTile.id)
    const t = setTimeout(() => setShaking(null), 450)
    return () => clearTimeout(t)
  }, [wrongTile])

  // Flashes: solved (900 ms), penalty / time up (1.1 s).
  const [shown, setShown] = useState<Flash | null>(null)
  useEffect(() => {
    if (!flash) return
    setShown(flash)
    const t = setTimeout(() => setShown(null), flash.kind === 'solved' ? 900 : 1100)
    return () => clearTimeout(t)
  }, [flash])

  const clue = !started ? 'Get ready…' : ended ? 'Round complete' : (puzzle?.clue ?? '')
  const isLetters = puzzle?.answer.some((a) => a.text.length === 1 && puzzle.tiles.some((t) => t.kind === 'letter' && t.text === a.text)) ?? false

  // Answer slots: one per word, or one per letter in Hard Mode.
  const slots: { text: string; placed: boolean; next: boolean; letter: boolean; word: number }[] = []
  if (puzzle && progress) {
    puzzle.answer.forEach((tok, i) => {
      const letterTok = puzzle.tiles.some((t) => t.kind === 'letter' && t.text === tok.text) && tok.text.length === 1
      slots.push({ text: tok.text, placed: i < progress.progress, next: i === progress.progress, letter: letterTok, word: tok.word })
    })
  }
  const words: (typeof slots)[] = []
  for (const sl of slots) (words[sl.word] ??= []).push(sl)

  const used = new Set(progress?.used ?? [])
  const keyTap = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onTap(id)
    }
  }
  const skippable = started && !!progress && canSkip(progress)

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col gap-4 ${className}`} data-letters={isLetters || undefined}>
      <section className={`panel ${s.clue}`}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="label flex items-center gap-1.5 !text-nc-lime">
            <Lightbulb className="size-4" aria-hidden="true" /> Clue
          </span>
          <span className="label flex items-center gap-1.5">
            <Sparkles className="size-4 text-nc-purple-soft" aria-hidden="true" /> {n} of {total}
          </span>
        </div>
        <p className={`font-display font-semibold leading-snug ${s.clueText}`} aria-live="polite">
          {clue}
        </p>
        {started && !ended && puzzle && (
          <div className="mt-4 flex flex-wrap gap-4" aria-label="Answer">
            {words.map((w, wi) => (
              <div key={wi} className="flex gap-1.5">
                {w.map((sl, i) => {
                  const state = sl.placed ? 'border-nc-lime bg-nc-lime text-sky' : sl.next ? 'animate-pulse-soft border-nc-lime/80' : 'border-dashed border-nc-blue-soft/40'
                  return (
                    <span
                      key={i}
                      className={`grid place-items-center rounded-lg border-2 font-display font-bold ${sl.letter ? `min-w-[2.6em] ${s.letterSlot}` : `min-w-[5.5em] px-3 ${s.slot}`} ${state}`}
                    >
                      {sl.placed ? sl.text : sl.next ? <span className="text-white/40">{sl.letter ? '?' : '·'}</span> : null}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={`flex flex-1 flex-wrap content-center items-center justify-center ${s.gap} phone:content-start`} data-testid="tiles">
        {started &&
          !ended &&
          puzzle &&
          puzzle.tiles.map((t) => {
            const isUsed = used.has(t.id)
            const wrong = shaking === t.id
            return (
              <button
                key={`${current}-${t.id}`}
                type="button"
                disabled={isUsed}
                className={`tile ${t.kind === 'letter' ? `tile-letter ${s.letter}` : s.tile} ${isUsed ? 'tile-used' : ''} ${wrong ? 'tile-wrong animate-shake' : ''}`}
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return
                  e.preventDefault()
                  onTap(t.id)
                }}
                onKeyDown={keyTap(t.id)}
                aria-label={t.text}
              >
                {wrong && <X className="size-[0.8em]" strokeWidth={3} aria-hidden="true" />}
                {t.text}
              </button>
            )
          })}
      </div>

      <div className="flex justify-center">
        <button type="button" className={`btn btn-ghost ${s.skip}`} disabled={!skippable} onClick={onSkip}>
          <SkipForward className="size-[1.2em]" aria-hidden="true" />
          Skip
          <span className="rounded-md bg-nc-red/80 px-1.5 py-0.5 text-[0.85em] font-bold text-white">+{skipPenaltyMs / 1000} s</span>
        </button>
      </div>

      {/* Flashes */}
      {shown?.kind === 'solved' && (
        <div key={shown.key} className="pointer-events-none absolute inset-x-0 top-[38%] z-20 flex justify-center" aria-live="polite">
          <div className="flex animate-pop items-center gap-2 rounded-2xl bg-nc-green px-6 py-3 font-display text-[1.8rem] font-bold text-white shadow-[0_0_40px_rgba(0,161,156,0.7)] phone:text-[1.3rem]">
            <Check className="size-[1em]" strokeWidth={3} aria-hidden="true" /> {shown.name}
          </div>
        </div>
      )}
      {shown?.kind === 'penalty' && (
        <div key={shown.key} className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center" aria-live="polite">
          <div className="flex animate-float-up items-center gap-2 rounded-xl bg-nc-red px-4 py-2 font-display text-[1.5rem] font-bold text-white phone:text-[1.15rem]">
            <X className="size-[1em]" strokeWidth={3} aria-hidden="true" /> {shown.text}
          </div>
        </div>
      )}

      {ended && progress && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-sky/70 text-center backdrop-blur-[2px]">
          {progress.ended === 'finished' ? <CheckCircle2 className="size-16 text-nc-green-soft" aria-hidden="true" /> : <Hourglass className="size-16 text-nc-red-soft" aria-hidden="true" />}
          <p className="font-display text-[3rem] font-bold phone:text-[2rem]">{progress.ended === 'finished' ? 'All stars lit!' : "Time's up!"}</p>
          {progress.ended === 'finished' && progress.finish_ms !== null && <p className="font-display text-[2rem] font-bold text-nc-yellow">{formatSeconds(progress.finish_ms)} s</p>}
          {waitingOther && <p className="text-[1.2rem] text-white/70">Waiting for the other player…</p>}
        </div>
      )}
    </div>
  )
}
