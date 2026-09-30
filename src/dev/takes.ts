/**
 * Gravações de teste do detector: o que tocar em cada uma e as notas
 * esperadas (MIDI soando, como o detector entrega: o violão soa uma oitava
 * abaixo do escrito). Gravadas em `#/gravar` (só em desenvolvimento), ficam
 * em `src/audio/fixtures/<id>.wav` + `<id>.json`; a 2ª gravação da mesma
 * tomada é `<id>-2`, e assim por diante.
 */

export interface Take {
  id: string
  group: string
  title: string
  how: string
  /** notas soando, em ordem */
  expected: string[]
}

/** O `.json` ao lado de cada `.wav`. */
export interface TakeRecord {
  /** nome do arquivo (sem extensão) */
  id: string
  /** a tomada (`Take.id`); ausente nas primeiras gravações, em que é igual a `id` */
  take?: string
  how: string
  /** notas soando, em ordem: o que foi tocado de fato (corrigido à mão se a execução errou) */
  expected: string[]
  /** por que `expected` difere do pedido */
  obs?: string
  sampleRate: number
  device: string
  recordedAt: string
  /** o que o detector achou ao vivo, na gravação (s desde o início do arquivo) */
  live: { note: string; onset: number; time: number }[]
}

const times = (id: string, n: number) => Array.from({ length: n }, () => id)
const upDown = (up: string[]) => [...up, ...up.slice(0, -1).reverse()]
/** naturais da 1ª posição, do Mi da 6ª solta ao Mi da 1ª solta */
const TO_E4 = ['E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4']
const OPEN = 'com as cordas soltas'
const CLOSED = 'sem cordas soltas (Lá, Ré, Sol e Mi na casa 5 da corda de baixo, Si na 3ª casa 4; o Mi grave continua solto)'
const SLOW = 'uma nota por segundo'
const FAST = 'o mais rápido que conseguir tocar limpo'

const NOTES = 'Notas isoladas'
const OPEN_STRINGS = 'Cordas soltas, ida e volta'
const TO_A = 'Escala do Mi grave ao Lá da 1ª corda (casa 5)'
const STRINGS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
const STRINGS_HOW = 'As 6 cordas soltas, da 6ª à 1ª e de volta (Mi Lá Ré Sol Si Mi Mi Si Sol Ré Lá Mi)'

/** escala subindo e descendo, só naturais: com e sem cordas soltas, lenta e rápida */
function scaleTakes(id: string, group: string, range: string, up: string[]): Take[] {
  const expected = upDown(up)
  return [
    { id: `${id}-aberta-lenta`, group, title: 'Com cordas soltas, lenta', how: `${range}, ${OPEN}, ${SLOW}.`, expected },
    { id: `${id}-aberta-rapida`, group, title: 'Com cordas soltas, rápida', how: `${range}, ${OPEN}, ${FAST}.`, expected },
    { id: `${id}-fechada-lenta`, group, title: 'Sem cordas soltas, lenta', how: `${range}, ${CLOSED}, ${SLOW}.`, expected },
    { id: `${id}-fechada-rapida`, group, title: 'Sem cordas soltas, rápida', how: `${range}, ${CLOSED}, ${FAST}.`, expected },
  ]
}

export const TAKES: Take[] = [
  {
    id: 'cordas-soltas',
    group: NOTES,
    title: 'Cordas soltas',
    how: 'Da 6ª à 1ª, uma de cada vez, deixando cada uma soar cerca de 1 s.',
    expected: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  { id: 're-4-solta', group: NOTES, title: 'Ré · 4ª corda solta', how: '8 vezes, uma por segundo.', expected: times('D3', 8) },
  { id: 're-2-casa3', group: NOTES, title: 'Ré · 2ª corda, casa 3', how: '8 vezes, uma por segundo.', expected: times('D4', 8) },
  { id: 'si-2-solta', group: NOTES, title: 'Si · 2ª corda solta', how: '8 vezes, uma por segundo.', expected: times('B3', 8) },
  { id: 'si-5-casa2', group: NOTES, title: 'Si · 5ª corda, casa 2', how: '8 vezes, uma por segundo.', expected: times('B2', 8) },
  { id: 'soltas-lenta', group: OPEN_STRINGS, title: 'Lenta', how: `${STRINGS_HOW}, ${SLOW}.`, expected: [...STRINGS, ...[...STRINGS].reverse()] },
  { id: 'soltas-rapida', group: OPEN_STRINGS, title: 'Rápida', how: `${STRINGS_HOW}, ${FAST}.`, expected: [...STRINGS, ...[...STRINGS].reverse()] },
  // ids sem sufixo de faixa: as primeiras gravações já saíram com eles
  ...scaleTakes('escala', TO_A, 'Do Mi da 6ª corda solta ao Lá da 1ª (casa 5), subindo e descendo, só notas naturais', [...TO_E4, 'F4', 'G4', 'A4']),
]

/** Nomes de arquivo já gravados desta tomada (`id`, `id-2`, …). */
export function recordingsOf(take: Take, names: Iterable<string>): string[] {
  const re = new RegExp(`^${take.id}(-\\d+)?$`)
  return [...names].filter((n) => re.test(n))
}

/** Nome livre para a próxima gravação da tomada. */
export function nextName(take: Take, names: Iterable<string>): string {
  const taken = new Set(names)
  if (!taken.has(take.id)) return take.id
  let n = 2
  while (taken.has(`${take.id}-${n}`)) n++
  return `${take.id}-${n}`
}
