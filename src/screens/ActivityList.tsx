import { useLiveQuery } from 'dexie-react-hooks'
import { loadTrail, type TrailProgress } from '../db/db'
import { startActivity, startLesson } from '../exercises/start'
import { ACTIVITIES, TOPIC_TITLE, type Topic } from '../exercises/types'
import { seconds, STAGES, stageLessons, type StageDef } from '../lessons/lessons'
import { cx } from '../ui/controls'
import { IconArrowRight } from '../ui/icons'

const ROW = 'group flex w-full items-center justify-between gap-4 px-5 py-4 text-left'

/** Lista curta do tópico. Clicar = começar. Na Pauta, a trilha vem antes da Leitura. */
export function ActivityList({ topic }: { topic: Topic }) {
  const items = ACTIVITIES.filter((a) => a.topic === topic && !a.hidden)
  const trail = useLiveQuery(loadTrail, [], {})
  const stages = topic === 'pauta' ? STAGES : []
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{TOPIC_TITLE[topic]}</h1>
      <div className="flex flex-col gap-3">
        {stages.map((s, i) => (
          <StageCard key={s.id} stage={s} trail={trail} autoFocus={i === 0} />
        ))}
        {items.map((a, i) => (
          <button
            key={a.id}
            type="button"
            autoFocus={i === 0 && stages.length === 0}
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

/** Etapa da trilha: abre a próxima lição por fazer; os pontos abrem qualquer uma. */
function StageCard({ stage, trail, autoFocus }: { stage: StageDef; trail: TrailProgress; autoFocus: boolean }) {
  const lessons = stageLessons(stage.id)
  const challenge = lessons[lessons.length - 1]
  // passar no Desafio fecha a etapa: quem já sabe não precisa fazer as lições antes
  const next = trail[challenge.id]?.done ? null : (lessons.find((l) => !trail[l.id]?.done) ?? null)
  const target = next ?? challenge
  return (
    <div className="rounded-xl bg-surface/60 transition-colors duration-150 hover:bg-surface">
      <button type="button" autoFocus={autoFocus} onClick={() => startLesson(target.id)} className={cx(ROW, 'pb-2')}>
        <Title title={stage.title} hint={stage.hint} />
        <Arrow />
      </button>
      <div className="flex items-center gap-0.5 px-4 pb-3">
        {lessons.map((l, i) => {
          const done = !!trail[l.id]?.done
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => startLesson(l.id)}
              title={`${i + 1}. ${l.title}`}
              aria-label={`Lição ${i + 1}: ${l.title}${done ? ' (feita)' : ''}`}
              className="group/dot grid size-6 place-items-center rounded-full"
            >
              <span
                className={cx(
                  'size-2.5 rounded-full transition-transform duration-150 group-hover/dot:scale-125',
                  done ? 'bg-accent' : l === next ? 'ring-2 ring-accent/70 ring-inset' : 'bg-line',
                )}
              />
            </button>
          )
        })}
        <span className="ml-2 truncate text-xs text-sub">{next ? next.title : doneText(trail[target.id]?.bestTime)}</span>
      </div>
    </div>
  )
}

/** Etapa feita: o recorde do Desafio, para tentar bater. */
function doneText(bestTime: number | undefined): string {
  return bestTime === undefined ? 'feita' : `feita · desafio em ${seconds(bestTime)} por nota`
}

function Title({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-lg font-medium transition-colors duration-150 group-hover:text-accent">{title}</span>
      <span className="text-sm text-sub">{hint}</span>
    </span>
  )
}

function Arrow() {
  return <IconArrowRight className="shrink-0 text-xl text-sub transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" />
}
