import { useEffect, useRef, useState } from 'react'
import { StudySession } from '../engine/session'
import type { FretFeedback } from '../exercises/controller'
import { MicMeter } from '../exercises/MicMeter'
import { NoteButtons } from '../exercises/NoteButtons'
import { Countdown, ExerciseBody, FeedbackLine, FretHint } from '../exercises/parts'
import { ScoreController } from '../exercises/score'
import { StaffStage } from '../exercises/stage'
import type { ExerciseConfig } from '../exercises/types'
import { cx } from '../ui/controls'
import type { ScoreBody } from './lessons'
import type { SegmentProps } from './segments'

/**
 * Partitura no tempo, dentro da lição: a Leitura (ou as Notas do violão)
 * com o metrônomo, as figuras e as notas da lição, por alguns compassos.
 */
export function ScoreSegment({ body, settings, mic, timbre, paused, hud, setHud, onDone, handle }: SegmentProps<ScoreBody>) {
  const svgRef = useRef<SVGSVGElement>(null)
  const ctrl = useRef<ScoreController | null>(null)
  const [fret, setFret] = useState<FretFeedback | null>(null)
  const useMic = body.input === 'mic'

  useEffect(() => {
    let cancelled = false
    let stage: StaffStage | null = null
    let c: ScoreController | null = null
    void (async () => {
      const config: ExerciseConfig = {
        kind: 'score',
        activity: useMic ? 'notes' : 'reading',
        input: body.input,
        content: body.content,
        tempo: 'metronome',
        duration: 'infinite',
        level: 1,
        bpm: body.bpm,
        scale: 'solta',
        accidentals: false,
        timbre: useMic ? 'off' : timbre,
        figures: body.cells,
        bars: body.bars,
        pool: body.pool,
      }
      const session = await StudySession.open(config, 'solta', false)
      if (cancelled) return
      stage = new StaffStage(svgRef.current!, { hitX: 90 })
      c = new ScoreController({
        config,
        settings,
        session,
        mic: useMic ? mic : null,
        stage,
        // o braço fica aqui, não no placar da lição
        setHud: ({ fret: f, ...rest }) => {
          if (f !== undefined) setFret(f)
          setHud(rest)
        },
        finish: () => onDone({ correct: session.correctCount, attempts: session.attempts }),
      })
      ctrl.current = c
      handle.current = { answered: () => c?.answered ?? 0 }
      if (import.meta.env.DEV) (window as unknown as { __lambada: unknown }).__lambada = { controller: c, session }
      c.start()
    })()
    return () => {
      cancelled = true
      c?.dispose()
      stage?.dispose()
      ctrl.current = null
    }
    // um controlador por segmento montado
  }, [])

  useEffect(() => {
    const c = ctrl.current
    if (!c) return
    if (paused && !c.paused) c.pause()
    else if (!paused && c.paused) c.resume()
  }, [paused])

  return (
    <ExerciseBody
      footer={useMic ? mic && <MicMeter mic={mic} /> : <NoteButtons accidentals={false} disabled={paused} onAnswer={(s, t) => ctrl.current?.answerButton(s, t) ?? null} />}
    >
      <svg
        ref={svgRef}
        className={cx('staff w-full shrink-0 transition-[height] duration-200', fret ? 'h-[clamp(120px,26dvh,300px)]' : 'h-[clamp(150px,36dvh,360px)]')}
        aria-label="Pauta"
        role="img"
      />
      <Countdown value={hud.countdown} />
      <FeedbackLine fb={hud.feedback} infoTone="sub" />
      {fret && <FretHint fret={fret} />}
    </ExerciseBody>
  )
}
