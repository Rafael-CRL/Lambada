import { useCallback, useEffect, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { ensureAudioRunning, isAudioRunning } from '../audio/clock'
import { LESSON } from '../config'
import { loadSettings, saveLessonResult } from '../db/db'
import { EMPTY_HUD, type Hud } from '../exercises/controller'
import { NoteButtons } from '../exercises/NoteButtons'
import { StaffStage } from '../exercises/stage'
import { startActivity, startLesson } from '../exercises/start'
import type { Timbre } from '../exercises/types'
import { CLEF_END } from '../staff/geometry'
import { Button, cx, ProgressBar } from '../ui/controls'
import { IconArrowRight, IconPlay, IconRedo, IconX } from '../ui/icons'
import { LessonController } from './controller'
import { parseNote } from '../domain/notes'
import {
  accuracyOf,
  lesson,
  lessonNotes,
  nextLesson,
  passes,
  reviewNotes,
  seconds,
  stageLessons,
  stageOf,
  type LessonCard,
  type LessonId,
  type LessonResult,
} from './lessons'

type Phase = 'loading' | 'needs-gesture' | 'running' | 'done'

/** Cola entre a clave e a nota: linhas numa coluna, espaços na outra. */
const GUIDE_X = { line: CLEF_END + 12, space: CLEF_END + 28 }
/** as notas somem antes da cola (a partir daqui aparecem) */
const FADE_FROM = CLEF_END + 36
const HIT_X = CLEF_END + 70

export function LessonScreen({ lessonId }: { lessonId: LessonId }) {
  const def = lesson(lessonId)
  const stage = stageOf(lessonId)
  const number = stageLessons(def.stage).indexOf(def) + 1
  const next = nextLesson(lessonId)
  const svgRef = useRef<SVGSVGElement>(null)
  const ctrl = useRef<LessonController | null>(null)
  const timbre = useRef<Timbre>('piano')
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<LessonResult | null>(null)
  const [card, setCard] = useState<LessonCard | null>(null)
  const [hud, setHudState] = useState<Hud>(EMPTY_HUD)
  const setHud = useCallback((patch: Partial<Hud>) => setHudState((h) => ({ ...h, ...patch })), [])

  useEffect(() => {
    let cancelled = false
    let staff: StaffStage | null = null
    let controller: LessonController | null = null
    void (async () => {
      const s = await loadSettings()
      if (cancelled) return
      // o mesmo som dos botões da Leitura
      timbre.current = s.activities.reading?.timbre ?? 'piano'
      staff = new StaffStage(svgRef.current!, { hitX: HIT_X, fadeFrom: FADE_FROM })
      controller = new LessonController({
        lesson: def,
        stage: staff,
        guide: staff.addGuide(lessonNotes(def), GUIDE_X, reviewNotes(def).map(parseNote)),
        timbre: () => timbre.current,
        setHud,
        setCard,
        finish: (r) => {
          const accuracy = accuracyOf(r)
          // o recorde de tempo só vale com o acerto mínimo
          void saveLessonResult(def.id, accuracy, passes(def, r), accuracy >= LESSON.pass ? r.meanTime : undefined).then(() => {
            if (cancelled) return
            setResult(r)
            setPhase('done')
          })
        },
      })
      ctrl.current = controller
      if (import.meta.env.DEV) (window as unknown as { __lambada: unknown }).__lambada = { controller }
      if (isAudioRunning() || (await ensureAudioRunning())) {
        if (cancelled) return
        controller.start()
        setPhase('running')
      } else if (!cancelled) setPhase('needs-gesture')
    })()
    return () => {
      cancelled = true
      controller?.dispose()
      staff?.dispose()
      ctrl.current = null
    }
  }, [def, setHud])

  const beginAfterGesture = async () => {
    if (await ensureAudioRunning()) {
      ctrl.current?.start()
      setPhase('running')
    }
  }

  const leave = () => navigate({ name: 'topic', topic: 'pauta' }, true)
  const again = () => startLesson(lessonId, true)
  // depois da última lição, a trilha desemboca na Leitura
  const goNext = () => (next ? startLesson(next.id, true) : startActivity('reading', true))
  const passed = result ? passes(def, result) : false
  const trainMore = () => {
    setResult(null)
    setPhase('running')
    ctrl.current?.more()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        leave()
      } else if ((e.key === 'Enter' || e.key === ' ') && card) {
        e.preventDefault()
        ctrl.current?.dismissCard()
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        if (phase === 'needs-gesture') void beginAfterGesture()
        else if (phase === 'done') (passed ? goNext : again)()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const fb = hud.feedback
  const stat = hud.stats[0]
  const nextLabel = `próxima: ${next ? (next.stage === def.stage ? next.title : `${stageOf(next.id).title} · ${next.title}`) : 'Leitura'}`
  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center gap-3">
        <span className="flex-1 truncate text-sm text-sub">
          {stage.title} {number} · <span className="text-text">{def.title}</span>
        </span>
        {stat && (
          <span className="tabular font-mono text-sm text-sub" title={stat.label}>
            <span className="text-text">{stat.value}</span>
          </span>
        )}
        {hud.progressText && <span className="tabular font-mono text-sm text-sub">{hud.progressText}</span>}
        <button
          type="button"
          onClick={again}
          aria-label="Reiniciar"
          title="Reiniciar"
          className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text"
        >
          <IconRedo />
        </button>
        <button
          type="button"
          onClick={leave}
          aria-label="Sair"
          title="Sair (esc)"
          className="grid size-10 place-items-center rounded-lg text-lg text-sub hover:bg-surface hover:text-text"
        >
          <IconX />
        </button>
      </header>
      <ProgressBar value={hud.progress ?? 0} className="mt-3" />

      {/* tela grande: pauta e botões juntos no meio, perto do olho e do mouse; celular: botões no rodapé, perto do polegar */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:justify-center-safe">
        <div className="relative flex flex-col justify-center-safe max-sm:flex-1">
          <svg
            ref={svgRef}
            // 'staff' também aqui: o React reescreve a classe e não pode apagar a do palco
            className="staff h-[clamp(150px,36dvh,360px)] w-full shrink-0"
            aria-label="Pauta"
            role="img"
          />
          <div className="flex min-h-16 flex-col items-center justify-start gap-0.5 text-center" aria-live="polite">
            {fb && (fb.kind !== 'ok' || fb.text) && (
              <div key={fb.key} className="animate-fade-in">
                <div className={cx('text-2xl font-semibold', fb.kind === 'err' && 'text-err', fb.kind === 'info' && 'text-accent')}>{fb.text}</div>
                {fb.detail && <div className="text-sm text-sub">{fb.detail}</div>}
              </div>
            )}
          </div>
          {card && (
            <button
              type="button"
              onClick={() => ctrl.current?.dismissCard()}
              className="absolute inset-0 z-10 grid animate-fade-in place-items-center bg-bg/80 backdrop-blur-[2px]"
            >
              <span className="flex flex-col items-center gap-1">
                <span className="text-3xl font-semibold tracking-tight">{card.title}</span>
                {card.detail && <span className="text-sub">{card.detail}</span>}
                <span className="mt-3 text-xs text-sub">qualquer tecla para seguir</span>
              </span>
            </button>
          )}
        </div>

        <footer className="mt-2">
          <NoteButtons accidentals={false} disabled={phase !== 'running'} onAnswer={(s, t) => ctrl.current?.answerButton(s, t) ?? null} />
        </footer>
      </div>

      {(phase === 'needs-gesture' || phase === 'done') && (
        <div className="fixed inset-0 z-20 grid animate-fade-in place-items-center bg-bg/85 p-6 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
            {phase === 'needs-gesture' && (
              <>
                <h2 className="text-2xl font-semibold">pronto?</h2>
                <p className="text-sm text-sub">O navegador precisa de um clique para liberar o áudio.</p>
                <Button variant="primary" className="w-full" onClick={beginAfterGesture} autoFocus>
                  <IconPlay /> começar
                </Button>
              </>
            )}
            {phase === 'done' && result && (
              <>
                <div className="flex flex-col items-center gap-1">
                  <span className={cx('tabular font-mono text-5xl font-semibold', passed ? 'text-ok' : 'text-text')}>
                    {Math.round(accuracyOf(result) * 100)}%
                  </span>
                  {result.meanTime !== undefined && (
                    <span className="tabular font-mono text-sm text-text">{seconds(result.meanTime)} por nota</span>
                  )}
                  <span className="text-sm text-sub">{status(def.challenge, result, passed)}</span>
                </div>
                <Button variant="primary" className="w-full" onClick={passed ? goNext : again} autoFocus>
                  {passed ? (
                    <>
                      {nextLabel} <IconArrowRight />
                    </>
                  ) : (
                    <>
                      <IconRedo /> de novo
                    </>
                  )}
                </Button>
                <div className="flex w-full gap-2">
                  <Button className="flex-1" onClick={trainMore}>
                    + {LESSON.moreNotes} notas
                  </Button>
                  {passed ? (
                    <Button className="flex-1" onClick={again}>
                      <IconRedo /> de novo
                    </Button>
                  ) : (
                    <Button className="flex-1" onClick={goNext} title={nextLabel}>
                      próxima <IconArrowRight />
                    </Button>
                  )}
                  <Button className="flex-1" onClick={leave}>
                    <IconX /> sair
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** O que falta para marcar como feita (ou que já está). */
function status(challenge: boolean | undefined, r: LessonResult, passed: boolean): string {
  if (passed) return challenge ? 'etapa feita' : 'lição feita'
  if (accuracyOf(r) < LESSON.pass) return `${Math.round(LESSON.pass * 100)}% para marcar como feita`
  return `até ${seconds(LESSON.challengeTime)} por nota para marcar como feita`
}
