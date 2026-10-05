import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { test } from 'vitest'
import { fileURLToPath } from 'node:url'
import { archiveReport, writeOverview } from './detection-history'
import { createPitchDetector } from '../audio/pitch'
import { NoteTracker } from '../audio/tracker'
import { decodeWav } from '../audio/wav'
import { DETECTION } from '../config'
import { defaultSpelling, midiOf, noteId, parseNote } from '../domain/notes'

/**
 * Laboratório do detector sobre as gravações reais (`src/audio/fixtures/`).
 * Não roda na suíte: cada parte liga com uma variável de ambiente.
 *
 *   GRAVACAO=escala-solta-1,revisar/escala-solta-fraca-1   onde errou, em cada leitura
 *     (+ EXERCICIO=1: com a nota esperada; LISTA=1: notas achadas; PARAMS='{"stableTime":0.05}')
 *   DUMP=escala-solta-3:8.0-9.0 [ESPERADA=D4]              cada leitura (60 Hz) no trecho
 *   VARREDURA='{"atual":{},"s2.5":{"onsetSharpness":2.5}}'  erros por variante, sozinho e no exercício
 *     (+ SO='^escala-solta' filtra as gravações; RISCO=1 mede o risco com a esperada errada)
 *   RELATORIO=1                                             arquiva uma rodada + atualiza dados.json (RODADA="descrição" opcional)
 *
 * Ex.: docker compose exec -e GRAVACAO=escala-solta-3 -e EXERCICIO=1 app npx vitest run src/dev/laboratorio.test.ts
 * Nomes são relativos a `fixtures/` (`revisar/…`, `sessao/…` para as subpastas).
 */

const FIX = new URL('../audio/fixtures/', import.meta.url)
const env = process.env
type Params = typeof DETECTION

/** Leituras do AnalyserNode como ao vivo: tela de 60 ou 144 Hz, outra fase, ritmo irregular. */
const READINGS: Record<string, { fps: number; jitter?: number; offset?: number }> = {
  '60': { fps: 60 },
  '60b': { fps: 60, offset: 0.008 },
  '144': { fps: 144 },
  '60j': { fps: 60, jitter: 0.5 },
}

interface Found {
  note: string
  midi: number
  onset: number
  cents: number
}

interface Recording {
  id: string
  expected: string[]
  how?: string
  obs?: string
  samples: Float32Array
  sampleRate: number
}

function load(name: string): Recording {
  const r = JSON.parse(readFileSync(new URL(`${name}.json`, FIX), 'utf8')) as Omit<Recording, 'samples' | 'sampleRate'>
  const { samples, sampleRate } = decodeWav(readFileSync(new URL(`${name}.wav`, FIX)))
  return { ...r, id: name, samples, sampleRate }
}

/** As gravações do teste (raiz de `fixtures/`), e as de `revisar/` com `extra`. */
function all(extra = false): Recording[] {
  const names = readdirSync(FIX).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  const sub = new URL('revisar/', FIX)
  if (extra && existsSync(sub)) names.push(...readdirSync(sub).filter((f) => f.endsWith('.json')).map((f) => `revisar/${f.slice(0, -5)}`))
  const re = env.SO ? new RegExp(env.SO) : null
  return names.filter((n) => !re || re.test(n)).sort().map(load)
}

/**
 * Roda o detector como ao vivo. `seq` (MIDI soando): como no exercício, com a
 * nota esperada, que anda a cada acerto e, como as gravações foram tocadas
 * direto, também quando ele ouve a seguinte. `shift`: esperada deslocada da
 * tocada, para medir quantas vezes ele "ouve" a esperada sem ela ter sido
 * tocada (`fp`).
 */
function run(rec: Recording, reading: (typeof READINGS)[string], p: Params = DETECTION, seq?: number[], shift = 0) {
  const tracker = new NoteTracker(createPitchDetector(p), rec.sampleRate, p)
  const size = p.bufferSize
  let seed = 7919
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const found: Found[] = []
  let pos = 0
  let fp = 0
  const sr = rec.sampleRate
  for (let t = size / sr + (reading.offset ?? 0); t * sr <= rec.samples.length; t += (1 + (reading.jitter ?? 0) * (2 * rand() - 1)) / reading.fps) {
    const end = Math.floor(t * sr)
    tracker.expected = seq && pos < seq.length ? seq[pos] + shift : null
    for (const e of tracker.process(rec.samples.subarray(end - size, end), end / sr)) {
      if (e.type !== 'note') continue
      found.push({ note: noteId(defaultSpelling(e.midi)), midi: e.midi, onset: Math.round(e.onsetTime * 1000) / 1000, cents: Math.round(e.cents) })
      if (!seq) continue
      if (shift && e.midi === tracker.expected) fp++
      if (e.midi === seq[pos]) pos++
      else if (!shift && e.midi === seq[pos + 1]) pos += 2
    }
  }
  return { found, fp }
}

type OpKind = 'perdida' | 'trocada' | 'a mais'
interface Op {
  kind: OpKind
  /** posição (1…) na sequência esperada; ausente em "a mais" */
  index?: number
  expected?: string
  heard?: string
  /** s desde o início do arquivo (a nota ouvida, ou a última antes da perdida) */
  at?: number
}

/** Alinhamento (distância de edição) com as operações: onde errou. */
function align(expected: string[], got: Found[]): { errors: number; ops: Op[] } {
  const n = expected.length
  const m = got.length
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (expected[i - 1] === got[j - 1].note ? 0 : 1))
  const ops: Op[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (expected[i - 1] === got[j - 1].note ? 0 : 1)) {
      if (expected[i - 1] !== got[j - 1].note) ops.push({ kind: 'trocada', index: i, expected: expected[i - 1], heard: got[j - 1].note, at: got[j - 1].onset })
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ kind: 'perdida', index: i, expected: expected[i - 1], at: j > 0 ? got[j - 1].onset : undefined })
      i--
    } else {
      ops.push({ kind: 'a mais', heard: got[j - 1].note, at: got[j - 1].onset })
      j--
    }
  }
  return { errors: d[n][m], ops: ops.reverse() }
}

const opText = (o: Op) =>
  o.kind === 'a mais'
    ? `a mais: ${o.heard} @${o.at}s`
    : o.kind === 'trocada'
      ? `#${o.index} ${o.expected} → ouviu ${o.heard} @${o.at}s`
      : `#${o.index} ${o.expected} perdida${o.at !== undefined ? ` (depois de @${o.at}s)` : ''}`

const seqOf = (rec: Recording) => rec.expected.map((id) => midiOf(parseNote(id)))

function rmsOf(b: Float32Array, i: number, j: number): number {
  let s = 0
  for (let k = i; k < j; k++) s += b[k] * b[k]
  return Math.sqrt(s / Math.max(1, j - i))
}

/** Nível em janelas de 50 ms: pico (p95), mediana e ruído de fundo (p10). */
function levels(rec: Recording) {
  const step = Math.round(rec.sampleRate / 20)
  const rs: number[] = []
  for (let i = 0; i + step <= rec.samples.length; i += step) rs.push(rmsOf(rec.samples, i, i + step))
  rs.sort((a, b) => a - b)
  const q = (x: number) => Math.round(rs[Math.floor(rs.length * x)] * 10000) / 10000
  return { pico: q(0.95), mediana: q(0.5), ruido: q(0.1) }
}

// ------------------------------------------------------------------ partes

test.skipIf(!env.GRAVACAO)('gravação', () => {
  const p = { ...DETECTION, ...JSON.parse(env.PARAMS ?? '{}') } as Params
  for (const name of env.GRAVACAO!.split(',')) {
    const rec = load(name)
    const lines = [`\n=== ${name} (${(rec.samples.length / rec.sampleRate).toFixed(1)} s, ${rec.expected.length} notas${env.EXERCICIO ? ', no exercício' : ''})`]
    for (const [label, r] of Object.entries(READINGS)) {
      const { found } = run(rec, r, p, env.EXERCICIO ? seqOf(rec) : undefined)
      const a = align(rec.expected, found)
      lines.push(`${label}: ${a.errors} erros`, ...a.ops.map((o) => `   ${opText(o)}`))
      if (env.LISTA) lines.push('   ' + found.map((f) => `${f.note}@${f.onset.toFixed(2)}${f.cents >= 0 ? '+' : ''}${f.cents}`).join(' '))
    }
    console.log(lines.join('\n'))
  }
})

test.skipIf(!env.DUMP)('leituras', () => {
  const [name, range] = env.DUMP!.split(':')
  const [from, to] = range.split('-').map(Number)
  const rec = load(name)
  const tracker = new NoteTracker(createPitchDetector(), rec.sampleRate)
  if (env.ESPERADA) tracker.expected = midiOf(parseNote(env.ESPERADA))
  const pitch = createPitchDetector()
  const size = DETECTION.bufferSize
  const block = DETECTION.energyBlock
  const lines: string[] = []
  for (let end = size; end <= rec.samples.length; end += Math.round(rec.sampleRate / 60)) {
    const buf = rec.samples.subarray(end - size, end)
    const t = end / rec.sampleRate
    const sharp = (tracker as unknown as { sharpness(b: Float32Array, n: number): number }).sharpness(buf, 800)
    const ev = tracker.process(buf, t)
    if (t < from || t > to) continue
    const r = pitch.detect(buf, rec.sampleRate)
    const note = r ? noteId(defaultSpelling(Math.round(12 * Math.log2(r.freq / 440) + 69))) : '-'
    const events = ev.map((e) => (e.type === 'note' ? `NOTE ${noteId(defaultSpelling(e.midi))}` : e.type.toUpperCase())).join(' ')
    lines.push(
      `${t.toFixed(3)} rms=${rmsOf(buf, size - 2 * block, size).toFixed(4)} ${note.padEnd(4)} f=${r ? r.freq.toFixed(1) : '-'} c=${r ? r.clarity.toFixed(2) : '-'} subida=${sharp.toFixed(1)} ${events}`,
    )
  }
  console.log(lines.join('\n'))
})

test.skipIf(!env.VARREDURA)(
  'varredura',
  () => {
    const recs = all()
    const variants: Record<string, Partial<Params>> = JSON.parse(env.VARREDURA!)
    const rows: string[] = []
    for (const [label, over] of Object.entries(variants)) {
      const p = { ...DETECTION, ...over } as Params
      for (const exercise of [false, true]) {
        const kinds: Record<OpKind, number> = { perdida: 0, trocada: 0, 'a mais': 0 }
        let total = 0
        const per: string[] = []
        for (const rec of recs) {
          let e = 0
          for (const r of Object.values(READINGS)) {
            const a = align(rec.expected, run(rec, r, p, exercise ? seqOf(rec) : undefined).found)
            e += a.errors
            for (const o of a.ops) kinds[o.kind]++
          }
          total += e
          if (e) per.push(`${rec.id}=${e}`)
        }
        const k = `${kinds.perdida} perdidas, ${kinds.trocada} trocadas, ${kinds['a mais']} a mais`
        rows.push(`${label} ${exercise ? 'no exercício' : 'sozinho'}: ${total} erros (${k}) | ${per.join(' ')}`)
      }
      if (env.RISCO) {
        const r = risk(recs, p)
        rows.push(`${label} risco: ${r.falsos} falsos em ${r.casos} · por deslocamento ${JSON.stringify(r.porDeslocamento)}`)
      }
    }
    console.log(rows.join('\n'))
  },
  3_600_000,
)

const SHIFTS = [1, -1, 2, -2, 7, -5, 12, -12]

/** Esperada errada de propósito (semitom, tom, quinta, oitava): quantas vezes ele "ouve" a esperada. */
function risk(recs: Recording[], p: Params) {
  let falsos = 0
  let casos = 0
  const porDeslocamento: Record<string, number> = {}
  for (const rec of recs)
    for (const shift of SHIFTS) {
      const f = run(rec, READINGS['60'], p, seqOf(rec), shift).fp
      falsos += f
      porDeslocamento[shift] = (porDeslocamento[shift] ?? 0) + f
      casos += rec.expected.length
    }
  return { falsos, casos, porDeslocamento }
}

/**
 * `docs/deteccao/dados.json`: cada gravação (nível, andamento, erros por leitura e
 * modo, onde errou, desvio de afinação) e o risco, com o detector atual. É o
 * que um painel pode ler; `DETECCAO-DADOS.md` explica os campos.
 */
test.skipIf(!env.RELATORIO)(
  'relatório',
  () => {
    const recs = all(true)
    const gravacoes = recs.map((rec) => {
      const seq = seqOf(rec)
      const modos = Object.fromEntries(
        (['sozinho', 'exercicio'] as const).map((modo) => [
          modo,
          Object.fromEntries(
            Object.entries(READINGS).map(([label, r]) => {
              const { found } = run(rec, r, DETECTION, modo === 'exercicio' ? seq : undefined)
              const a = align(rec.expected, found)
              const count = (k: OpKind) => a.ops.filter((o) => o.kind === k).length
              return [label, { erros: a.errors, perdidas: count('perdida'), trocadas: count('trocada'), aMais: count('a mais'), ops: a.ops }]
            }),
          ),
        ]),
      )
      // andamento (notas tocadas entre o primeiro e o último ataque achados) e
      // afinação, pela leitura de 60 Hz no exercício; sem andamento se ele achou
      // menos da metade (polifonia)
      const { found } = run(rec, READINGS['60'], DETECTION, seq)
      const onsets = found.map((f) => f.onset)
      const span = found.length >= rec.expected.length / 2 ? onsets[onsets.length - 1] - onsets[0] : 0
      return {
        id: rec.id,
        revisar: rec.id.startsWith('revisar/'),
        como: rec.how,
        obs: rec.obs,
        duracao: Math.round((rec.samples.length / rec.sampleRate) * 10) / 10,
        notas: rec.expected.length,
        notasPorSegundo: span > 0 ? Math.round(((rec.expected.length - 1) / span) * 100) / 100 : null,
        nivel: levels(rec),
        esperado: rec.expected,
        achado60: found.map(({ note, onset, cents }) => ({ note, onset, cents })),
        modos,
      }
    })
    const tested = recs.filter((r) => !r.id.startsWith('revisar/'))
    const out = {
      geradoEm: new Date().toISOString(),
      leituras: READINGS,
      parametros: DETECTION,
      risco: risk(tested, DETECTION),
      gravacoes,
    }
    const order = archiveReport(fileURLToPath(new URL('../../', import.meta.url)), out, env.RODADA)
    console.log(`Rodada ${order} salva em docs/deteccao/historico/; resumo em historico/RESULTADOS.md`)
  },
  3_600_000,
)

// Regera a documentação a partir das rodadas salvas, sem executar ou criar outra rodada.
test.skipIf(!env.HISTORICO)('apresentação do histórico', () => {
  writeOverview(fileURLToPath(new URL('../../', import.meta.url)))
})
