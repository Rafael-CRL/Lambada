import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { loadTrail, type TrailProgress } from '../db/db'
import { startActivity, startLesson } from '../exercises/start'
import { ACTIVITIES, TOPIC_TITLE, type Topic } from '../exercises/types'
import { topicUnits } from '../lessons/curriculum'
import { seconds, type UnitDef } from '../lessons/lessons'
import { cx } from '../ui/controls'
import { IconArrowRight } from '../ui/icons'

const ROW = 'group flex w-full items-center justify-between gap-4 px-5 py-4 text-left'

/** Unidade feita: todas as lições, ou o Desafio (quem já sabe pula as lições). */
export function unitDone(u: UnitDef, trail: TrailProgress): boolean {
  const challenge = u.lessons.find((l) => l.challenge)
  return (challenge && !!trail[challenge.id]?.done) || u.lessons.every((l) => trail[l.id]?.done)
}

/** Próxima lição por fazer (null = unidade feita). */
export function unitNext(u: UnitDef, trail: TrailProgress) {
  return unitDone(u, trail) ? null : (u.lessons.find((l) => !trail[l.id]?.done) ?? null)
}

/**
 * Lista curta do tópico. Clicar = começar. Teoria: as unidades da trilha, a
 * atual em destaque. Violão: a trilha e as atividades. Pauta: as atividades.
 */
export function ActivityList({ topic }: { topic: Topic }) {
  const items = ACTIVITIES.filter((a) => a.topic === topic && !a.hidden)
  const trail = useLiveQuery(loadTrail, [], {})
  const units = topic === 'pauta' ? [] : topicUnits(topic)
  const current = units.find((u) => !unitDone(u, trail)) ?? null
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{TOPIC_TITLE[topic]}</h1>
      <div className="flex flex-col gap-3">
        {units.map((u, i) => (
          <UnitCard key={u.id} unit={u} index={units.length > 1 ? i + 1 : null} trail={trail} current={u === current} />
        ))}
        {items.map((a, i) => (
          <button
            key={a.id}
            type="button"
            autoFocus={i === 0 && units.length === 0}
            onClick={() => startActivity(a.id)}
            className={cx(ROW, 'rounded-xl bg-surface/60 transition-colors duration-150 hover:bg-surface')}
          >
            <Title title={a.title} hint={a.hint} />
            <Arrow />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Unidade da trilha: abre a próxima lição por fazer; os pontos abrem qualquer uma. */
function UnitCard({ unit, index, trail, current }: { unit: UnitDef; index: number | null; trail: TrailProgress; current: boolean }) {
  const done = unitDone(unit, trail)
  const next = unitNext(unit, trail)
  const challenge = unit.lessons.find((l) => l.challenge)
  const target = next ?? challenge ?? unit.lessons[0]
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: 'center' })
  }, [current])
  return (
    <div
      ref={ref}
      className={cx(
        'rounded-xl transition-colors duration-150',
        current ? 'bg-surface ring-1 ring-accent/40' : 'bg-surface/60 hover:bg-surface',
        done && 'opacity-80',
      )}
    >
      <button type="button" autoFocus={current} onClick={() => startLesson(target.id)} className={cx(ROW, 'pb-2')}>
        <Title title={unit.title} hint={unit.hint} mark={done ? '✓' : index !== null ? String(index) : undefined} done={done} />
        <Arrow />
      </button>
      <div className="flex items-center gap-0.5 px-4 pb-3">
        {unit.lessons.map((l, i) => {
          const ok = !!trail[l.id]?.done
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => startLesson(l.id)}
              title={`${i + 1}. ${l.title}`}
              aria-label={`Lição ${i + 1}: ${l.title}${ok ? ' (feita)' : ''}`}
              className="group/dot grid size-6 place-items-center rounded-full"
            >
              <span
                className={cx(
                  'size-2.5 rounded-full transition-transform duration-150 group-hover/dot:scale-125',
                  ok ? 'bg-accent' : l === next ? 'ring-2 ring-accent/70 ring-inset' : 'bg-line',
                )}
              />
            </button>
          )
        })}
        <span className="ml-2 truncate text-xs text-sub">{next ? next.title : doneText(challenge ? trail[challenge.id]?.bestTime : undefined)}</span>
      </div>
    </div>
  )
}

/** Unidade feita: o recorde do Desafio, para tentar bater. */
function doneText(bestTime: number | undefined): string {
  return bestTime === undefined ? 'feita' : `feita · desafio em ${seconds(bestTime)} por nota`
}

function Title({ title, hint, mark, done }: { title: string; hint: string; mark?: string; done?: boolean }) {
  return (
    <span className="flex items-start gap-3">
      {mark && <span className={cx('tabular mt-0.5 w-5 shrink-0 text-right font-mono text-sm', done ? 'text-ok' : 'text-sub')}>{mark}</span>}
      <span className="flex flex-col gap-0.5">
        <span className="text-lg font-medium transition-colors duration-150 group-hover:text-accent">{title}</span>
        <span className="text-sm text-sub">{hint}</span>
      </span>
    </span>
  )
}

function Arrow() {
  return <IconArrowRight className="shrink-0 text-xl text-sub transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" />
}
