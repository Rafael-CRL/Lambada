import type { CellId, Meter } from '../domain/rhythm'
import type { NoteSet, ScaleId } from '../domain/scales'
import type { InputKind } from '../engine/adaptive'

/**
 * Atividades: Pauta (ler, responder nos botões) e Violão (tocar, o microfone
 * confere). Cada atividade começa direto, com os últimos ajustes usados; os
 * ajustes mudam dentro da própria tela.
 */

export type ActivityId = 'reading' | 'rhythm' | 'repeat' | 'scale' | 'notes' | 'explore'
export type Topic = 'teoria' | 'pauta' | 'violao'

/** O que aparece na pauta. */
export type Content = 'random' | 'scale' | 'repeat'
/** Livre: cada nota espera a resposta. Metrônomo: as figuras andam no tempo. */
export type Tempo = 'free' | 'metronome'
/** ∞, 8 ou 16 compassos, ou 60 s (só no tempo livre). */
export type Duration = 'infinite' | 'short' | 'long' | 'timed'
export type Timbre = 'piano' | 'guitar' | 'off'

/** Botões de ajuste que uma atividade mostra no canto. */
export type Control = 'tempo' | 'bpm' | 'duration' | 'sound' | 'accidentals' | 'region' | 'map' | 'notes' | 'figures' | 'meter'

/** Ajustes guardados por atividade. */
export interface ActivityOptions {
  tempo: Tempo
  bpm: number
  level: number
  duration: Duration
  timbre: Timbre
  accidentals: boolean
  /** Leitura: quais notas */
  notes: NoteSet
  /** Ritmo: pulsos por compasso */
  meter: Meter
}

export interface ActivityDef {
  id: ActivityId
  topic: Topic
  title: string
  hint: string
  input: InputKind
  content: Content
  controls: Control[]
  defaults: ActivityOptions
  /** fora da lista (código mantido) */
  hidden?: boolean
  /** cartões de conceito: aparecem na primeira vez; o "?" reabre */
  cards?: string[]
}

const BASE: ActivityOptions = { tempo: 'free', bpm: 60, level: 1, duration: 'infinite', timbre: 'piano', accidentals: false, notes: 'todas', meter: 4 }

export const ACTIVITIES: ActivityDef[] = [
  {
    id: 'reading',
    topic: 'pauta',
    title: 'Leitura',
    hint: 'leia a nota e responda',
    input: 'buttons',
    content: 'random',
    controls: ['map', 'notes', 'tempo', 'duration', 'sound', 'accidentals'],
    defaults: BASE,
  },
  {
    id: 'rhythm',
    topic: 'pauta',
    title: 'Ritmo',
    hint: 'leia e bata o ritmo, no tempo',
    input: 'buttons',
    content: 'random',
    controls: ['figures', 'meter', 'bpm'],
    defaults: { ...BASE, level: 2 },
    cards: ['pulso', 'pe'],
  },
  {
    id: 'repeat',
    topic: 'violao',
    title: 'Repetição',
    hint: 'uma nota por compasso, no tempo',
    input: 'mic',
    content: 'repeat',
    hidden: true,
    controls: ['bpm'],
    defaults: { ...BASE, tempo: 'metronome' },
  },
  {
    id: 'scale',
    topic: 'violao',
    title: 'Escala',
    hint: 'as naturais em ordem, subindo e descendo',
    input: 'mic',
    content: 'scale',
    controls: ['map', 'tempo'],
    defaults: BASE,
    cards: ['escalaViolao'],
  },
  {
    id: 'notes',
    topic: 'violao',
    title: 'Notas',
    hint: 'leia a nota na pauta e toque no violão',
    input: 'mic',
    content: 'random',
    controls: ['map', 'tempo', 'duration', 'accidentals'],
    defaults: BASE,
  },
  {
    id: 'explore',
    topic: 'violao',
    title: 'Explorar',
    hint: 'toque ou clique no braço e veja a nota',
    input: 'mic',
    content: 'random',
    controls: ['accidentals'],
    defaults: BASE,
  },
]

export function activity(id: ActivityId): ActivityDef {
  return ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[0]
}

export function isActivityId(s: string | undefined): s is ActivityId {
  return ACTIVITIES.some((a) => a.id === s)
}

export const TOPIC_TITLE: Record<Topic, string> = { teoria: 'Teoria musical', pauta: 'Pauta', violao: 'Violão' }

/** Configuração efetiva de uma sessão (o que o controlador lê). */
export interface ExerciseConfig {
  kind: 'score'
  activity: ActivityId
  input: InputKind
  content: Content
  tempo: Tempo
  duration: Duration
  level: number
  bpm: number
  scale: ScaleId
  accidentals: boolean
  timbre: Timbre
  /** Leitura: quais notas (sem isso, as da região do violão) */
  notes?: NoteSet
  /** lições: figuras do sorteio no metrônomo (no lugar do nível) */
  figures?: CellId[]
  /** lições: quantos compassos */
  bars?: number
  /** lições: só estas notas (ids escritos) */
  pool?: string[]
  /** Ritmo: pulsos por compasso */
  meter?: Meter
}

export function buildConfig(id: ActivityId, saved: Partial<ActivityOptions> | undefined, scale: ScaleId): ExerciseConfig {
  const def = activity(id)
  const o: ActivityOptions = { ...def.defaults, ...saved }
  return {
    kind: 'score',
    activity: id,
    input: def.input,
    content: def.content,
    // repetição é sempre com metrônomo; escala é sempre das naturais e sem duração
    tempo: def.id === 'repeat' ? 'metronome' : o.tempo,
    duration: def.content === 'random' ? (o.tempo === 'metronome' && o.duration === 'timed' ? 'infinite' : o.duration) : 'infinite',
    level: def.id === 'repeat' ? 1 : o.level,
    bpm: o.bpm,
    // sem o ajuste de região, sempre a Solta (a Fechada volta com a trilha de iniciante)
    scale: def.controls.includes('region') ? scale : 'solta',
    accidentals: def.controls.includes('accidentals') && o.accidentals,
    timbre: def.input === 'buttons' ? o.timbre : 'off',
    notes: def.controls.includes('notes') ? o.notes : undefined,
    meter: def.controls.includes('meter') ? o.meter : undefined,
  }
}

export const DURATION_BARS: Record<'short' | 'long', number> = { short: 8, long: 16 }
export const TIMED_SECONDS = 60

/** Configurações antigas (antes das atividades) guardadas no histórico. */
interface LegacyConfig {
  kind: string
  input?: InputKind
  activity?: undefined
}

export function isScoreConfig(c: unknown): c is ExerciseConfig {
  return !!c && (c as ExerciseConfig).kind === 'score' && isActivityId((c as ExerciseConfig).activity)
}

export function inputOf(config: ExerciseConfig | LegacyConfig): InputKind {
  if (isScoreConfig(config)) return config.input
  return config.kind === 'guitar' ? 'mic' : (config.input ?? 'buttons')
}

/** Chave estável para comparar sessões parecidas. */
export function modeKey(c: ExerciseConfig): string {
  const tempo = c.tempo === 'metronome' ? `metro-${c.level}-${c.bpm}` : 'free'
  return `${c.activity}:${tempo}:${c.duration}`
}

export function exerciseTitle(config: ExerciseConfig | LegacyConfig): string {
  if (!isScoreConfig(config)) return inputOf(config) === 'mic' ? 'Violão' : 'Pauta'
  const a = activity(config.activity)
  return `${TOPIC_TITLE[a.topic]} · ${a.title}`
}

export function exerciseSubtitle(config: ExerciseConfig | LegacyConfig): string {
  if (!isScoreConfig(config)) return ''
  const parts = [config.tempo === 'metronome' ? `${config.bpm} bpm${config.content === 'random' ? ` · nível ${config.level}` : ''}` : 'tempo livre']
  if (config.content === 'random' && config.duration !== 'infinite')
    parts.push(config.duration === 'timed' ? `${TIMED_SECONDS} s` : `${DURATION_BARS[config.duration]} compassos`)
  return parts.join(' · ')
}
