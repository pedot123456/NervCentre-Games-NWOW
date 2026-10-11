import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { pinPolicyError, type LoginResponse } from '@shared/admin'
import { uuid } from '@shared/random'
import type { Store } from '../db/store'
import { hashToken } from '../game/engine'
import { httpError } from './errors'

const SESSION_MS = 12 * 60 * 60 * 1000
const MAX_FAILURES = 5
const LOCK_MS = 5 * 60 * 1000

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  return `scrypt:${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [kind, saltHex, hashHex] = stored.split(':')
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export class AuthService {
  constructor(
    private readonly store: Store,
    private readonly defaultPin: string,
    private readonly clock: () => number,
  ) {}

  /** First start: an Admin with the default PIN, which must be changed at the first sign-in. */
  async ensureAdmin(): Promise<void> {
    if (await this.store.getAdmin()) return
    await this.store.createAdmin(uuid(), hashPin(this.defaultPin))
  }

  async login(pin: string): Promise<LoginResponse> {
    const admin = await this.store.getAdmin()
    if (!admin) throw httpError(500, 'server_error', 'Admin is not set up.')
    const now = this.clock()
    if (admin.locked_until && admin.locked_until > now) {
      throw httpError(423, 'locked', 'Too many wrong PINs. Admin is locked for 5 minutes.')
    }
    if (!/^\d{4,12}$/.test(pin) || !verifyPin(pin, admin.pin_hash)) {
      const failures = admin.failed_attempts + 1
      const locked = failures >= MAX_FAILURES
      await this.store.setAdminFailures(admin.id, locked ? 0 : failures, locked ? now + LOCK_MS : null)
      await this.store.audit(locked ? 'admin_locked' : 'admin_login_failed')
      if (locked) throw httpError(423, 'locked', 'Too many wrong PINs. Admin is locked for 5 minutes.')
      throw httpError(401, 'invalid_pin', 'Wrong PIN.')
    }
    await this.store.recordAdminLogin(admin.id)
    const token = randomBytes(32).toString('base64url')
    const expires = now + SESSION_MS
    await this.store.createSession(hashToken(token), admin.id, expires)
    await this.store.audit('admin_login')
    return { token, must_change_pin: admin.must_change_pin, expires_at: new Date(expires).toISOString() }
  }

  /** The signed-in Admin; `allowMustChange` lets the PIN change through before the first real PIN is set. */
  async check(token: string | undefined, allowMustChange = false): Promise<{ id: string; must_change_pin: boolean }> {
    if (!token) throw httpError(401, 'unauthorized', 'Sign in to Admin first.')
    const session = await this.store.findSession(hashToken(token))
    if (!session || session.expires_at < this.clock()) throw httpError(401, 'unauthorized', 'Your Admin session has ended – sign in again.')
    const admin = await this.store.getAdmin()
    if (!admin || admin.id !== session.user_id) throw httpError(401, 'unauthorized', 'Sign in to Admin first.')
    if (admin.must_change_pin && !allowMustChange) throw httpError(403, 'must_change_pin', 'Choose your own Admin PIN first.')
    return { id: admin.id, must_change_pin: admin.must_change_pin }
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.store.deleteSession(hashToken(token))
  }

  async changePin(token: string | undefined, current: string, next: string): Promise<void> {
    const me = await this.check(token, true)
    const admin = (await this.store.getAdmin())!
    if (!verifyPin(current, admin.pin_hash)) throw httpError(400, 'wrong_pin', 'The current PIN is not right.')
    const problem = pinPolicyError(next)
    if (problem) throw httpError(400, 'weak_pin', problem)
    if (next === current) throw httpError(400, 'weak_pin', 'Choose a PIN that is different from the current one.')
    await this.store.updateAdminPin(me.id, hashPin(next), false)
    await this.store.audit('pin_changed')
  }

  /** Re-checks the PIN for dangerous actions (deleting data). */
  async confirmPin(pin: string): Promise<boolean> {
    const admin = await this.store.getAdmin()
    return !!admin && verifyPin(pin, admin.pin_hash)
  }
}
