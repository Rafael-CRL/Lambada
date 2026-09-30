import { useEffect, useRef, useState } from 'react'
import { ensureAudioRunning } from '../audio/clock'
import { Microphone } from '../audio/microphone'
import { encodeWav } from '../audio/wav'
import { loadSettings } from '../db/db'
import { defaultSpelling, namePtOctave, noteId, parseNote, writtenFromSounding } from '../domain/notes'
import { scaleItems, scaleSequence } from '../domain/scales'
import { MicMeter } from '../exercises/MicMeter'
import { Button, cx } from '../ui/controls'
import { Capture } from './capture'

/**
 * `#/teste-escala` (só em desenvolvimento): a escala do exercício (Solta,
 * naturais, subindo e descendo, 1 ou 4 voltas seguidas) com o detector de
 * agora e a nota esperada. Como no exercício, a nota da vez espera a certa.
 * "Terminei" salva a tomada em `src/audio/fixtures/sessao/` (fora do git e do
 * teste das gravações); as boas viram gravações do teste. Análise:
 * `src/dev/laboratorio.test.ts`.
 */

const SEQUENCE = scaleSequence(scaleItems('solta', false))
/** voltas por tomada: a escala inteira (subindo e descendo) repetida em seguida */
const ROUNDS = [1, 4] as const

interface Heard {
  note: string
  onset: number
  time: number
  /** era a nota da vez */
  ok: boolean
}

export default function ScaleTestScreen() {
  const [mic, setMic] = useState<Microphone | null>(null)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [heard, setHeard] = useState<Heard[]>([])
  const [saved, setSaved] = useState('')
  const [rounds, setRounds] = useState<number>(1)
  const full = useRef(SEQUENCE)
  const capture = useRef<Capture | null>(null)
  const recordingRef = useRef(false)
  const pos = useRef(0)
  const log = useRef<Heard[]>([])

  useEffect(() => {
    let cancelled = false
    let opened: Microphone | null = null
    let created: Capture | null = null
    void (async () => {
      try {
        const s = await loadSettings()
        opened = await Microphone.open(s.audioDeviceId, s.latencyMs)
        if (cancelled) return opened.close()
        created = await Capture.create(opened)
        if (cancelled) return created.dispose()
        capture.current = created
        setMic(opened)
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    })()
    return () => {
      cancelled = true
      created?.dispose()
      opened?.close()
      capture.current = null
    }
  }, [])

  // o detector ao vivo, como no exercício: a nota da vez espera a certa
  useEffect(() => {
    if (!mic) return
    let id = 0
    const tick = () => {
      id = requestAnimationFrame(tick)
      for (const e of mic.poll(recordingRef.current ? (full.current[pos.current]?.midi ?? null) : null)) {
        if (e.type !== 'note' || !recordingRef.current) continue
        const target = full.current[pos.current]
        const ok = !!target && e.midi === target.midi
        if (ok) pos.current++
        log.current.push({ note: noteId(defaultSpelling(e.midi)), onset: e.onsetTime + mic.compensation, time: e.time + mic.compensation, ok })
        setHeard([...log.current])
      }
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [mic])

  const start = async () => {
    if (!capture.current || !(await ensureAudioRunning())) return
    full.current = Array.from({ length: rounds }, () => SEQUENCE).flat()
    pos.current = 0
    log.current = []
    setHeard([])
    setSaved('')
    setError('')
    capture.current.begin()
    recordingRef.current = true
    setRecording(true)
  }

  const stop = async () => {
    if (!capture.current || !mic) return
    recordingRef.current = false
    const rec = await capture.current.end()
    setRecording(false)
    const at = (t: number) => Math.round((t - rec.start) * 1000) / 1000
    try {
      const names: string[] = await fetch('/__fixtures?dir=sessao').then((r) => r.json())
      const n = Math.max(0, ...names.map((s) => Number(/^escala-(\d+)$/.exec(s)?.[1] ?? 0))) + 1
      const name = `escala-${n}`
      const record = {
        id: name,
        how: `Escala Solta (naturais, casas 0–3), do Mi da 6ª solta ao Sol da 1ª casa 3, subindo e descendo${rounds > 1 ? `, ${rounds} vezes seguidas` : ''}.`,
        rounds,
        expected: full.current.map((i) => noteId(i.sounding)),
        reached: pos.current,
        sampleRate: rec.sampleRate,
        device: mic.label,
        recordedAt: new Date().toISOString(),
        live: log.current.map((h) => ({ ...h, onset: at(h.onset), time: at(h.time) })),
      }
      const post = async (file: string, body: BodyInit) => {
        const r = await fetch(`/__fixtures?dir=sessao&file=${file}`, { method: 'POST', body })
        if (!r.ok) throw new Error(`${file}: ${r.status}`)
      }
      await post(`${name}.wav`, encodeWav(rec.samples, rec.sampleRate))
      await post(`${name}.json`, JSON.stringify(record, null, 2) + '\n')
      setSaved(name)
    } catch (e) {
      setError(`não salvou: ${String(e)}`)
    }
  }

  const reached = heard.filter((h) => h.ok).length
  const extra = heard.length - reached
  const total = recording || saved ? full.current.length : rounds * SEQUENCE.length
  const round = Math.min(Math.floor(reached / SEQUENCE.length), total / SEQUENCE.length - 1)
  const inRound = reached - round * SEQUENCE.length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Teste da escala</h1>
        <p className="mt-1 text-sm text-sub">
          Escala Solta, só naturais, subindo e descendo, como no exercício (1 ou 4 vezes seguidas). Toque no seu ritmo; a nota da vez só avança com a
          certa. Ao terminar, aperte “Terminei”.
        </p>
      </div>
      {error && <p className="text-sm text-err">{error}</p>}
      {mic && <MicMeter mic={mic} />}
      <div className="flex items-center gap-4">
        {recording ? (
          <Button variant="primary" onClick={() => void stop()}>
            Terminei
          </Button>
        ) : (
          <>
            <div className="flex overflow-hidden rounded-lg ring-1 ring-surface">
              {ROUNDS.map((n) => (
                <button
                  key={n}
                  onClick={() => setRounds(n)}
                  className={cx('px-3 py-1.5 text-sm', rounds === n ? 'bg-surface text-text' : 'text-sub hover:text-text')}
                >
                  {n === 1 ? '1 volta' : `${n} voltas`}
                </button>
              ))}
            </div>
            <Button variant="primary" disabled={!mic} onClick={() => void start()}>
              {saved ? 'Tocar de novo' : 'Começar'}
            </Button>
          </>
        )}
        <p className="text-sm text-sub">
          {recording && <span className="mr-3 text-err">● gravando</span>}
          {total > SEQUENCE.length && `volta ${round + 1}/${total / SEQUENCE.length} · `}
          certas {reached}/{total} · outras {extra}
          {saved && <span className="ml-3 text-ok">salvo: {saved}</span>}
        </p>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {SEQUENCE.map((item, i) => (
          <li
            key={i}
            className={cx(
              'rounded-lg px-2 py-1 text-center text-xs leading-tight',
              i < inRound ? 'bg-ok/20 text-ok' : i === inRound && recording ? 'bg-accent/25 ring-2 ring-accent' : 'bg-surface/60 text-sub',
            )}
          >
            <span className="block font-medium">{namePtOctave(item.written)}</span>
            <span className="block opacity-70">
              {item.position.string}ª·{item.position.fret}
            </span>
          </li>
        ))}
      </ol>
      <p className="font-mono text-xs leading-relaxed text-sub">
        ouvido:{' '}
        {heard.length
          ? heard.map((h, i) => (
              <span key={i} className={h.ok ? 'text-ok' : 'text-err'}>
                {namePtOctave(writtenFromSounding(parseNote(h.note)))}{' '}
              </span>
            ))
          : '—'}
      </p>
    </div>
  )
}
