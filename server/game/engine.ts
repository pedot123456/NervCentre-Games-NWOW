import { createHash, randomBytes, randomInt } from 'node:crypto'
import { affiliationKey } from '@shared/affiliation'
import { applySkip, applyTap, compareRuns, createProgress, deadlineAt, rankingTimeMs, timeUp } from '@shared/game'
import type { TapResult } from '@shared/protocol'
import { buildPuzzles } from '@shared/puzzle'
import { uuid } from '@shared/random'
import { COUNTDOWN_MS, MAX_BATTLE_PLAYERS } from '@shared/seed'
import type { GameMode, GameRules, RaceState, RunProgress, RunPublic, Settings } from '@shared/types'
import { affiliationOf, checkRegistration, nameKey, type PlayerInput, type Registration } from '@shared/validation'
import { Store, type RaceRecord, type RunRecord } from '../db/store'
import { GameError } from '../services/errors'

/**
 * The race engine, built for serverless hosting: nothing is kept in memory between requests.
 * Every action locks the race row, first "settles" the race (applies everything that should have
 * happened by now – GO, runs running out of time, the end of the race, idle lobbies closing), then
 * applies the action with the server's own clock and saves. Devices poll the race state.
 */

/** A device counts as connected when it polled within this time. */
export const CONNECTED_MS = 8000
/** Finished races stay in the live list this long (the "just finished" panel on the TV). */
export const JUST_FINISHED_MS = 90_000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const newToken = () => randomBytes(24).toString('base64url')

const NOT_FOUND = () => new GameError('not_found', 'This game was not found – it may have ended.')
const FORBIDDEN = () => new GameError('forbidden', 'This device is not part of this game.')

const maxPlayers = (mode: GameMode) => (mode === 'battle' ? MAX_BATTLE_PLAYERS : mode === 'h2h' ? 2 : 1)

function rulesFrom(s: Settings): GameRules {
  return { limit_ms: s.timer_seconds * 1000, wrong_penalty_ms: s.wrong_penalty_ms, skip_penalty_ms: s.skip_penalty_ms, hard_mode: s.hard_mode }
}

export class RaceEngine {
  constructor(
    private readonly store: Store,
    private readonly clock: () => number = Date.now,
  ) {}

  now() {
    return this.clock()
  }

  // ── Starting games ──────────────────────────────────────────────────────

  /** Solo Rush: creates the race and starts the 3-2-1 straight away. */
  async startSolo(player: PlayerInput, kioskId: string): Promise<{ race: RaceState; run_id: string; token: string }> {
    return this.store.db.transaction(async (tx) => {
      const s = new Store(tx)
      const settings = await s.getSettings()
      const reg = this.register(player, settings)
      const now = this.clock()
      const race = await this.newRace(s, settings, 'solo', kioskId, now, true)
      const { run, token } = await this.newRun(s, race, reg, 0, null, now)
      return { race: this.toState(race, [run], now), run_id: run.id, token }
    })
  }

  /** Head-to-Head on one screen: two runs in one race, both played on this kiosk. */
  async startH2H(players: PlayerInput[], kioskId: string): Promise<{ race: RaceState; host_token: string; runs: { run_id: string; token: string }[] }> {
    return this.store.db.transaction(async (tx) => {
      const s = new Store(tx)
      const settings = await s.getSettings()
      const regs = players.map((p) => this.register(p, settings))
      const now = this.clock()
      const hostToken = newToken()
      const race = await this.newRace(s, settings, 'h2h', kioskId, now, true, hostToken)
      const created: RunRecord[] = []
      const out: { run_id: string; token: string }[] = []
      for (const [lane, reg] of regs.entries()) {
        const { run, token } = await this.newRun(s, race, reg, lane, null, now)
        created.push(run)
        out.push({ run_id: run.id, token })
      }
      return { race: this.toState(race, created, now), host_token: hostToken, runs: out }
    })
  }

  /** Multiplayer Battle lobby on the big screen (one open lobby per kiosk). */
  async createRoom(kioskId: string): Promise<{ race: RaceState; host_token: string }> {
    for (const id of await this.store.openLobbiesForKiosk(kioskId)) {
      await this.inRace(id, async (s, race, _runs, now) => {
        if (race.status !== 'lobby') return
        race.status = 'cancelled'
        race.ended_at = now
        await s.updateRace(race)
      })
    }
    return this.store.db.transaction(async (tx) => {
      const s = new Store(tx)
      const settings = await s.getSettings()
      const now = this.clock()
      const used = await s.openRoomCodes()
      let code = ''
      for (let i = 0; i < 200 && (!code || used.has(code)); i++) code = String(randomInt(1000, 10000))
      const hostToken = newToken()
      const race = await this.newRace(s, settings, 'battle', kioskId, now, false, hostToken, code)
      return { race: this.toState(race, [], now), host_token: hostToken }
    })
  }

  async joinRoom(code: string, player: PlayerInput, deviceId: string): Promise<{ race: RaceState; run_id: string; token: string }> {
    const settings = await this.store.getSettings()
    const reg = this.register(player, settings)
    const found = /^\d{4}$/.test(code) ? await this.store.lobbyByCode(code) : null
    if (!found) throw new GameError('room_not_found', 'Room not found. Check the 4-digit code on the big screen.')
    return this.inRace(found.id, async (s, race, runs, now) => {
      if (race.status === 'cancelled') throw new GameError('room_not_found', 'Room not found. Check the 4-digit code on the big screen.')
      if (race.status !== 'lobby') throw new GameError('room_started', 'This battle has already started. Wait for the next room.')
      // The same phone joining again replaces its earlier seat.
      for (const r of runs) {
        if (r.device_id === deviceId && r.status !== 'left') {
          r.status = 'left'
          await s.saveRun(r)
        }
      }
      const active = runs.filter((r) => r.status !== 'left')
      if (active.length >= MAX_BATTLE_PLAYERS) throw new GameError('room_full', `This room is full (${MAX_BATTLE_PLAYERS} players). Wait for the next room.`)
      const taken = new Set(active.map((r) => r.lane))
      const lane = [0, 1, 2, 3].find((l) => !taken.has(l)) ?? active.length
      const { run, token } = await this.newRun(s, race, reg, lane, deviceId, now)
      race.activity_at = now
      await s.updateRace(race)
      return { race: this.toState(race, [...runs, run], now), run_id: run.id, token }
    })
  }

  async leaveRoom(raceId: string, runId: string, token: string): Promise<void> {
    await this.inRace(raceId, async (s, race, runs, now) => {
      const run = this.ownRun(runs, runId, token)
      if (race.status !== 'lobby' || run.status === 'left') return
      run.status = 'left'
      race.activity_at = now
      await s.saveRun(run)
      await s.updateRace(race)
    })
  }

  async kick(raceId: string, hostToken: string, runId: string): Promise<void> {
    await this.inRace(raceId, async (s, race, runs, now) => {
      this.checkHost(race, hostToken)
      const run = runs.find((r) => r.id === runId)
      if (!run || race.status !== 'lobby' || run.status === 'left') return
      run.status = 'left'
      run.kicked = true
      race.activity_at = now
      await s.saveRun(run)
      await s.updateRace(race)
    })
  }

  /** Lobby → How to Play (everyone together) → 3-2-1 → GO. Needs at least 2 players. */
  async startRoom(raceId: string, hostToken: string): Promise<{ race: RaceState }> {
    return this.inRace(raceId, async (s, race, runs, now) => {
      this.checkHost(race, hostToken)
      if (race.status !== 'lobby') throw new GameError('room_started', 'This battle has already started.')
      const active = runs.filter((r) => r.status !== 'left')
      if (active.length < 2) throw new GameError('need_players', 'Need at least 2 players.')
      const settings = await s.getSettings()
      race.rules = rulesFrom(settings)
      race.puzzles = await this.puzzlesFor(s, settings, race.id)
      race.howto_ends_at = now + settings.howto_seconds * 1000
      race.go_at = race.howto_ends_at + COUNTDOWN_MS
      race.status = settings.howto_seconds > 0 ? 'howto' : 'running'
      race.is_test = settings.rehearsal_mode
      for (const r of active) {
        r.progress = createProgress(race.puzzles.length)
        r.is_test = race.is_test
        await s.saveRun(r)
      }
      // saveRun does not store is_test (it never changes after a game) – set it here for the lobby runs.
      await s.db.query('UPDATE runs SET is_test = $2 WHERE race_id = $1', [race.id, race.is_test])
      await s.updateRace(race)
      return { race: this.toState(race, runs, now) }
    })
  }

  async cancelRoom(raceId: string, hostToken: string): Promise<void> {
    await this.inRace(raceId, async (s, race, _runs, now) => {
      this.checkHost(race, hostToken)
      if (race.status !== 'lobby') return
      race.status = 'cancelled'
      race.ended_at = now
      await s.updateRace(race)
    })
  }

  // ── Watching (polling) ──────────────────────────────────────────────────

  /**
   * The race state for a device. A run token marks that player as connected (and checks the seat);
   * a host token marks the kiosk that owns the race as connected.
   */
  async watch(p: { race_id: string; run_id?: string; token?: string; host_token?: string }): Promise<{ race: RaceState; run_id: string | null; host: boolean }> {
    return this.inRace(p.race_id, async (s, race, runs, now) => {
      let runId: string | null = null
      let host = false
      if (p.run_id) {
        const run = runs.find((r) => r.id === p.run_id)
        if (!run || !p.token || run.token_hash !== hashToken(p.token)) throw FORBIDDEN()
        if (run.kicked) throw new GameError('removed', 'You were removed from the room by the host.')
        if (!run.last_seen_at || now - run.last_seen_at > 2000) {
          run.last_seen_at = now
          await s.touchRuns([run.id], now)
        }
        runId = run.id
      }
      if (p.host_token) {
        this.checkHost(race, p.host_token)
        host = true
        if (!race.host_seen_at || now - race.host_seen_at > 2000) {
          race.host_seen_at = now
          await s.touchHost(race.id, now)
          // Head-to-Head players play on the host kiosk.
          if (race.mode === 'h2h') {
            for (const r of runs) r.last_seen_at = now
            await s.touchRuns(
              runs.map((r) => r.id),
              now,
            )
          }
        }
      }
      return { race: this.toState(race, runs, now), run_id: runId, host }
    })
  }

  /** Open races plus races that just finished (TV display, attract screens, Admin). */
  async liveStates(): Promise<RaceState[]> {
    const now = this.clock()
    const races = await this.store.liveRaces(now - JUST_FINISHED_MS)
    const out: RaceState[] = []
    for (const r of races) {
      if (this.needsSettling(r, now)) {
        try {
          await this.inRace(r.id, async () => undefined)
        } catch {
          /* settled by someone else or gone – read it as it is */
        }
      }
    }
    const fresh = await this.store.liveRaces(now - JUST_FINISHED_MS)
    const runs = await this.store.runsForRaces(fresh.map((r) => r.id))
    for (const race of fresh) {
      if (race.status === 'cancelled') continue
      out.push(this.toState(race, runs.filter((x) => x.race_id === race.id), now))
    }
    return out
  }

  /** Settles open races nobody is polling (e.g. a kiosk that was closed mid-race). Cheap when nothing is due. */
  async sweep(): Promise<void> {
    const now = this.clock()
    for (const r of await this.store.openRaces()) {
      if (!this.needsSettling(r, now)) continue
      try {
        await this.inRace(r.id, async () => undefined)
      } catch {
        /* ignore */
      }
    }
  }

  // ── Playing ─────────────────────────────────────────────────────────────

  async tap(p: { race_id: string; run_id: string; token: string; puzzle: number; tile: string }): Promise<TapResult> {
    return this.play(p, (progress, race, elapsed) => applyTap(progress, race.puzzles, race.rules, p.puzzle, p.tile, elapsed))
  }

  async skip(p: { race_id: string; run_id: string; token: string; puzzle: number }): Promise<TapResult> {
    return this.play(p, (progress, race, elapsed) => applySkip(progress, race.rules, p.puzzle, elapsed))
  }

  private async play(
    p: { race_id: string; run_id: string; token: string },
    step: (progress: RunProgress, race: RaceRecord, elapsed: number) => { progress: RunProgress; outcome: TapResult['outcome'] },
  ): Promise<TapResult> {
    return this.inRace(p.race_id, async (s, race, runs, now) => {
      const run = this.ownRun(runs, p.run_id, p.token)
      if (race.status === 'lobby' || race.status === 'howto' || race.go_at === null || now < race.go_at) {
        throw new GameError('too_early', 'The race has not started yet.')
      }
      if (run.status !== 'playing') return { outcome: 'ignored', progress: run.progress, status: run.status }
      const res = step(run.progress, race, now - race.go_at)
      if (res.outcome === 'ignored') return { outcome: res.outcome, progress: run.progress, status: run.status }
      this.applyProgress(run, res.progress)
      run.last_seen_at = now
      if (res.progress.ended) this.endRun(race, run, Math.min(now, deadlineAt(res.progress, race.rules, race.go_at)))
      await s.saveRun(run)
      await this.maybeFinish(s, race, runs, now)
      return { outcome: res.outcome, progress: run.progress, status: run.status }
    })
  }

  // ── Admin ───────────────────────────────────────────────────────────────

  /** Stops a race: open runs end with what they have; a lobby closes. */
  async adminStop(raceId: string): Promise<void> {
    await this.inRace(raceId, async (s, race, runs, now) => {
      if (race.status === 'lobby') {
        race.status = 'cancelled'
        race.ended_at = now
        await s.updateRace(race)
        return
      }
      if (race.status !== 'howto' && race.status !== 'running') return
      for (const run of runs) {
        if (run.status !== 'waiting' && run.status !== 'playing') continue
        this.applyProgress(run, timeUp(run.progress))
        this.endRun(race, run, now)
        await s.saveRun(run)
      }
      await this.maybeFinish(s, race, runs, now, true)
    })
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /** Runs `fn` with the race row locked, after settling the race. */
  private async inRace<T>(raceId: string, fn: (s: Store, race: RaceRecord, runs: RunRecord[], now: number) => Promise<T>): Promise<T> {
    if (!UUID.test(raceId)) throw NOT_FOUND()
    return this.store.db.transaction(async (tx) => {
      const s = new Store(tx)
      const race = await s.lockRace(raceId)
      if (!race) throw NOT_FOUND()
      const runs = await s.runsForRace(raceId)
      const now = this.clock()
      await this.settle(s, race, runs, now)
      return fn(s, race, runs, now)
    })
  }

  private needsSettling(r: RaceRecord, now: number): boolean {
    if (r.status === 'lobby') return now - r.activity_at > 60_000
    if (r.status === 'howto') return r.howto_ends_at !== null && now >= r.howto_ends_at
    if (r.status === 'running') return r.go_at !== null && now >= r.go_at + r.rules.limit_ms
    return false
  }

  /** Applies everything that should have happened by `now`. */
  private async settle(s: Store, race: RaceRecord, runs: RunRecord[], now: number): Promise<void> {
    let raceChanged = false
    if (race.status === 'lobby') {
      const settings = await s.getSettings()
      if (now - race.activity_at > settings.lobby_timeout_seconds * 1000) {
        race.status = 'cancelled'
        race.ended_at = now
        raceChanged = true
      }
    }
    if (race.status === 'howto' && race.howto_ends_at !== null && now >= race.howto_ends_at) {
      race.status = 'running'
      raceChanged = true
    }
    if (race.status === 'running' && race.go_at !== null && now >= race.go_at) {
      for (const run of runs) {
        let changed = false
        if (run.status === 'waiting') {
          run.status = 'playing'
          changed = true
        }
        if (run.status === 'playing') {
          const deadline = deadlineAt(run.progress, race.rules, race.go_at)
          if (now >= deadline) {
            this.applyProgress(run, timeUp(run.progress))
            this.endRun(race, run, deadline)
            changed = true
          }
        }
        if (changed) await s.saveRun(run)
      }
      if (await this.maybeFinish(s, race, runs, now)) raceChanged = false
    }
    if (raceChanged) await s.updateRace(race)
  }

  /** Ends the race once every player has ended. Places and winners are set here. Returns true when it saved the race. */
  private async maybeFinish(s: Store, race: RaceRecord, runs: RunRecord[], now: number, force = false): Promise<boolean> {
    if (race.status !== 'running' && !(force && race.status === 'howto')) return false
    const active = runs.filter((r) => r.status !== 'left')
    if (!force && active.some((r) => r.status === 'waiting' || r.status === 'playing')) return false
    const ended = active.filter((r) => r.status === 'finished' || r.status === 'timeout')
    const ranked = [...ended].sort((a, b) =>
      compareRuns({ solved: a.solved, time_ms: a.time_ms ?? race.rules.limit_ms, ended_at: a.ended_at ?? now }, { solved: b.solved, time_ms: b.time_ms ?? race.rules.limit_ms, ended_at: b.ended_at ?? now }),
    )
    for (const [i, run] of ranked.entries()) {
      run.place = i + 1
      // Battle / Head-to-Head: the winner is place 1, and only if they built at least one solution.
      run.is_winner = race.mode !== 'solo' && i === 0 && run.solved > 0
      await s.saveRun(run)
    }
    race.status = 'finished'
    race.ended_at = Math.max(now, ...ended.map((r) => r.ended_at ?? 0))
    if (race.ended_at > now) race.ended_at = now
    await s.updateRace(race)
    return true
  }

  private applyProgress(run: RunRecord, progress: RunProgress) {
    run.progress = progress
    run.solved = progress.solved.length
    run.penalty_ms = progress.penalty_ms
    run.wrong = progress.wrong
    run.skips = progress.skips
  }

  private endRun(race: RaceRecord, run: RunRecord, at: number) {
    run.status = run.progress.ended === 'finished' ? 'finished' : 'timeout'
    run.ended_at = at
    run.time_ms = rankingTimeMs(run.progress, race.rules.limit_ms)
  }

  private register(player: PlayerInput, settings: Settings): Registration {
    const check = checkRegistration(player, settings.opus, settings.profanity)
    if (!check.ok) throw new GameError('invalid_player', check.message, check.field, check.errors)
    return check.value
  }

  private ownRun(runs: RunRecord[], runId: string, token: string): RunRecord {
    const run = runs.find((r) => r.id === runId)
    if (!run || run.token_hash !== hashToken(token)) throw FORBIDDEN()
    return run
  }

  private checkHost(race: RaceRecord, hostToken: string) {
    if (!race.host_token_hash || race.host_token_hash !== hashToken(hostToken)) throw FORBIDDEN()
  }

  private async puzzlesFor(s: Store, settings: Settings, seed: string) {
    const solutions = await s.listSolutions()
    return buildPuzzles(
      solutions,
      { hard_mode: settings.hard_mode, hard_max_letters: settings.hard_max_letters, decoys_min: settings.decoys_min, decoys_max: settings.decoys_max, global_decoys: settings.global_decoys },
      seed,
    )
  }

  private async newRace(s: Store, settings: Settings, mode: GameMode, kioskId: string, now: number, startNow: boolean, hostToken?: string, roomCode?: string): Promise<RaceRecord> {
    const id = uuid()
    const race: RaceRecord = {
      id,
      mode,
      status: startNow ? 'running' : 'lobby',
      room_code: roomCode ?? null,
      rules: rulesFrom(settings),
      puzzles: startNow ? await this.puzzlesFor(s, settings, id) : [],
      host_token_hash: hostToken ? hashToken(hostToken) : null,
      kiosk_id: kioskId.slice(0, 120),
      is_test: settings.rehearsal_mode,
      created_at: now,
      howto_ends_at: null,
      go_at: startNow ? now + COUNTDOWN_MS : null,
      ended_at: null,
      host_seen_at: hostToken ? now : null,
      activity_at: now,
    }
    await s.insertRace(race)
    return race
  }

  private async newRun(s: Store, race: RaceRecord, reg: Registration, lane: number, deviceId: string | null, now: number): Promise<{ run: RunRecord; token: string }> {
    const playerId = await s.upsertPlayer({
      id: uuid(),
      full_name: reg.full_name,
      affiliation_type: reg.affiliation_type,
      project_name: reg.project_name,
      opu: reg.opu,
      name_key: nameKey(reg.full_name),
      affil_key: affiliationKey(reg.affiliation_type, reg.project_name, reg.opu),
    })
    const token = newToken()
    const run: RunRecord = {
      id: uuid(),
      race_id: race.id,
      player_id: playerId,
      lane,
      full_name: reg.full_name,
      affiliation_type: reg.affiliation_type,
      project_name: reg.project_name,
      opu: reg.opu,
      token_hash: hashToken(token),
      device_id: deviceId ? deviceId.slice(0, 120) : null,
      status: 'waiting',
      progress: createProgress(race.puzzles.length),
      solved: 0,
      time_ms: null,
      penalty_ms: 0,
      wrong: 0,
      skips: 0,
      place: null,
      is_winner: false,
      is_test: race.is_test,
      removed_at: null,
      removed_reason: null,
      created_at: now,
      ended_at: null,
      last_seen_at: now,
      kicked: false,
    }
    await s.insertRun(run)
    return { run, token }
  }

  toState(race: RaceRecord, runs: RunRecord[], now: number): RaceState {
    const showPuzzles = race.status === 'running' || race.status === 'finished'
    const pub: RunPublic[] = runs
      .filter((r) => r.status !== 'left')
      .sort((a, b) => a.lane - b.lane)
      .map((r) => ({
        id: r.id,
        lane: r.lane,
        name: r.full_name,
        affiliation_type: r.affiliation_type,
        affiliation: affiliationOf(r),
        status: r.status,
        connected: r.last_seen_at !== null && now - r.last_seen_at <= CONNECTED_MS,
        progress: r.progress,
        time_ms: r.time_ms,
        place: race.status === 'finished' ? r.place : null,
        is_winner: race.status === 'finished' ? r.is_winner : false,
      }))
    return {
      id: race.id,
      mode: race.mode,
      status: race.status,
      room_code: race.room_code,
      rules: race.rules,
      puzzles: showPuzzles ? race.puzzles : [],
      answer_lengths: race.puzzles.map((p) => p.answer.length),
      howto_ends_at: race.howto_ends_at,
      go_at: race.go_at,
      ended_at: race.ended_at,
      is_test: race.is_test,
      max_players: maxPlayers(race.mode),
      runs: pub,
    }
  }
}
