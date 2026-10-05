import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { navigate } from '../app/router'
import { startGuidedStudy } from '../exercises/start'
import { Button, Segmented } from '../ui/controls'
import { IconArrowRight, IconBook } from '../ui/icons'
import { GROUPS, STUDIES } from './catalog'
import { loadGuidedProgress, type GuidedProgress } from './progress'

export function StudyList() {
  const [filter, setFilter] = useState('all')
  const progress = useLiveQuery(loadGuidedProgress, [], {} as GuidedProgress)
  const practiced = Object.values(progress).filter((p) => p.practiced > 0).length
  return <div className="flex flex-col gap-8 py-4">
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-accent"><IconBook /> Iniciação ao violão · Henrique Pinto</div>
      <h1 className="text-3xl font-semibold tracking-tight">Estudo guiado</h1>
      <p className="max-w-xl text-sm leading-relaxed text-sub">Das primeiras notas às primeiras peças. Siga a ordem do livro ou escolha o que quer praticar hoje.</p>
      <span className="text-xs text-sub">Páginas 26–34 do livro · {practiced}/{STUDIES.length} práticas realizadas</span>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Segmented label="Conteúdo do estudo" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tudo' }, { value: 'exercise', label: 'Exercícios' }, { value: 'piece', label: 'Peças' }]} />
      <Button variant="ghost" onClick={() => navigate({ name: 'home' })}>início</Button>
    </div>
    {GROUPS.map((group) => {
      const entries = STUDIES.filter((s) => s.group === group.id && (filter === 'all' || s.kind === filter))
      if (!entries.length) return null
      return <section key={group.id} className="flex flex-col gap-3" aria-labelledby={`group-${group.id}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`group-${group.id}`} className="text-lg font-semibold">{group.title}</h2>
          <span className="text-xs text-sub">p. {group.pages}</span>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-sub">{group.hint}</p>
        <div className="divide-y divide-line/50 overflow-hidden rounded-xl border border-line/50 bg-surface/40">
          {entries.map((study) => {
            const p = progress[study.id]
            return <button key={study.id} type="button" onClick={() => startGuidedStudy(study.id)} className="group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-2">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-medium">{study.title}</span>
                <span className="text-xs text-sub">{study.author && `${study.author} · `}{study.unmetered ? 'nota por nota' : `${study.meter}/4`} · {study.polyphonic ? 'escuta e prática com metrônomo' : 'microfone, tempo livre ou metrônomo'}</span>
              </span>
              {p?.practiced > 0 && <span className="shrink-0 text-right text-xs text-sub">{p.bestBpm ? `${p.bestBpm} bpm` : p.bestAccuracy !== undefined ? `${Math.round(p.bestAccuracy * 100)}%` : 'praticado'}</span>}
              <IconArrowRight className="shrink-0 text-sub transition-transform group-hover:translate-x-1 group-hover:text-accent" />
            </button>
          })}
        </div>
      </section>
    })}
  </div>
}
