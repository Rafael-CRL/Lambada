import { useEffect, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { ensureAudioRunning } from '../audio/clock'
import { Microphone } from '../audio/microphone'
import { loadSettings, type Settings } from '../db/db'
import { StudySession } from '../engine/session'
import { MicMeter } from '../exercises/MicMeter'
import { FeedbackLine, FretHint } from '../exercises/parts'
import { startGuidedStudy } from '../exercises/start'
import { buildConfig } from '../exercises/types'
import { Button, ProgressBar, Segmented, Stepper } from '../ui/controls'
import { IconArrowRight, IconPause, IconPlay, IconRedo, IconX } from '../ui/icons'
import { STUDIES, studyById } from './catalog'
import { EMPTY_VIEW, GuidedController } from './controller'
import { loadStudyOptions, normalizeOptions, saveGuidedResult, saveStudyOptions, type StudyOptions } from './progress'
import { GuidedScore } from './Score'

type Phase = 'ready' | 'opening' | 'running' | 'paused' | 'done' | 'error'

export function StudyScreen({ id }: { id: string }) {
  const study = studyById(id)!
  const [options, setOptions] = useState<StudyOptions | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [view, setView] = useState(EMPTY_VIEW)
  const [guide, setGuide] = useState(false)
  const [error, setError] = useState('')
  const [mic, setMic] = useState<Microphone | null>(null)
  const controller = useRef<GuidedController | null>(null)
  const cleanup = useRef<() => void>(() => {})
  const generation = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const next = STUDIES[STUDIES.indexOf(study) + 1]

  useEffect(() => {
    let cancelled = false
    window.scrollTo(0, 0)
    void Promise.all([loadStudyOptions(study), loadSettings()]).then(([o, s]) => {
      if (!cancelled) { setOptions(o); setSettings(s) }
    }).catch((e) => { if (!cancelled) { setError(String(e)); setPhase('error') } })
    return () => { cancelled = true; generation.current++; cleanup.current() }
  }, [study])

  useEffect(() => {
    if (phase === 'done') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [phase])

  const start = async (chosen = options) => {
    if (!chosen || !settings) return
    const run = ++generation.current
    cleanup.current()
    controller.current = null
    setMic(null)
    setView(EMPTY_VIEW)
    setError('')
    setPhase('opening')
    let opened: Microphone | null = null
    let session: StudySession | null = null
    let saved = false
    let c: GuidedController | null = null
    const finishSession = (completed: boolean) => {
      if (saved || !session) return
      saved = true
      return session.finish(completed, chosen.tempo === 'metronome' ? { bpm: chosen.bpm } : {})
    }
    const release = () => {
      c?.dispose()
      opened?.close()
      void finishSession(false)?.catch(console.error)
    }
    cleanup.current = release
    try {
      if (!(await ensureAudioRunning())) {
        if (generation.current === run) setPhase('ready')
        return
      }
      if (generation.current !== run) return
      if (chosen.mode === 'mic') {
        opened = await Microphone.open(settings.audioDeviceId, settings.latencyMs)
        if (generation.current !== run) { opened.close(); return }
        const pool = [...new Set(study.bars.flatMap((b) => b.flatMap((n) => n.note ? [n.note] : [])))]
        const config = { ...buildConfig('notes', { tempo: chosen.tempo, bpm: chosen.bpm }, 'solta'), pool, accidentals: pool.some((n) => /[#b]/.test(n)), guided: { id: study.id, title: study.title } }
        session = await StudySession.open(config, 'solta', config.accidentals)
        if (generation.current !== run) { release(); return }
        setMic(opened)
      }
      c = new GuidedController({ study, options: chosen, mic: opened, session, toleranceMs: settings.toleranceMs, onView: setView,
        onFinish: () => {
          opened?.close()
          setMic(null)
          const accuracy = c!.judge.attempts ? c!.judge.correct / c!.judge.attempts : undefined
          void Promise.all([finishSession(true), saveGuidedResult(id, chosen, accuracy)]).then(() => {
            if (generation.current === run) setPhase('done')
          }).catch((e) => { if (generation.current === run) { setError(`Não foi possível salvar: ${String(e)}`); setPhase('done') } })
        },
      })
      controller.current = c
      if (import.meta.env.DEV) (window as unknown as { __lambada: unknown }).__lambada = { controller: c, session }
      c.start()
      setPhase('running')
    } catch (e) {
      release()
      if (generation.current === run) { setError(e instanceof Error ? e.message : String(e)); setPhase('error') }
    }
  }

  const change = (patch: Partial<StudyOptions>) => {
    if (!options) return
    const updated = normalizeOptions(study, { ...options, ...patch })
    setOptions(updated)
    void saveStudyOptions(id, updated).catch((e) => setError(`Não foi possível guardar o ajuste: ${String(e)}`))
    // Uma mudança de andamento reinicia com contagem, preservando a partitura.
    generation.current++
    cleanup.current()
    controller.current = null
    setMic(null)
    setView(EMPTY_VIEW)
    setPhase('ready')
  }
  const pause = () => {
    if (phaseRef.current === 'running') { controller.current?.pause(); setPhase('paused') }
    else if (phaseRef.current === 'paused') { controller.current?.resume(); setPhase('running') }
  }
  const leave = () => navigate({ name: 'studies' })
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return
      if (e.key === ' ' && (phase === 'running' || phase === 'paused')) { e.preventDefault(); pause() }
      if (e.key === 'Escape') { if (phase === 'running') pause(); else leave() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const active = phase === 'running' || phase === 'paused'
  return <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 pb-10 sm:px-6">
    <header className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b border-line/50 bg-bg/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-sub">Estudo guiado · p. {study.page}{study.author && ` · ${study.author}`}</p>
          <h1 className="text-lg font-semibold">{study.title}</h1>
        </div>
        {options?.mode === 'mic' && view.attempts > 0 && <span className="font-mono text-lg text-accent">{Math.round(view.correct / view.attempts * 100)}%</span>}
        <button type="button" onClick={leave} aria-label="Voltar aos estudos" title="Voltar aos estudos" className="grid size-11 shrink-0 place-items-center rounded-lg text-sub hover:bg-surface"><IconX /></button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {active ? <Button variant="primary" onClick={pause}>{phase === 'paused' ? <IconPlay /> : <IconPause />}{phase === 'paused' ? 'continuar' : 'pausar'}</Button> : <Button variant="primary" onClick={() => void start()} disabled={!options || phase === 'opening'}><IconPlay />{phase === 'opening' ? 'preparando…' : phase === 'done' ? 'de novo' : options?.mode === 'listen' ? 'ouvir' : 'começar'}</Button>}
        {active && <Button onClick={() => void start()} aria-label="Reiniciar estudo"><IconRedo /></Button>}
        {options && <Stepper label="BPM" value={options.bpm} min={30} max={200} step={5} format={(b) => `${b} bpm`} onChange={(bpm) => change({ bpm })} />}
        {view.countdown !== null && active && <span className="px-2 font-mono text-xl text-accent" role="status">{view.countdown}</span>}
        {active && view.countdown === null && <span className="text-xs text-sub">{study.unmetered ? 'sequência' : `compasso ${view.bar + 1}/${study.bars.length}`}</span>}
      </div>
      <ProgressBar value={view.progress} />
    </header>
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-sm leading-relaxed text-sub">{study.hint}</p>
      {study.form && <p className="text-xs text-sub">{study.form}</p>}
      {options && <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Como praticar" value={options.mode} onChange={(mode) => change({ mode })} size="sm" options={[
          ...(!study.polyphonic ? [{ value: 'mic' as const, label: 'Microfone' }] : []),
          { value: 'practice' as const, label: 'Só metrônomo' }, { value: 'listen' as const, label: 'Ouvir' },
        ]} />
        {options.mode === 'mic' && <Segmented label="Tempo" value={options.tempo} onChange={(tempo) => change({ tempo })} size="sm" options={[{ value: 'free', label: 'Livre' }, { value: 'metronome', label: 'No tempo' }]} />}
        <Segmented label="Voltas completas" value={String(options.loops)} onChange={(n) => change({ loops: Number(n) })} size="sm" options={[1, 2, 4].map((n) => ({ value: String(n), label: `${n}×` }))} />
        <button type="button" aria-pressed={guide} onClick={() => setGuide(!guide)} className="rounded-lg px-3 py-2 text-xs text-sub hover:bg-surface hover:text-text">{guide ? 'ocultar ajuda' : 'notas e posições'}</button>
      </div>}
      <p className="text-xs leading-relaxed text-sub">{study.polyphonic ? 'Baixo e melodia soam juntos. Pratique com a pauta e o metrônomo; este trecho não recebe nota pelo microfone.' : options?.mode === 'mic' ? options.tempo === 'free' ? 'A pauta espera a nota certa, na oitava certa. O ritmo fica livre.' : 'Toque no pulso. O microfone confere a nota e o ataque; corda e dedos são indicações.' : options?.mode === 'listen' ? 'Ouça o exercício completo, incluindo as repetições.' : 'Toque acompanhando o cursor. A prática é registrada sem avaliação de acerto.'}</p>
    </div>
    {error && <div role="alert" className="rounded-xl bg-surface p-4 text-sm">
      <p>{phase === 'error' && options?.mode === 'mic' ? 'Não foi possível abrir o microfone. Você pode tentar de novo ou praticar só com o metrônomo.' : 'Não foi possível concluir a operação.'}</p>
      <p className="mt-2 break-words text-xs text-sub">{error}</p>
      {phase === 'error' && <Button className="mt-3" onClick={() => void start()}>tentar de novo</Button>}
    </div>}
    {phase === 'done' && <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/40 bg-surface p-5" aria-label="Resultado do estudo">
      <div><h2 className="text-lg font-semibold">{options?.mode === 'listen' ? 'Escuta concluída' : 'Prática concluída'}</h2>
        <p className="mt-1 text-sm text-sub">{options?.mode === 'mic' ? `${view.correct} de ${view.attempts} notas corretas na primeira tentativa` : options?.mode === 'listen' ? 'Agora experimente tocar no seu andamento.' : 'Você percorreu a partitura com o metrônomo.'}</p></div>
      <div className="flex flex-wrap gap-2"><Button onClick={leave}>escolher outro</Button>{next && <Button onClick={() => startGuidedStudy(next.id)}>próximo <IconArrowRight /></Button>}</div>
    </section>}
    {mic && <MicMeter mic={mic} />}
    {options?.mode === 'mic' && active && <><FeedbackLine fb={view.feedback} />{view.fret && <FretHint fret={view.fret} />}</>}
    <GuidedScore study={study} view={view} guide={guide} running={active} />
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-sub"><span>Iniciação ao violão · livro p. {study.page} / PDF p. {study.page - 2}</span><Button variant="ghost" onClick={leave}>todos os estudos</Button></footer>
  </div>
}
