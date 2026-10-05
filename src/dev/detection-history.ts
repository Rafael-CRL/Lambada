import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

interface Result { erros: number; perdidas: number; trocadas: number; aMais: number }
interface Recording {
  id: string
  revisar: boolean
  notas: number
  esperado: string[]
  modos: Record<string, Record<string, Result>>
}
export interface DetectionReport {
  geradoEm: string
  leituras: unknown
  parametros: unknown
  risco: { falsos: number; casos: number }
  gravacoes: Recording[]
}
export interface Round {
  schema: 1
  ordem: number
  origem: 'relatorio-anterior' | 'laboratorio'
  descricao: string
  versao: { commit: string | null; branch: string | null; alterado: boolean | null; codigoSha256: string | null }
  arquivos: Record<string, string> | null
  metodo: string
  relatorio: DetectionReport
}
const METHOD = 'sequencia-edicao-v1'
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')

/** Hash do som E do gabarito: arquivos diferentes não entram na mesma comparação. */
export function recordingHashes(root: string, ids: string[]) {
  return Object.fromEntries(ids.map((id) => [id, hash(Buffer.concat([
    readFileSync(join(root, `${id}.wav`)), readFileSync(join(root, `${id}.json`)),
  ]))]))
}

export function codeVersion(root: string): Round['versao'] {
  const git = (...args: string[]) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
    catch { return null }
  }
  // A imagem de Node pode não ter git. HEAD/refs permitem registrar a versão mesmo assim.
  let commit = git('rev-parse', 'HEAD')
  let branch = git('branch', '--show-current')
  if (!commit && existsSync(join(root, '.git/HEAD'))) {
    const head = readFileSync(join(root, '.git/HEAD'), 'utf8').trim()
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5)
      branch = ref.replace(/^refs\/heads\//, '')
      if (existsSync(join(root, '.git', ref))) commit = readFileSync(join(root, '.git', ref), 'utf8').trim()
      else if (existsSync(join(root, '.git/packed-refs'))) {
        commit = readFileSync(join(root, '.git/packed-refs'), 'utf8').split('\n').find((line) => line.endsWith(` ${ref}`))?.split(' ')[0] ?? null
      }
    } else commit = head
  }
  const files = ['src/config.ts', 'src/audio/pitch.ts', 'src/audio/tracker.ts', 'src/audio/wav.ts',
    'src/domain/notes.ts', 'src/dev/laboratorio.test.ts', 'src/dev/detection-history.ts', 'package-lock.json']
  const status = git('status', '--porcelain', '--', ...files)
  return { commit, branch, alterado: status === null ? null : status.length > 0,
    codigoSha256: hash(files.map((file) => `${file}\0${readFileSync(join(root, file), 'utf8')}`).join('\0')) }
}

export function readRounds(dir: string): Round[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => /^\d+\.json$/.test(name))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Round)
    .sort((a, b) => a.ordem - b.ordem)
}

function total(report: DetectionReport, mode: string, ids?: Set<string>) {
  let errors = 0, notes = 0, lost = 0, changed = 0, extra = 0
  for (const rec of report.gravacoes) {
    if (rec.revisar || (ids && !ids.has(rec.id))) continue
    for (const r of Object.values(rec.modos[mode] ?? {})) {
      notes += rec.notas; errors += r.erros; lost += r.perdidas; changed += r.trocadas; extra += r.aMais
    }
  }
  return { errors, notes, lost, changed, extra, accuracy: notes ? (1 - errors / notes) * 100 : null }
}
const percent = (n: number | null) => n === null ? '—' : `${n.toFixed(2)}%`
const safe = (s: string) => s.replace(/[\r\n|]/g, ' ')

/** Séries sobre um conjunto comum confirmado por hashes, sem misturar leituras diferentes. */
function chartData(rounds: Round[]) {
  const first = rounds.find((r) => r.arquivos !== null)
  if (!first) return { rounds: [], ids: new Set<string>() }
  const compatible = rounds.filter((r) => r.arquivos !== null && r.metodo === first.metodo &&
    JSON.stringify(r.relatorio.leituras) === JSON.stringify(first.relatorio.leituras))
  const ids = new Set(first.relatorio.gravacoes.filter((a) => !a.revisar && compatible.every((r) =>
    r.relatorio.gravacoes.some((b) => !b.revisar && b.id === a.id &&
      JSON.stringify(b.esperado) === JSON.stringify(a.esperado) && r.arquivos![b.id] === first.arquivos![a.id]),
  )).map((r) => r.id))
  return { rounds: compatible, ids }
}

export function chartSvg(rounds: Round[], metric: 'accuracy' | 'errors'): string {
  const data = chartData(rounds)
  const title = metric === 'accuracy' ? 'Acerto por rodada (%)' : 'Erros por rodada'
  const series = ['sozinho', 'exercicio'].map((mode) => data.rounds.map((r) => total(r.relatorio, mode, data.ids)))
  const values = series.flat().map((s) => metric === 'accuracy' ? s.accuracy ?? 0 : s.errors)
  const min = metric === 'accuracy' ? Math.min(0, ...values) : 0
  const max = metric === 'accuracy' ? 100 : Math.max(1, ...values) * 1.1
  const x = (i: number) => data.rounds.length <= 1 ? 435 : 85 + i * 700 / (data.rounds.length - 1)
  const y = (n: number) => 340 - (n - min) / (max - min) * 230
  const colors = ['#0369a1', '#a21caf']
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 420" role="img" aria-labelledby="title desc">`,
    `<title id="title">${title}</title>`,
    `<desc id="desc">Resultados offline em ${data.ids.size} gravações comuns com hashes confirmados. Azul: sozinho. Roxo: exercício. Rodadas: ${data.rounds.map((r) => r.ordem).join(', ')}. Os valores também estão nas tabelas do documento.</desc>`,
    '<rect width="860" height="420" fill="#ffffff"/>',
    '<g font-family="sans-serif" font-size="14" fill="#172554">',
    `<text x="85" y="35" font-size="22">${title}</text>`,
    `<text x="85" y="62">${data.ids.size} gravações comuns • avaliação offline</text>`,
    '<text x="580" y="62" fill="#0369a1">● Sozinho</text><text x="690" y="62" fill="#a21caf">◆ Exercício</text>']
  if (!data.ids.size || !data.rounds.length) svg.push('<text x="85" y="200">Sem gravações comuns confirmadas para gerar o gráfico.</text>')
  else {
    for (let tick = 0; tick <= 4; tick++) {
      const value = min + (max - min) * tick / 4
      svg.push(`<path d="M85 ${y(value)}H785" stroke="#cbd5e1"/><text x="72" y="${y(value) + 5}" text-anchor="end">${value.toFixed(1)}</text>`)
    }
    data.rounds.forEach((r, i) => svg.push(`<text x="${x(i)}" y="370" text-anchor="middle">${r.ordem}</text>`))
    series.forEach((items, j) => {
      const ns = items.map((s) => metric === 'accuracy' ? s.accuracy ?? 0 : s.errors)
      svg.push(`<polyline points="${ns.map((n, i) => `${x(i)},${y(n)}`).join(' ')}" fill="none" stroke="${colors[j]}" stroke-width="3"${j ? ' stroke-dasharray="7 4"' : ''}/>`)
      ns.forEach((n, i) => svg.push(j
        ? `<path d="M${x(i)} ${y(n) - 6}l6 6 -6 6 -6 -6Z" fill="${colors[j]}"/>`
        : `<circle cx="${x(i)}" cy="${y(n)}" r="5" fill="${colors[j]}"/>`))
    })
    svg.push('<text x="435" y="405" text-anchor="middle">Ordem da rodada</text>')
  }
  return [...svg, '</g></svg>', ''].join('\n')
}

export function overview(rounds: Round[]): string {
  const lines = ['# Histórico da detecção de áudio', '',
    'Rodadas em ordem de execução; cada JSON preserva os resultados completos. As datas são informativas. Rodadas antigas importadas são identificadas; não reconstruímos execuções que não foram salvas.', '',
    'Os totais excluem `revisar/`. Acerto = 100 × (1 − distância de edição / notas esperadas em todas as leituras). Notas extras também contam como erro; este índice não mede precisão temporal nem qualidade em outros instrumentos ou ambientes.', '',
    '| Rodada | Data UTC | Versão | Gravações | Sozinho: erros / notas | Acerto | Exercício: erros / notas | Acerto | Risco: falsos / casos | Descrição |',
    '|---|---|---|---|---|---|---|---|---|---|']
  const chart = chartData(rounds)
  lines.splice(6, 0, '## Gráficos', '',
    `As curvas usam ${chart.ids.size} gravações comuns nas rodadas com hashes e leituras compatíveis (${chart.rounds.map((r) => r.ordem).join(', ') || 'nenhuma'}). Relatórios importados sem hashes aparecem apenas nas tabelas. Uma rodada com outras leituras fica fora destas curvas.`, '',
    '![Acerto por rodada: sozinho e exercício](graficos/acertos.svg)', '',
    '![Erros por rodada: sozinho e exercício](graficos/erros.svg)', '',
    '## Resultados por rodada', '')
  for (const round of rounds) {
    const solo = total(round.relatorio, 'sozinho'), exercise = total(round.relatorio, 'exercicio')
    const version = round.versao.commit?.slice(0, 7) ?? 'não registrada'
    lines.push(`| [${round.ordem}](./${String(round.ordem).padStart(4, '0')}.json) | ${round.relatorio.geradoEm} | ${version}${round.versao.alterado ? ' + alterações' : ''} | ${round.relatorio.gravacoes.filter((r) => !r.revisar).length} | ${solo.errors} / ${solo.notes} | ${percent(solo.accuracy)} | ${exercise.errors} / ${exercise.notes} | ${percent(exercise.accuracy)} | ${round.relatorio.risco.falsos} / ${round.relatorio.risco.casos} | ${safe(round.descricao)} |`)
  }
  if (rounds.length >= 2) {
    const last = rounds[rounds.length - 1]
    const verifiedFirst = rounds.find((r) => r.arquivos !== null)
    const firsts = [rounds[0]]
    if (verifiedFirst && verifiedFirst !== rounds[0] && verifiedFirst !== last) firsts.push(verifiedFirst)
    for (const first of firsts) {
      const label = first === rounds[0] ? 'Primeira × última' : 'Primeira com hashes × última'
      lines.push('', `## ${label}: rodadas ${first.ordem} e ${last.ordem}`, '')
      const readingsMatch = first.metodo === last.metodo && JSON.stringify(first.relatorio.leituras) === JSON.stringify(last.relatorio.leituras)
      const common = new Set(first.relatorio.gravacoes.filter((a) => !a.revisar && last.relatorio.gravacoes.some((b) =>
        !b.revisar && a.id === b.id && JSON.stringify(a.esperado) === JSON.stringify(b.esperado) &&
        (!first.arquivos || !last.arquivos || first.arquivos[a.id] === last.arquivos[b.id]),
      )).map((r) => r.id))
      if (!readingsMatch || !common.size) lines.push('Sem comparação direta: método, leituras ou gravações não são compatíveis.')
      else {
        lines.push(`Comparação sobre ${common.size} gravações comuns, com o mesmo gabarito e as mesmas leituras.`, '')
        if (!first.arquivos || !last.arquivos) lines.push('**Comparação histórica provisória:** o relatório importado não contém hashes dos arquivos. A identidade dos WAVs não pode ser confirmada; a comparação considera os IDs e gabaritos registrados.', '')
        lines.push('| Modo | Erros: primeira → última | Acerto: primeira → última | Variação (pontos percentuais) |', '|---|---|---|---|')
        for (const mode of ['sozinho', 'exercicio']) {
          const a = total(first.relatorio, mode, common), b = total(last.relatorio, mode, common)
          if (!a.notes || a.notes !== b.notes) continue
          lines.push(`| ${mode} | ${a.errors} → ${b.errors} | ${percent(a.accuracy)} → ${percent(b.accuracy)} | ${((b.accuracy ?? 0) - (a.accuracy ?? 0)).toFixed(2)} |`)
        }
        lines.push('', '| Modo | Perdidas: primeira → última | Trocadas: primeira → última | Extras: primeira → última |', '|---|---|---|---|')
        for (const mode of ['sozinho', 'exercicio']) {
          const a = total(first.relatorio, mode, common), b = total(last.relatorio, mode, common)
          if (!a.notes || a.notes !== b.notes) continue
          lines.push(`| ${mode} | ${a.lost} → ${b.lost} | ${a.changed} → ${b.changed} | ${a.extra} → ${b.extra} |`)
        }
      }
    }
    lines.push('', 'Os totais de rodadas com conjuntos diferentes não devem ser comparados diretamente. Risco é uma medida comparativa com notas esperadas deslocadas de propósito, não uma taxa absoluta de falsos positivos.')
  }
  lines.push('', '## Rastreabilidade', '',
    'Cada rodada nova registra commit, branch, parâmetros, hash do código e dependências, hashes de WAV + JSON, erros por gravação/modo/leitura e risco. `alterado: null` significa que Git não estava disponível para verificar alterações; o hash registra o conteúdo efetivamente testado.', '',
    'Esta é uma avaliação offline de gravações reais. A suíte de regressão e a validação ao vivo são verificações adicionais. A linha de base anterior ao histórico está em [inicial-35ce63a.json](../inicial-35ce63a.json), apenas no modo sozinho.', '')
  return lines.join('\n')
}

/** Um único escritor; arquivos numerados criados exclusivamente, sem sobrescrever rodadas. */
export function archiveReport(root: string, report: DetectionReport, description = 'Detector atual') {
  const dir = join(root, 'docs/deteccao/historico')
  mkdirSync(dir, { recursive: true })
  const lock = join(dir, '.lock')
  mkdirSync(lock) // outra execução deve terminar antes de iniciar esta
  try {
    const rounds = readRounds(dir)
    const append = (round: Omit<Round, 'ordem'>) => {
      const full: Round = { ...round, ordem: (rounds.at(-1)?.ordem ?? 0) + 1 }
      writeFileSync(join(dir, `${String(full.ordem).padStart(4, '0')}.json`), JSON.stringify(full, null, 1) + '\n', { flag: 'wx' })
      rounds.push(full)
    }
    const previous = join(root, 'docs/deteccao/dados.json')
    if (!rounds.length && existsSync(previous)) append({ schema: 1, origem: 'relatorio-anterior',
      descricao: 'Relatório preservado antes do início do histórico; versão e arquivos não registrados',
      versao: { commit: null, branch: null, alterado: null, codigoSha256: null }, arquivos: null,
      metodo: METHOD, relatorio: JSON.parse(readFileSync(previous, 'utf8')) as DetectionReport })
    append({ schema: 1, origem: 'laboratorio', descricao: description, versao: codeVersion(root),
      arquivos: recordingHashes(join(root, 'src/audio/fixtures'), report.gravacoes.map((r) => r.id)), metodo: METHOD, relatorio: report })
    writeOverview(root)
    writeFileSync(previous, JSON.stringify(report, null, 1) + '\n')
    return rounds.at(-1)!.ordem
  } finally { rmSync(lock, { recursive: true }) }
}

/** Atualiza apenas a apresentação; não cria nem altera registros de rodadas. */
export function writeOverview(root: string) {
  const dir = join(root, 'docs/deteccao/historico')
  const rounds = readRounds(dir)
  mkdirSync(join(dir, 'graficos'), { recursive: true })
  writeFileSync(join(dir, 'RESULTADOS.md'), overview(rounds))
  writeFileSync(join(dir, 'graficos/acertos.svg'), chartSvg(rounds, 'accuracy'))
  writeFileSync(join(dir, 'graficos/erros.svg'), chartSvg(rounds, 'errors'))
  writeFileSync(join(dir, 'README.md'), '# Histórico da detecção\n\nConsulte os [resultados dos testes, gráficos e comparações](RESULTADOS.md).\n\nOs JSONs numerados preservam cada rodada completa.\n')
}
