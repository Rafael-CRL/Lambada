import { startActivity } from '../exercises/start'
import { ACTIVITIES, TOPIC_TITLE, type Topic } from '../exercises/types'
import { IconArrowRight } from '../ui/icons'

/** Lista curta de atividades do tópico. Clicar = começar. */
export function ActivityList({ topic }: { topic: Topic }) {
  const items = ACTIVITIES.filter((a) => a.topic === topic && !a.hidden)
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{TOPIC_TITLE[topic]}</h1>
      <div className="flex flex-col gap-3">
        {items.map((a, i) => (
          <button
            key={a.id}
            type="button"
            autoFocus={i === 0}
            onClick={() => startActivity(a.id)}
            className="group flex items-center justify-between gap-4 rounded-xl bg-surface/60 px-5 py-4 text-left transition-colors duration-150 hover:bg-surface"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-lg font-medium transition-colors duration-150 group-hover:text-accent">{a.title}</span>
              <span className="text-sm text-sub">{a.hint}</span>
            </span>
            <IconArrowRight className="shrink-0 text-xl text-sub transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        ))}
      </div>
    </div>
  )
}
