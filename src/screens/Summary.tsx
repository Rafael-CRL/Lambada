import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, type ReactNode } from 'react'
import { navigate } from '../app/router'
import { db, recordId, type SessionRecord } from '../db/db'
import { namePt, parseNote } from '../domain/notes'
import { SCALE_LABELS } from '../domain/scales'
import { startActivity } from '../exercises/start'
import { exerciseSubtitle, exerciseTitle, isScoreConfig } from '../exercises/types'
import { StaffSvg } from '../staff/StaffSvg'
import { Button, cx, Kbd } from '../ui/controls'
import { IconRedo, IconTrophy } from '../ui/icons'

async function loadSummary(id: number) {
  const rec = await db.sessions.get(id)
  if (!rec) return { rec: null, prev: null, record: null }
  const prev =
    (await db.sessions
      .where('mode')
      .equals(rec.mode)
      .filter(
        (s) =>
          s.completed !== false &&
          s.startedAt < rec.startedAt &&
          (rec.bpm === undefined || (s.bpm === rec.bpm && (s.rhythmLevel ?? 1) === (rec.rhythmLevel ?? 1))),
      )
      .reverse()
      .sortBy('startedAt'))[0] ?? null
  const record = rec.bpm !== undefined ? await db.records.get(recordId(rec.input, rec.bpm, rec.rhythmLevel)) : null
  return { rec, prev, record }
}

/** "De novo": a mesma atividade (sessões antigas voltam para o tópico). */
function again(rec: SessionRecord) {
  const c = rec.config as unknown
  if (isScoreConfig(c)) startActivity(c.activity)
  else navigate({ name: 'topic', topic: rec.input === 'mic' ? 'violao' : 'pauta' })
}

const acc = (s: SessionRecord) => (s.attempts ? s.correct / s.attempts : 0)

export function Summary({ id }: { id: number }) {
  const data = useLiveQuery(() => loadSummary(id), [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && data?.rec && !(e.target instanceof HTMLButtonElement)) again(data.rec)
      if (e.key === 'Escape') navigate({ name: 'home' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [data])

  if (!data) return null
  const { rec, prev, record } = data
  if (!rec) return <p className="py-20 text-center text-sub">Sessão não encontrada.</p>

  const c = rec.config as unknown
  const isBpm = rec.score !== undefined
  const isSprint = isScoreConfig(c) ? c.tempo === 'free' && c.content !== 'scale' && c.duration === 'timed' : (c as { kind: string }).kind === 'sprint'
  const newRecord = isBpm && record && record.score === rec.score && record.at === rec.endedAt && (rec.score ?? 0) > 0
  const worst = Object.entries(rec.perNote)
    .map(([noteId, t]) => ({ noteId, errors: t.wrong + t.wrongOctave, total: t.correct + t.wrong + t.wrongOctave }))
    .filter((x) => x.errors > 0)
    .sort((a, b) => b.errors - a.errors || b.errors / b.total - a.errors / a.total)
    .slice(0, 6)

  const accDelta = prev ? acc(rec) - acc(prev) : null
  const timeDelta = prev && Number.isFinite(prev.medianTime) && Number.isFinite(rec.medianTime) ? rec.medianTime - prev.medianTime : null

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {exerciseTitle(rec.config)} {exerciseSubtitle(rec.config) && <span className="text-sub">· {exerciseSubtitle(rec.config)}</span>}
        </h1>
        <p className="text-sm text-sub">
          {SCALE_LABELS[rec.scale]} · {rec.accidentals ? 'com acidentes' : 'naturais'}
          {isBpm && ` · ${rec.bpm} bpm · nível ${rec.rhythmLevel ?? 1}`} · {new Date(rec.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>

      {newRecord && (
        <div className="flex animate-pop items-center gap-3 self-start rounded-xl bg-accent px-4 py-2 font-medium text-accent-ink">
          <IconTrophy /> novo recorde a {rec.bpm} bpm no nível {rec.rhythmLevel ?? 1}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {isBpm ? (
          <>
            <Stat label="pontos" value={String(rec.score ?? 0)} big />
            <Stat label="recorde" value={String(record?.score ?? rec.score ?? 0)} />
            <Stat label="combo máx." value={String(rec.maxCombo ?? 0)} />
            <Stat
              label="precisão média"
              value={rec.meanOffsetMs !== undefined ? `±${rec.meanOffsetMs} ms` : '—'}
              note={
                rec.meanSignedOffsetMs !== undefined && Math.abs(rec.meanSignedOffsetMs) >= 10
                  ? `tendência: ${Math.abs(rec.meanSignedOffsetMs)} ms ${rec.meanSignedOffsetMs < 0 ? 'adiantado' : 'atrasado'}`
                  : undefined
              }
            />
          </>
        ) : isSprint ? (
          <>
            <Stat label="acertos" value={String(rec.correct)} big />
            <Stat label="tempo médio" value={fmtS(rec.meanTime)} />
            <Stat label="acerto" value={`${Math.round(acc(rec) * 100)}%`} />
            <Stat label="respostas" value={String(rec.attempts)} />
          </>
        ) : (
          <>
            <Stat label="acerto" value={`${Math.round(acc(rec) * 100)}%`} big />
            <Stat label="tempo mediano" value={fmtS(rec.medianTime)} />
            <Stat label="notas" value={String(rec.attempts)} />
            <Stat label="oitava errada" value={String(rec.wrongOctave)} dim={rec.input === 'buttons'} />
          </>
        )}
      </div>

      {prev && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm text-sub">em relação à sessão anterior</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {isBpm && prev.score !== undefined && (
              <Delta value={(rec.score ?? 0) - prev.score} format={(v) => `${v > 0 ? '+' : ''}${v} pontos`} good={(v) => v > 0} />
            )}
            {isSprint && <Delta value={rec.correct - prev.correct} format={(v) => `${v > 0 ? '+' : ''}${v} acertos`} good={(v) => v > 0} />}
            {accDelta !== null && (
              <Delta value={accDelta} format={(v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} p.p. de acerto`} good={(v) => v > 0} />
            )}
            {timeDelta !== null && !isBpm && (
              <Delta value={timeDelta} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} s no tempo ${isSprint ? 'médio' : 'mediano'}`} good={(v) => v < 0} />
            )}
          </div>
        </section>
      )}

      {worst.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm text-sub">notas mais erradas</h2>
          <div className="overflow-x-auto rounded-xl bg-surface/60 px-3 py-2">
            <StaffSvg
              className="h-36 sm:h-44"
              spacing={48}
              ariaLabel="Notas mais erradas"
              notes={worst.map((w) => ({
                key: w.noteId,
                note: parseNote(w.noteId),
                className: 'is-err',
                label: `${namePt(parseNote(w.noteId))} ${w.errors}×`,
              }))}
            />
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => again(rec)} autoFocus>
          <IconRedo /> de novo <Kbd>enter</Kbd>
        </Button>
        <Button onClick={() => navigate({ name: 'home' })}>início</Button>
        <Button variant="ghost" onClick={() => navigate({ name: 'progress' })}>
          progresso
        </Button>
      </div>
    </div>
  )
}

function fmtS(s: number) {
  return Number.isFinite(s) ? `${s.toFixed(2)} s` : '—'
}

function Stat({ label, value, big, dim, note }: { label: string; value: string; big?: boolean; dim?: boolean; note?: ReactNode }) {
  return (
    <div className={cx('flex flex-col gap-1', dim && 'opacity-40')}>
      <span className="text-sm text-sub">{label}</span>
      <span className={cx('tabular font-mono leading-none', big ? 'text-5xl text-accent' : 'text-3xl')}>{value}</span>
      {note && <span className="text-xs text-sub">{note}</span>}
    </div>
  )
}

function Delta({ value, format, good }: { value: number; format: (v: number) => string; good: (v: number) => boolean }) {
  const neutral = Math.abs(value) < 1e-9
  return (
    <span className={cx('tabular font-mono', neutral ? 'text-sub' : good(value) ? 'text-ok' : 'text-err')}>{format(value)}</span>
  )
}
