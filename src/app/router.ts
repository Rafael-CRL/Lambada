import { useSyncExternalStore } from 'react'
import type { ExerciseConfig } from '../exercises/types'

export type Route =
  | { name: 'home' }
  | { name: 'play'; config: ExerciseConfig; run: number }
  | { name: 'summary'; id: number }
  | { name: 'progress' }
  | { name: 'settings' }

function configToPath(c: ExerciseConfig): string {
  switch (c.kind) {
    case 'conveyor':
      return `conveyor/${c.flow}/${c.input}`
    case 'sprint':
      return `sprint/${c.input}`
    case 'guitar':
      return `guitar/${c.drill}`
    case 'bpm':
      return `bpm/${c.input}`
  }
}

const isInput = (s: string | undefined): s is 'buttons' | 'mic' => s === 'buttons' || s === 'mic'

function pathToConfig(parts: string[]): ExerciseConfig | null {
  const [kind, a, b] = parts
  if (kind === 'conveyor' && (a === 'wait' || a === 'continuous') && isInput(b)) return { kind, flow: a, input: b }
  if (kind === 'sprint' && isInput(a)) return { kind, input: a }
  if (kind === 'guitar' && (a === 'repeat' || a === 'scale' || a === 'adaptive')) return { kind, drill: a }
  if (kind === 'bpm' && isInput(a)) return { kind, input: a }
  return null
}

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const run = Number(new URLSearchParams(query).get('run') ?? 0)
  switch (parts[0]) {
    case 'play': {
      const config = pathToConfig(parts.slice(1))
      return config ? { name: 'play', config, run } : { name: 'home' }
    }
    case 'summary':
      return Number.isFinite(Number(parts[1])) ? { name: 'summary', id: Number(parts[1]) } : { name: 'home' }
    case 'progress':
      return { name: 'progress' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'home' }
  }
}

export function routeHash(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/'
    case 'play':
      return `#/play/${configToPath(r.config)}${r.run ? `?run=${r.run}` : ''}`
    case 'summary':
      return `#/summary/${r.id}`
    case 'progress':
      return '#/progress'
    case 'settings':
      return '#/settings'
  }
}

export function navigate(r: Route, replace = false) {
  const hash = routeHash(r)
  if (replace) history.replaceState(null, '', hash)
  else history.pushState(null, '', hash)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** Inicia (ou reinicia) um exercício; `run` força uma nova montagem. */
export function play(config: ExerciseConfig, replace = false) {
  navigate({ name: 'play', config, run: Date.now() }, replace)
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  window.addEventListener('popstate', cb)
  return () => {
    window.removeEventListener('hashchange', cb)
    window.removeEventListener('popstate', cb)
  }
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return parseHash(hash)
}
