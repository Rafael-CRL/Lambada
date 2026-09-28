import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { ensureAudioRunning, isAudioRunning } from '../audio/clock'
import { LESSON } from '../config'
import { loadSettings, saveActivityOptions, type Settings } from '../db/db'
import { RHYTHM_LEVELS, type RhythmLevel } from '../domain/rhythm'
import { ControlsDock, type OptionChange } from '../exercises/ControlsDock'
import { EMPTY_HUD, type Hud } from '../exercises/controller'
import { onceOptions } from '../exercises/start'
import { activity, buildConfig, type ExerciseConfig } from '../exercises/types'
import { ConceptCards } from '../lessons/ConceptCards'
import { accuracyOf, type LessonDef, type LessonResult } from '../lessons/lessons'
import { RhythmSegment } from '../lessons/RhythmSegment'
import type { SegmentHandle } from '../lessons/segments'
import { useFirstCards } from '../lessons/useFirstCards'
import type { RhythmBody } from '../rhythm/items'
import { Button, ProgressBar } from '../ui/controls'
import { IconHelp, IconPlay, IconRedo, IconX } from '../ui/icons'

/** Trechos por rodada. */
const ROUND = 10

/** Figuras novas de um nível (ganham destaque, para o nível ser de fato praticado). */
function focusOf(level: RhythmLevel) {
  const prev = level > 1 ? RHYTHM_LEVELS[level - 2].cells : []
  return RHYTHM_LEVELS[level - 1].cells.filter((c) => !prev.includes(c))
}

/**
 * Ritmo (Pauta): trechos de dois compassos para ler e bater, com as figuras,
 * o compasso e o andamento escolhidos no canto. Uma rodada tem 10 trechos.
 */
export function RhythmPractice() {
  const def = activity('rhythm')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [config, setConfig] = useState<ExerciseConfig | null>(null)
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'needs-gesture' | 'running' | 'done'>('loading')
  const [help, setHelp] = useFirstCards('rhythm', def.cards)
  const [dockOpen, setDockOpen] = useState(false)
  const [result, setResult] = useState<LessonResult | null>(null)
  const [hud, setHudState] = useState<Hud>(EMPTY_HUD)
  const setHud = useCallback((patch: Partial<Hud>) => setHudState((h) => ({ ...h, ...patch })), [])
  const handle = useRef<SegmentHandle | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const s = await loadSettings()
      if (cancelled) return
      setSettings(s)
      setConfig(buildConfig('rhythm', { ...s.activities.rhythm, ...onceOptions('rhythm') }, s.scale))
      if (isAudioRunning() || (await ensureAudioRunning())) {
        if (!cancelled) setPhase('running')
      } else if (!cancelled) setPhase('needs-gesture')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const level = (config?.level ?? 2) as RhythmLevel
  const body = useMemo<RhythmBody | null>(
    () =>
      config && {
        kind: 'rhythm',
        cells: RHYTHM_LEVELS[level - 1].cells,
        focus: focusOf(level),
        meters: [config.meter ?? 4],
        bpm: config.bpm,
        parts: [{ mode: 'read', count: ROUND }],
      },
    [config, level],
  )
  const lesson = useMemo<LessonDef | null>(() => body && { id: 'rhythm', unit: 'pauta', title: 'Ritmo', segments: [body] }, [body])

  const restart = () => {
    setResult(null)
    setHudState(EMPTY_HUD)
    setRun((r) => r + 1)
    setPhase('running')
  }

  // todo ajuste muda os trechos: recomeça a rodada
  const change = (c: OptionChange) => {
    if (!config) return
    const opts = { level: c.level, meter: c.meter, bpm: c.bpm }
    void saveActivityOptions('rhythm', Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)))
    setConfig({ ...config, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)) })
    restart()
  }

  const leave = () => navigate({ name: 'topic', topic: 'pauta' }, true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (help || dockOpen) return
      if (e.key === 'Escape') {
        e.preventDefault()
        leave()
      } else if (e.key === 'Enter' && phase === 'done') restart()
      else if (e.key === 'Enter' && phase === 'needs-gesture') void ensureAudioRunning().then((ok) => ok && setPhase('running'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const stat = hud.stats[0]
  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center gap-3">
        <span className="flex-1 truncate text-sm text-sub">
          {def.title} <span className="text-text">· figuras {level} · {config?.meter ?? 4}/4 · {config?.bpm ?? 60} bpm</span>
        </span>
        {stat && <span className="tabular font-mono text-sm text-text">{stat.value}</span>}
        {hud.progressText && <span className="tabular font-mono text-sm text-sub">{hud.progressText}</span>}
        <button type="button" onClick={() => setHelp(true)} aria-label="Rever a explicação" title="Rever a explicação" className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text">
          <IconHelp />
        </button>
        <button type="button" onClick={restart} aria-label="Reiniciar" title="Reiniciar" className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text">
          <IconRedo />
        </button>
        <button type="button" onClick={leave} aria-label="Sair" title="Sair (esc)" className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text">
          <IconX />
        </button>
      </header>
      <ProgressBar value={hud.progress ?? 0} className="mt-3" />

      {settings && config && body && lesson && (phase === 'running' || phase === 'done') ? (
        <RhythmSegment
          key={run}
          lesson={lesson}
          body={body}
          settings={settings}
          mic={null}
          timbre="off"
          paused={help || dockOpen || phase === 'done'}
          hud={hud}
          setHud={setHud}
          onDone={(r) => {
            setResult(r)
            setPhase('done')
          }}
          handle={handle}
          dock={<ControlsDock controls={def.controls} config={config} onChange={change} onOpenChange={setDockOpen} />}
        />
      ) : (
        <div className="flex-1" />
      )}

      {help && def.cards && <ConceptCards ids={def.cards} onClose={() => setHelp(false)} />}

      {(phase === 'needs-gesture' || (phase === 'done' && result)) && (
        <div className="fixed inset-0 z-20 grid animate-fade-in place-items-center bg-bg/85 p-6 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
            {phase === 'needs-gesture' ? (
              <>
                <h2 className="text-2xl font-semibold">pronto?</h2>
                <p className="text-sm text-sub">O navegador precisa de um clique para liberar o áudio.</p>
                <Button variant="primary" className="w-full" onClick={() => void ensureAudioRunning().then((ok) => ok && setPhase('running'))} autoFocus>
                  <IconPlay /> começar
                </Button>
              </>
            ) : (
              result && (
                <>
                  <span className="tabular font-mono text-5xl font-semibold">{Math.round(accuracyOf(result) * 100)}%</span>
                  <span className="text-sm text-sub">das notas no tempo</span>
                  <Button variant="primary" className="w-full" onClick={restart} autoFocus>
                    <IconRedo /> de novo
                  </Button>
                  <div className="flex w-full gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setResult(null)
                        setPhase('running')
                        handle.current?.more?.(LESSON.moreNotes)
                      }}
                    >
                      + {LESSON.moreNotes}
                    </Button>
                    <Button className="flex-1" onClick={leave}>
                      <IconX /> sair
                    </Button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
