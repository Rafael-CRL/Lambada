import { useEffect, useRef, useState } from 'react'
import { ensureAudioRunning } from '../audio/clock'
import { Microphone } from '../audio/microphone'
import { encodeWav } from '../audio/wav'
import { loadSettings } from '../db/db'
import { defaultSpelling, namePtOctave, noteId, parseNote, writtenFromSounding } from '../domain/notes'
import { MicMeter } from '../exercises/MicMeter'
import { Button, cx } from '../ui/controls'
import { Capture } from './capture'
import { nextName, recordingsOf, TAKES, type Take, type TakeRecord } from './takes'

/**
 * `#/gravar` (só em desenvolvimento): grava o violão pelo mesmo caminho que o
 * detector ouve e salva em `src/audio/fixtures/`, com as notas esperadas e o
 * que o detector achou ao vivo. O teste `tracker.fixtures.test.ts` roda o
 * detector de novo sobre cada gravação. Gravar de novo cria outra gravação;
 * a que saiu errada se descarta logo depois.
 */
export default function RecorderScreen() {
  const [mic, setMic] = useState<Microphone | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<string[]>([])
  const [recording, setRecording] = useState<Take | null>(null)
  const [heard, setHeard] = useState<string[]>([])
  const [result, setResult] = useState<{ take: string; name: string; live: string[] } | null>(null)
  const capture = useRef<Capture | null>(null)
  const live = useRef<TakeRecord['live']>([])
  const recordingRef = useRef(false)

  const refresh = () =>
    fetch('/__fixtures')
      .then((r) => r.json())
      .then(setSaved)
      .catch(() => setError('não consegui listar as gravações'))

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
    void refresh()
    return () => {
      cancelled = true
      created?.dispose()
      opened?.close()
      capture.current = null
    }
  }, [])

  // o detector ao vivo, como numa atividade
  useEffect(() => {
    if (!mic) return
    let id = 0
    const tick = () => {
      id = requestAnimationFrame(tick)
      for (const e of mic.poll()) {
        if (e.type !== 'note' || !recordingRef.current) continue
        const note = noteId(defaultSpelling(e.midi))
        // de volta ao tempo de contexto (o poll desconta a latência)
        live.current.push({ note, onset: e.onsetTime + mic.compensation, time: e.time + mic.compensation })
        setHeard((h) => [...h, note])
      }
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [mic])

  const start = async (take: Take) => {
    if (!capture.current || !(await ensureAudioRunning())) return
    live.current = []
    setHeard([])
    setResult(null)
    setError('')
    capture.current.begin()
    recordingRef.current = true
    setRecording(take)
  }

  const stop = async () => {
    const take = recording
    // clique duplo: a segunda chamada chega antes do await terminar
    if (!take || !capture.current || !mic || !recordingRef.current) return
    recordingRef.current = false
    const rec = await capture.current.end()
    setRecording(null)
    const end = rec.start + rec.samples.length / rec.sampleRate
    const at = (t: number) => Math.round((t - rec.start) * 1000) / 1000
    const name = nextName(take, saved)
    const record: TakeRecord = {
      id: name,
      take: take.id,
      how: take.how,
      expected: take.expected,
      sampleRate: rec.sampleRate,
      device: mic.label,
      recordedAt: new Date().toISOString(),
      live: live.current.filter((n) => n.onset >= rec.start && n.time <= end).map((n) => ({ ...n, onset: at(n.onset), time: at(n.time) })),
    }
    try {
      const post = async (file: string, body: BodyInit) => {
        const r = await fetch(`/__fixtures?file=${file}`, { method: 'POST', body })
        if (!r.ok) throw new Error(`${file}: ${r.status}`)
      }
      await post(`${name}.wav`, encodeWav(rec.samples, rec.sampleRate))
      await post(`${name}.json`, JSON.stringify(record, null, 2) + '\n')
      setResult({ take: take.id, name, live: record.live.map((n) => n.note) })
    } catch (e) {
      setError(`não salvou: ${String(e)}`)
    }
    await refresh()
  }

  const discard = async (name: string) => {
    const r = await fetch(`/__fixtures?name=${name}`, { method: 'DELETE' }).catch(() => null)
    if (!r?.ok) setError(`não consegui descartar ${name}`)
    setResult(null)
    await refresh()
  }

  const groups = [...new Set(TAKES.map((t) => t.group))]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Gravar testes do detector</h1>
        <p className="mt-1 text-sm text-sub">
          Cada gravação vai para <code>src/audio/fixtures/</code>. Grave num lugar silencioso, com o microfone de sempre. Gravar de novo cria outra gravação; se a
          execução sair errada (nota trocada, pulada ou a mais), descarte.
        </p>
      </div>
      {error && <p className="text-sm text-err">{error}</p>}
      {mic && <MicMeter mic={mic} />}
      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-sub">{group}</h2>
          <ul className="flex flex-col gap-2">
            {TAKES.filter((t) => t.group === group).map((take) => {
              const active = recording?.id === take.id
              const done = result?.take === take.id ? result : null
              const count = recordingsOf(take, saved).length
              return (
                <li key={take.id} className={cx('flex flex-col gap-2 rounded-xl bg-surface/60 px-4 py-3', active && 'ring-2 ring-accent')}>
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {take.title} {count > 0 && <span className="text-sm text-ok">· {count === 1 ? 'gravada' : `${count} gravadas`}</span>}
                      </p>
                      <p className="text-sm text-sub">{take.how}</p>
                    </div>
                    {active ? (
                      <Button variant="primary" onClick={() => void stop()}>
                        Parar
                      </Button>
                    ) : (
                      <Button disabled={!mic || !!recording} onClick={() => void start(take)}>
                        {count ? 'Gravar outra' : 'Gravar'}
                      </Button>
                    )}
                  </div>
                  {active && <Comparison expected={take.expected} heard={heard} />}
                  {done && (
                    <div className="flex items-end gap-4">
                      <div className="min-w-0 flex-1">
                        <Comparison expected={take.expected} heard={done.live} done />
                      </div>
                      <Button variant="ghost" onClick={() => void discard(done.name)}>
                        Descartar
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

const name = (id: string) => namePtOctave(writtenFromSounding(parseNote(id)))

function Comparison({ expected, heard, done = false }: { expected: string[]; heard: string[]; done?: boolean }) {
  const same = heard.length === expected.length && heard.every((n, i) => n === expected[i])
  return (
    <div className="font-mono text-xs leading-relaxed text-sub">
      <p>esperado: {expected.map(name).join(' ')}</p>
      <p>
        ouvido: {heard.map(name).join(' ') || '—'}
        {done && <span className={cx('ml-2 font-sans', same ? 'text-ok' : 'text-err')}>{same ? 'igual' : 'diferente'}</span>}
      </p>
    </div>
  )
}
