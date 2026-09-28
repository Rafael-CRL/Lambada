import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { navigate } from '../app/router'
import { getLastPlace, loadTrail, type LastPlace, type TrailProgress } from '../db/db'
import { startActivity, startLesson } from '../exercises/start'
import { activity, TOPIC_TITLE, type Topic } from '../exercises/types'
import { isLessonId, lesson, nextLesson, unitOf } from '../lessons/curriculum'
import { IconArrowRight } from '../ui/icons'

/** Para onde o "continuar" leva, e o que ele diz. */
function resumeOf(last: LastPlace | null, trail: TrailProgress): { label: string; go: () => void } | null {
  if (!last) return null
  if (last.kind === 'activity') {
    const a = activity(last.id)
    return a.hidden ? null : { label: `${TOPIC_TITLE[a.topic]} · ${a.title}`, go: () => startActivity(a.id) }
  }
  if (!isLessonId(last.id)) return null
  // lição feita: a próxima da trilha
  const l = trail[last.id]?.done ? nextLesson(last.id) : lesson(last.id)
  if (!l) return null
  return { label: `${unitOf(l.id).title} · ${l.title}`, go: () => startLesson(l.id) }
}

/** Início: a trilha (porta de entrada) e os dois treinos. As opções ficam dentro de cada um. */
export function Home() {
  const last = useLiveQuery(getLastPlace, [], null)
  const trail = useLiveQuery(loadTrail, [], {})
  const resume = resumeOf(last, trail)

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-10">
      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        <TopicTile topic="teoria" subtitle="do zero, passo a passo" art={<TheoryArt />} />
        <TopicTile topic="pauta" subtitle="ler as notas e o ritmo" art={<StaffArt />} />
        <TopicTile topic="violao" subtitle="achar no braço" art={<FretArt />} />
      </div>
      {resume && (
        <button type="button" onClick={resume.go} className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sub hover:text-text">
          continuar <span className="text-text">{resume.label}</span>
          <IconArrowRight className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  )
}

function TopicTile({ topic, subtitle, art }: { topic: Topic; subtitle: string; art: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => navigate({ name: 'topic', topic })}
      className="group flex aspect-[4/3] flex-col items-center justify-center gap-5 rounded-2xl bg-surface/60 p-6 transition-colors duration-150 hover:bg-surface"
    >
      <span className="w-2/3 text-sub transition-colors duration-150 group-hover:text-accent">{art}</span>
      <span className="flex flex-col items-center gap-1 text-center">
        <span className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{TOPIC_TITLE[topic]}</span>
        <span className="text-sm text-sub">{subtitle}</span>
      </span>
    </button>
  )
}

/** Teoria: uma figura de cada (semibreve, mínima, semínima, colcheias) numa linha. */
function TheoryArt() {
  return (
    <svg viewBox="0 0 120 56" className="w-full" aria-hidden="true">
      <line x1={0} x2={120} y1={40} y2={40} stroke="currentColor" strokeWidth={1.2} opacity={0.5} />
      <g fill="none" stroke="currentColor" strokeWidth={1.8}>
        <ellipse cx={14} cy={40} rx={6.5} ry={4.2} />
        <ellipse cx={40} cy={40} rx={5.6} ry={4} transform="rotate(-20 40 40)" />
      </g>
      <g fill="currentColor">
        <rect x={44.6} y={12} width={1.6} height={28} />
        <ellipse cx={64} cy={40} rx={5.6} ry={4} transform="rotate(-20 64 40)" />
        <rect x={68.6} y={12} width={1.6} height={28} />
        <ellipse cx={88} cy={40} rx={5.6} ry={4} transform="rotate(-20 88 40)" />
        <rect x={92.6} y={12} width={1.6} height={28} />
        <ellipse cx={108} cy={40} rx={5.6} ry={4} transform="rotate(-20 108 40)" />
        <rect x={112.6} y={12} width={1.6} height={28} />
        <rect x={92.6} y={12} width={21.6} height={3.6} />
      </g>
    </svg>
  )
}

function StaffArt() {
  return (
    <svg viewBox="0 0 120 56" className="w-full" aria-hidden="true">
      <g stroke="currentColor" strokeWidth={1.2} opacity={0.5}>
        {[10, 19, 28, 37, 46].map((y) => (
          <line key={y} x1={0} x2={120} y1={y} y2={y} />
        ))}
      </g>
      <g fill="currentColor">
        <ellipse cx={34} cy={41.5} rx={5.6} ry={4} transform="rotate(-20 34 41.5)" />
        <rect x={38.6} y={14} width={1.6} height={27} />
        <ellipse cx={62} cy={28} rx={5.6} ry={4} transform="rotate(-20 62 28)" />
        <rect x={66.6} y={2} width={1.6} height={26} />
        <ellipse cx={90} cy={14.5} rx={5.6} ry={4} transform="rotate(-20 90 14.5)" />
        <rect x={84.8} y={15} width={1.6} height={27} />
      </g>
    </svg>
  )
}

function FretArt() {
  return (
    <svg viewBox="0 0 120 56" className="w-full" aria-hidden="true">
      <g stroke="currentColor" opacity={0.5}>
        {[6, 15, 24, 33, 42, 51].map((y, i) => (
          <line key={y} x1={4} x2={120} y1={y} y2={y} strokeWidth={0.8 + i * 0.25} />
        ))}
        <line x1={6} x2={6} y1={5} y2={52} strokeWidth={3} />
        {[34, 62, 90, 118].map((x) => (
          <line key={x} x1={x} x2={x} y1={6} y2={51} strokeWidth={1.2} />
        ))}
      </g>
      <g fill="currentColor">
        <circle cx={48} cy={24} r={5} />
        <circle cx={76} cy={42} r={5} />
        <circle cx={20} cy={6} r={5} />
      </g>
    </svg>
  )
}
