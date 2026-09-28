import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { navigate } from '../app/router'
import { db, loadTrail, type Settings, type TrailProgress as Trail } from '../db/db'
import { topicUnits } from '../lessons/curriculum'
import { unitDone } from './ActivityList'
import { TOPIC_TITLE } from '../exercises/types'
import { positionKey } from '../domain/fretboard'
import { namePt, namePtOctave } from '../domain/notes'
import type { StudyItem } from '../domain/scales'
import { summarize, type InputKind, type ItemStats } from '../engine/adaptive'
import { exerciseTitle } from '../exercises/types'
import { Fretboard, type FretMarker } from '../staff/Fretboard'
import { StaffSvg } from '../staff/StaffSvg'
import { cx, Segmented } from '../ui/controls'
import { IconKeys, IconMic } from '../ui/icons'
import { accidentalsFor, useProgressSnapshot } from './useProgress'

/** Ponto neutro da escala divergente: abaixo é fraco, acima é bom. */
const MID = 0.75

/** Cor divergente erro → neutro → acerto, derivada dos tokens do tema. */
export function heatColor(accuracy: number): string {
  if (accuracy <= MID) {
    const p = Math.round((1 - accuracy / MID) * 100)
    return `color-mix(in oklab, var(--color-err) ${p}%, var(--color-sub))`
  }
  const p = Math.round(((accuracy - MID) / (1 - MID)) * 100)
  return `color-mix(in oklab, var(--color-ok) ${p}%, var(--color-sub))`
}

interface Heat {
  accuracy: number | null
  n: number
  total: number
  wrongOctave: number
}

function heatOf(stats: ItemStats[]): Heat {
  const recent = stats.flatMap((s) => s.recent)
  const total = stats.reduce((a, s) => a + s.correct + s.wrong + s.wrongOctave, 0)
  const wrongOctave = stats.reduce((a, s) => a + s.wrongOctave, 0)
  if (!recent.length) return { accuracy: null, n: 0, total, wrongOctave }
  const merged = summarize({ ...stats[0], recent })
  return { accuracy: merged.accuracy, n: recent.length, total, wrongOctave }
}

function heatTitle(label: string, h: Heat, locked: boolean): string {
  if (locked) return `${label} · ainda bloqueada`
  if (h.accuracy === null) return `${label} · sem tentativas`
  const oct = h.wrongOctave ? ` · ${h.wrongOctave} de oitava` : ''
  return `${label} · ${Math.round(h.accuracy * 100)}% nas últimas ${h.n} · ${h.total} no total${oct}`
}

export function Progress({ settings }: { settings: Settings }) {
  const [input, setInput] = useState<InputKind>('buttons')
  const snap = useProgressSnapshot(settings, input)
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().limit(40).toArray(), [])

  const byPitch = new Map<number, StudyItem[]>()
  for (const it of snap?.items ?? []) byPitch.set(it.midi, [...(byPitch.get(it.midi) ?? []), it])
  const activeIds = new Set(snap?.active.map((i) => i.id))

  const staffNotes = [...(snap?.items ?? [])]
    .sort((a, b) => a.midi - b.midi || b.written.acc - a.written.acc)
    .map((it) => {
      const h = heatOf(snap!.stats.get(it.id) ? [snap!.stats.get(it.id)!] : [])
      const locked = !activeIds.has(it.id)
      return {
        key: it.id,
        note: it.written,
        className: cx(locked && 'is-muted'),
        style: h.accuracy !== null ? { fill: heatColor(h.accuracy), stroke: heatColor(h.accuracy) } : undefined,
        label: h.accuracy !== null ? `${Math.round(h.accuracy * 100)}` : '',
        labelOpacity: 1,
        title: heatTitle(namePtOctave(it.written), h, locked),
      }
    })

  const fretMarkers: FretMarker[] = [...byPitch.values()].map((items) => {
    const stats = items.map((i) => snap!.stats.get(i.id)).filter((s): s is ItemStats => !!s)
    const h = heatOf(stats)
    const locked = !items.some((i) => activeIds.has(i.id))
    const label = items.map((i) => namePt(i.written)).join('/')
    return {
      position: items[0].position,
      kind: h.accuracy === null ? 'neutral' : 'heat',
      fill: h.accuracy !== null ? heatColor(h.accuracy) : undefined,
      label: items[0].natural ? namePt(items[0].written).slice(0, 3) : '',
      title: heatTitle(label, h, locked),
    }
  })
  // uma bolinha por posição
  const uniqueMarkers = [...new Map(fretMarkers.map((m) => [positionKey(m.position), m])).values()]

  return (
    <div className="flex flex-col gap-10 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">progresso</h1>
          <p className="text-sm text-sub">
            {accidentalsFor(settings, input) ? 'com acidentes' : 'naturais'}
            {snap && (
              <>
                {' '}
                · {snap.mastered.size}/{snap.items.length} dominadas
              </>
            )}
          </p>
        </div>
        <Segmented<InputKind>
          label="Estatísticas do tópico"
          value={input}
          onChange={setInput}
          options={[
            { value: 'buttons', label: <><IconKeys /> Pauta</> },
            { value: 'mic', label: <><IconMic /> Violão</> },
          ]}
        />
      </div>

      <TrailProgress />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-accent">na pauta</h2>
          <Legend />
        </div>
        <div className="overflow-x-auto rounded-xl bg-surface/60 px-3 py-2">
          {snap && <StaffSvg className="h-auto w-full" style={{ minWidth: `${staffNotes.length * 2.4 + 5}rem` }} spacing={36} ariaLabel="Acerto por nota na pauta" notes={staffNotes} />}
        </div>
        <p className="text-xs text-sub">Acerto (%) nas últimas tentativas de cada nota. Passe o mouse para detalhes.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-accent">no braço</h2>
        <div className="rounded-xl bg-surface/60 p-4">
          {snap && (
            <Fretboard
              className="mx-auto w-full max-w-md"
              toFret={Math.max(5, ...uniqueMarkers.map((m) => m.position.fret))}
              markers={uniqueMarkers}
              ariaLabel="Acerto por posição no braço"
            />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-accent">histórico</h2>
        {sessions && sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs text-sub">
                <tr>
                  <th className="py-2 pr-4 font-normal">quando</th>
                  <th className="py-2 pr-4 font-normal">modo</th>
                  <th className="py-2 pr-4 text-right font-normal">acerto</th>
                  <th className="py-2 pr-4 text-right font-normal">mediana</th>
                  <th className="py-2 text-right font-normal">notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    onClick={() => navigate({ name: 'summary', id: s.id! })}
                    onKeyDown={(e) => e.key === 'Enter' && navigate({ name: 'summary', id: s.id! })}
                    className="cursor-pointer hover:bg-surface/60"
                  >
                    <td className="py-2.5 pr-4 text-sub">
                      {new Date(s.startedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 pr-4">
                      {exerciseTitle(s.config)}
                      {s.score !== undefined && <span className="text-sub"> · nível {s.rhythmLevel ?? 1} · {s.bpm} bpm · {s.score} pts</span>}
                      {s.completed === false && <span className="text-sub"> · interrompida</span>}
                    </td>
                    <td className="tabular py-2.5 pr-4 text-right font-mono">{Math.round((s.correct / s.attempts) * 100)}%</td>
                    <td className="tabular py-2.5 pr-4 text-right font-mono text-sub">
                      {Number.isFinite(s.medianTime) && s.score === undefined ? `${s.medianTime.toFixed(2)} s` : '—'}
                    </td>
                    <td className="tabular py-2.5 text-right font-mono text-sub">{s.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-sub">Nenhuma sessão ainda.</p>
        )}
      </section>
    </div>
  )
}

/** Trilhas: lições feitas por unidade (✓ = unidade feita). */
function TrailProgress() {
  const trail = useLiveQuery(loadTrail, [], {} as Trail)
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-accent">trilhas</h2>
      {(['teoria', 'violao'] as const).map((topic) => (
        <div key={topic} className="flex flex-col gap-1.5">
          <span className="text-xs text-sub">{TOPIC_TITLE[topic]}</span>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {topicUnits(topic).map((u) => {
              const done = u.lessons.filter((l) => trail[l.id]?.done).length
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => navigate({ name: 'topic', topic })}
                  className="flex items-center gap-3 rounded-lg bg-surface/60 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface"
                >
                  <span className="flex-1 truncate text-sm">
                    {unitDone(u, trail) && <span className="text-ok">✓ </span>}
                    {u.title}
                  </span>
                  <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(done / u.lessons.length) * 100}%` }} />
                  </span>
                  <span className="tabular w-8 text-right font-mono text-xs text-sub">
                    {done}/{u.lessons.length}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

function Legend() {
  const stops = [0, 0.25, 0.5, 0.75, 0.875, 1]
  return (
    <div className="flex items-center gap-3 text-xs text-sub" aria-hidden="true">
      <span>0%</span>
      <span
        className="h-2 w-32 rounded-full"
        style={{ background: `linear-gradient(to right, ${stops.map((s) => heatColor(s)).join(', ')})` }}
      />
      <span>100%</span>
      <span className="ml-2 flex items-center gap-1.5">
        <span className="size-2.5 rounded-full border border-line bg-surface-2" /> sem dados
      </span>
    </div>
  )
}
