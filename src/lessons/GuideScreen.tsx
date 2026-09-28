import { navigate } from '../app/router'
import { Button } from '../ui/controls'
import { IconArrowLeft, IconPlay } from '../ui/icons'
import { guideOf } from './guides'

/** O guia de uma unidade: uma página para ler, com os desenhos grandes e o som. */
export function GuideScreen({ unit }: { unit: string }) {
  const guide = guideOf(unit)
  const back = () => (history.length > 1 ? history.back() : navigate({ name: 'topic', topic: 'teoria' }))
  if (!guide) return null
  return (
    <article className="guide mx-auto flex w-full max-w-2xl flex-col gap-12 py-6">
      <header className="flex flex-col gap-3">
        <button type="button" onClick={back} className="flex w-fit items-center gap-1.5 rounded-md py-1 text-sm text-sub hover:text-text">
          <IconArrowLeft /> voltar
        </button>
        <span className="text-sm text-sub">Guia</span>
        <h1 className="text-4xl font-semibold tracking-tight">{guide.title}</h1>
        <p className="text-lg text-sub">{guide.intro}</p>
      </header>
      {guide.sections.map((s, i) => (
        <section key={s.title} className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            <span className="mr-2 text-sub">{i + 1}.</span>
            {s.title}
          </h2>
          <div className="guide-body flex flex-col gap-3 text-lg leading-relaxed">{s.body}</div>
          {s.art && <div className="flex w-full justify-center rounded-2xl bg-surface/50 px-4 py-6">{s.art()}</div>}
          {s.demo && (
            <Button className="w-fit self-center" onClick={s.demo}>
              <IconPlay /> ouvir
            </Button>
          )}
        </section>
      ))}
      <footer className="flex justify-center">
        <Button variant="primary" onClick={back}>
          <IconArrowLeft /> voltar
        </Button>
      </footer>
    </article>
  )
}
