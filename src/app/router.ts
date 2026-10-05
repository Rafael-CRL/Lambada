import { useSyncExternalStore } from 'react'
import { isActivityId, type ActivityId, type Topic } from '../exercises/types'
import { isLessonId } from '../lessons/curriculum'
import { studyById } from '../guided/catalog'

export type Route =
  | { name: 'home' }
  | { name: 'topic'; topic: Topic }
  | { name: 'play'; activity: ActivityId; run: number }
  | { name: 'lesson'; lesson: string; run: number }
  | { name: 'summary'; id: number }
  | { name: 'guide'; unit: string }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'record' }
  | { name: 'scaleTest' }
  | { name: 'studies' }
  | { name: 'study'; id: string; run: number }

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const run = Number(new URLSearchParams(query).get('run') ?? 0)
  switch (parts[0]) {
    case 'estudos':
      return { name: 'studies' }
    case 'estudo':
      return parts[1] && studyById(parts[1]) ? { name: 'study', id: parts[1], run } : { name: 'studies' }
    case 'play':
      return isActivityId(parts[1]) ? { name: 'play', activity: parts[1], run } : { name: 'home' }
    case 'licao':
      return isLessonId(parts[1]) ? { name: 'lesson', lesson: parts[1], run } : { name: 'topic', topic: 'pauta' }
    case 'guia':
      return parts[1] ? { name: 'guide', unit: parts[1] } : { name: 'home' }
    case 'summary':
      return Number.isFinite(Number(parts[1])) ? { name: 'summary', id: Number(parts[1]) } : { name: 'home' }
    case 'progress':
      return { name: 'progress' }
    case 'settings':
      return { name: 'settings' }
    case 'gravar':
      return import.meta.env.DEV ? { name: 'record' } : { name: 'home' }
    case 'teste-escala':
      return import.meta.env.DEV ? { name: 'scaleTest' } : { name: 'home' }
    case 'teoria':
    case 'pauta':
    case 'violao':
      return { name: 'topic', topic: parts[0] }
    default:
      return { name: 'home' }
  }
}

export function routeHash(r: Route): string {
  switch (r.name) {
    case 'studies':
      return '#/estudos'
    case 'study':
      return `#/estudo/${r.id}${r.run ? `?run=${r.run}` : ''}`
    case 'home':
      return '#/'
    case 'play':
      return `#/play/${r.activity}${r.run ? `?run=${r.run}` : ''}`
    case 'lesson':
      return `#/licao/${r.lesson}${r.run ? `?run=${r.run}` : ''}`
    case 'summary':
      return `#/summary/${r.id}`
    case 'guide':
      return `#/guia/${r.unit}`
    case 'progress':
      return '#/progress'
    case 'settings':
      return '#/settings'
    case 'record':
      return '#/gravar'
    case 'scaleTest':
      return '#/teste-escala'
    case 'topic':
      return `#/${r.topic}`
  }
}

export function navigate(r: Route, replace = false) {
  const hash = routeHash(r)
  if (replace) history.replaceState(null, '', hash)
  else history.pushState(null, '', hash)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** Inicia (ou reinicia) uma atividade; `run` força uma nova montagem. */
export function play(activity: ActivityId, replace = false) {
  navigate({ name: 'play', activity, run: Date.now() }, replace)
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
