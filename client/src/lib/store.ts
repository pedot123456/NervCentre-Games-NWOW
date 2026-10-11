import { useSyncExternalStore } from 'react'

/** A tiny observable value (no library needed). */
export interface Store<T> {
  get(): T
  set(next: T | ((prev: T) => T)): void
  subscribe(fn: () => void): () => void
}

export function createStore<T>(initial: T, onSet?: (v: T) => void): Store<T> {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      const v = typeof next === 'function' ? (next as (p: T) => T)(value) : next
      if (Object.is(v, value)) return
      value = v
      onSet?.(v)
      for (const fn of [...subs]) fn()
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/** localStorage can be missing or throw (private mode, blocked storage) – never let that break the game. */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}
