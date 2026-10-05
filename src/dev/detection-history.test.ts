import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { archiveReport, overview, readRounds } from './detection-history'
import type { DetectionReport, Round } from './detection-history'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
function report(errors = 1): DetectionReport {
  return { geradoEm: '2026-10-04T12:00:00.000Z', leituras: { '60': { fps: 60 } }, parametros: {}, risco: { falsos: 0, casos: 16 },
    gravacoes: [false, true].map((revisar) => ({ id: revisar ? 'revisar/fraca' : 'escala', revisar, notas: 2, esperado: ['E2', 'A2'],
      modos: Object.fromEntries(['sozinho', 'exercicio'].map((mode) => [mode, { '60': {
        erros: revisar ? 99 : errors, perdidas: errors, trocadas: 0, aMais: 0,
      } }])) })) }
}
function round(order: number, errors: number): Round {
  return { schema: 1, ordem: order, origem: 'laboratorio', descricao: 'Teste',
    versao: { commit: 'abcdef123', branch: 'teste', alterado: false, codigoSha256: 'codigo' },
    arquivos: { escala: 'som' }, metodo: 'sequencia-edicao-v1', relatorio: report(errors) }
}
function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'lambada-history-')); dirs.push(root)
  const files = ['src/config.ts', 'src/audio/pitch.ts', 'src/audio/tracker.ts', 'src/audio/wav.ts',
    'src/domain/notes.ts', 'src/dev/laboratorio.test.ts', 'src/dev/detection-history.ts', 'package-lock.json',
    'src/audio/fixtures/escala.wav', 'src/audio/fixtures/escala.json',
    'src/audio/fixtures/revisar/fraca.wav', 'src/audio/fixtures/revisar/fraca.json']
  for (const file of files) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), file) }
  mkdirSync(join(root, 'docs/deteccao'), { recursive: true })
  return root
}

describe('histórico do detector', () => {
  test('preserva o relatório anterior uma vez e não sobrescreve rodadas', () => {
    const root = workspace(), previous = report(2)
    writeFileSync(join(root, 'docs/deteccao/dados.json'), JSON.stringify(previous))
    expect(archiveReport(root, report(1), 'Primeira execução nova')).toBe(2)
    const path = join(root, 'docs/deteccao/historico'), first = readFileSync(join(path, '0001.json'), 'utf8')
    expect(archiveReport(root, report(0), 'Melhoria')).toBe(3)
    const rounds = readRounds(path)
    expect(rounds.map((r) => r.ordem)).toEqual([1, 2, 3])
    expect(rounds[0].origem).toBe('relatorio-anterior')
    expect(rounds[0].relatorio).toEqual(previous)
    expect(readFileSync(join(path, '0001.json'), 'utf8')).toBe(first)
    expect(rounds[1].arquivos?.escala).toMatch(/^[a-f0-9]{64}$/)
    expect(rounds[1].versao.codigoSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.parse(readFileSync(join(root, 'docs/deteccao/dados.json'), 'utf8'))).toEqual(report(0))
    expect(readFileSync(join(path, 'README.md'), 'utf8')).toContain('rodadas 1 e 3')
  })
  test('começa em 1 sem relatório anterior e identifica alterações no áudio e gabarito', () => {
    const root = workspace()
    expect(archiveReport(root, report())).toBe(1)
    writeFileSync(join(root, 'src/audio/fixtures/escala.json'), 'gabarito alterado')
    archiveReport(root, report())
    const rounds = readRounds(join(root, 'docs/deteccao/historico'))
    expect(rounds[0].arquivos?.escala).not.toBe(rounds[1].arquivos?.escala)
  })
  test('compara primeira e última, exclui revisão e calcula pontos percentuais', () => {
    const text = overview([round(1, 2), round(2, 1), round(3, 0)])
    expect(text).toContain('rodadas 1 e 3')
    expect(text).toContain('| sozinho | 2 → 0 | 0.00% → 100.00% | 100.00 |')
    expect(text).toContain('1 gravações comuns')
    expect(text).not.toContain('101 /')
  })
  test('bloqueia comparação de arquivos ou condições diferentes', () => {
    const first = round(1, 1), last = round(2, 0)
    last.arquivos = { escala: 'outro som' }
    expect(overview([first, last])).toContain('Sem comparação direta')
    last.arquivos = first.arquivos
    last.relatorio.leituras = { '144': { fps: 144 } }
    expect(overview([first, last])).toContain('Sem comparação direta')
    last.relatorio.leituras = first.relatorio.leituras
    last.relatorio.gravacoes[0].esperado = ['E2', 'B2']
    expect(overview([first, last])).toContain('Sem comparação direta')
  })
  test('avisa quando a comparação com um relatório importado é provisória', () => {
    const first = round(1, 1); first.arquivos = null
    expect(overview([first, round(2, 0)])).toContain('Comparação histórica provisória')
    expect(overview([first, round(2, 1), round(3, 0)])).toContain('Primeira com hashes × última: rodadas 2 e 3')
  })
})
