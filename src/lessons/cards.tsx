import type { ReactNode } from 'react'
import { Kbd } from '../ui/controls'
import { artNotes, FigureArt, FretArt, MeterArt, playBars, playNotes, playPulse, PulseArt, RestPairsArt, RhythmArt, StaffArt } from './art'

/**
 * Cartões de conceito: uma frase e um desenho. Aparecem no começo da lição;
 * o "?" reabre. Alguns têm som (botão ouvir).
 */
export interface ConceptCard {
  text: string
  art?: () => ReactNode
  demo?: () => void
}

const pos = (string: number, fret: number, label: string) => ({ position: { string: string as 1, fret }, label })

function stringCard(text: string, staff: string, marks: ReturnType<typeof pos>[]): ConceptCard {
  return {
    text,
    art: () => (
      <div className="flex w-full flex-col items-center gap-2">
        <StaffArt notes={artNotes(staff)} spacing={48} minWidth={220} compact />
        <FretArt marks={marks} />
      </div>
    ),
    demo: () => void playNotes(staff, 0.6),
  }
}

export const CARDS: Record<string, ConceptCard> = {
  // ------------------------------------------------------------ notas na pauta: o Sol da clave como referência
  pauta: {
    text: 'A pauta tem 5 linhas e 4 espaços, contados de baixo para cima.',
    art: () => <StaffArt glow={[0, 2, 4, 6, 8, 1, 3, 5, 7]} numbers="both" />,
  },
  linhaEspaco: {
    text: 'Na linha, a linha corta a nota ao meio. No espaço, a nota fica entre duas linhas.',
    art: () => <StaffArt notes={[{ id: 'G4', label: 'linha' }, { id: 'C5', label: 'espaço' }]} spacing={90} />,
  },
  altura: {
    text: 'Quanto mais agudo o som, mais alta a nota na pauta. O grave fica embaixo.',
    art: () => <StaffArt notes={[{ id: 'E4', label: 'grave' }, { id: 'B4' }, { id: 'F5', label: 'agudo' }]} spacing={80} />,
    demo: () => void playNotes('E4 B4 F5', 0.6),
  },
  clave: {
    text: 'A clave de sol é a chave da pauta: ela se enrola na 2ª linha, e a 2ª linha é sempre Sol.',
    art: () => <StaffArt glow={[2]} notes={artNotes('G4')} />,
    demo: () => void playNotes('G4'),
  },
  escala: {
    text: 'As notas naturais em ordem, do grave ao agudo: Dó, Ré, Mi, Fá, Sol, Lá, Si… e volta o Dó.',
    art: () => <StaffArt notes={artNotes('C4 D4 E4 F4 G4 A4 B4 C5')} spacing={34} minWidth={320} />,
    demo: () => void playNotes('C4 D4 E4 F4 G4 A4 B4 C5'),
  },
  passo: {
    text: 'Na pauta, cada vizinho é a próxima nota: um passo acima do Sol fica o Lá; um abaixo, o Fá.',
    art: () => <StaffArt notes={[{ id: 'F4', label: 'Fá' }, { id: 'G4', label: 'Sol', accent: true }, { id: 'A4', label: 'Lá' }]} spacing={70} />,
    demo: () => void playNotes('G4 A4 G4 F4', 0.5),
  },
  mapa: {
    text: 'O mapa da pauta: 9 notas, do Mi ao Fá. Todas se acham contando a partir do Sol.',
    art: () => (
      <StaffArt
        notes={['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'].map((id) => ({ ...artNotes(id)[0], accent: id === 'G4' }))}
        spacing={30}
        minWidth={320}
      />
    ),
    demo: () => void playNotes('E4 F4 G4 A4 B4 C5 D5 E5 F5', 0.35),
  },
  pulo: {
    text: 'De uma linha para a seguinte, pula-se uma nota: um pulo abaixo do Sol é o Mi; um acima, o Si.',
    art: () => (
      <StaffArt
        notes={[
          { id: 'E4', label: 'Mi' },
          { id: 'F4', label: 'Fá', faint: true },
          { id: 'G4', label: 'Sol', accent: true },
          { id: 'A4', label: 'Lá', faint: true },
          { id: 'B4', label: 'Si' },
        ]}
        spacing={44}
      />
    ),
    demo: () => void playNotes('G4 E4 G4 B4', 0.5),
  },
  do: {
    text: 'O Dó, no 3º espaço, é a segunda referência: fica no meio da pauta, três notas acima do Sol.',
    art: () => (
      <StaffArt
        notes={[
          { id: 'G4', label: 'Sol' },
          { id: 'A4', faint: true },
          { id: 'B4', faint: true },
          { id: 'C5', label: 'Dó', accent: true },
          { id: 'D5', label: 'Ré' },
        ]}
        spacing={44}
      />
    ),
    demo: () => void playNotes('G4 A4 B4 C5 D5'),
  },
  topo: {
    text: 'Acima do Ré, o Mi (4º espaço) e o Fá (5ª linha). A pauta está completa.',
    art: () => <StaffArt notes={artNotes('C5 D5 E5 F5')} spacing={54} />,
    demo: () => void playNotes('C5 D5 E5 F5'),
  },
  escalaPauta: {
    text: 'Na pauta, linha e espaço se alternam: cada vizinho é a próxima nota da escala.',
    art: () => <StaffArt notes={artNotes('E4 F4 G4 A4 B4 C5 D5 E5 F5')} spacing={30} minWidth={320} />,
    demo: () => void playNotes('E4 F4 G4 A4 B4 C5 D5 E5 F5', 0.35),
  },

  // ------------------------------------------------------------ suplementares
  suplementares: {
    text: 'Abaixo e acima da pauta, ela continua com linhas curtinhas: as suplementares.',
    art: () => <StaffArt notes={artNotes('C4 A5')} spacing={90} />,
  },
  contarDaBorda: {
    text: 'Conte a partir da borda: abaixo do Mi vêm Ré, Dó, Si…',
    art: () => <StaffArt notes={artNotes('E4 D4 C4 B3')} spacing={50} />,
    demo: () => void playNotes('E4 D4 C4 B3'),
  },
  suplementaresCima: {
    text: 'Acima do Fá, a mesma ordem da escala: Sol, Lá, Si, Dó…',
    art: () => <StaffArt notes={artNotes('F5 G5 A5 B5 C6')} spacing={46} />,
    demo: () => void playNotes('F5 G5 A5 B5 C6'),
  },
  quatroMis: {
    text: 'O mesmo nome volta a cada oito notas: é a oitava. Aqui, quatro Mis.',
    art: () => <StaffArt notes={artNotes('E3 E4 E5 E6')} spacing={56} />,
    demo: () => void playNotes('E3 E4 E5 E6', 0.6),
  },

  // ------------------------------------------------------------ pulso e figuras
  pulso: {
    text: 'A música tem um pulso, constante como o tique-taque de um relógio.',
    art: () => <PulseArt />,
    demo: () => void playPulse(8),
  },
  pe: {
    text: 'Marque o pulso com o pé e bata o ritmo na barra de espaço.',
    art: () => (
      <div className="flex flex-col items-center gap-4">
        <PulseArt label="pé" />
        <div className="flex items-center gap-5">
          <span className="w-16 text-right text-base text-sub">mão</span>
          <Kbd>espaço</Kbd>
        </div>
      </div>
    ),
  },
  seminima: {
    text: 'A semínima dura 1 pulso.',
    art: () => <RhythmArt cells={[['q', 'q', 'q', 'q']]} />,
    demo: () => void playBars([['q', 'q', 'q', 'q']]),
  },
  minima: {
    text: 'A mínima dura 2 pulsos: bata uma vez e segure.',
    art: () => <RhythmArt cells={[['h', 'h']]} />,
    demo: () => void playBars([['h', 'h']]),
  },
  semibreve: {
    text: 'A semibreve dura 4 pulsos: o compasso inteiro.',
    art: () => <RhythmArt cells={[['w']]} />,
    demo: () => void playBars([['w']]),
  },

  // ------------------------------------------------------------ compasso
  compasso: {
    text: 'A barra divide a música em compassos: grupos iguais de pulsos.',
    art: () => <RhythmArt cells={[['h', 'q', 'q'], ['q', 'q', 'h']]} />,
    demo: () => void playBars([['h', 'q', 'q'], ['q', 'q', 'h']]),
  },
  tempoForte: {
    text: 'O 1º pulso de cada compasso é o mais forte.',
    art: () => <RhythmArt cells={[['q', 'q', 'q', 'q'], ['q', 'q', 'q', 'q']]} />,
    demo: () => void playPulse(8),
  },
  formula: {
    text: 'A fórmula de compasso: o número de cima diz quantos pulsos tem cada compasso.',
    art: () => <MeterArt mark="top" />,
  },
  formulaBaixo: {
    text: 'O de baixo diz qual figura vale 1 pulso: 4 é a semínima.',
    art: () => (
      <div className="flex items-center gap-6">
        <MeterArt meters={[4]} mark="bottom" />
        <span className="text-2xl text-sub">=</span>
        <FigureArt cell="q" />
      </div>
    ),
  },
  tres: {
    text: '3/4: três pulsos por compasso, como numa valsa.',
    art: () => <RhythmArt cells={[['h', 'q'], ['q', 'q', 'q']]} meter={3} />,
    demo: () => void playBars([['h', 'q'], ['q', 'q', 'q']], 3),
  },
  dois: {
    text: '2/4: dois pulsos por compasso, como numa marcha.',
    art: () => <RhythmArt cells={[['q', 'q'], ['h']]} meter={2} />,
    demo: () => void playBars([['q', 'q'], ['h']], 2),
  },

  // ------------------------------------------------------------ pausas
  pausa: {
    text: 'A pausa é silêncio que também dura: não bata, mas continue contando.',
    art: () => <RhythmArt cells={[['q', 'qr', 'q', 'qr']]} />,
    demo: () => void playBars([['q', 'qr', 'q', 'qr']]),
  },
  pausas: {
    text: 'Cada figura tem sua pausa, com a mesma duração.',
    art: () => (
      <RestPairsArt
        cells={[
          ['w', 'wr', 'semibreve'],
          ['h', 'hr', 'mínima'],
          ['q', 'qr', 'semínima'],
        ]}
      />
    ),
  },
  pausasLinha: {
    text: 'A pausa de semibreve fica pendurada na linha; a de mínima, sentada nela.',
    art: () => <RhythmArt cells={[['wr'], ['hr', 'h']]} counts="none" />,
  },

  // ------------------------------------------------------------ colcheias e ponto
  colcheia: {
    text: 'Duas colcheias cabem em 1 pulso. Conte: 1 e 2 e.',
    art: () => <RhythmArt cells={[['ee', 'ee', 'q', 'q']]} counts="halves" />,
    demo: () => void playBars([['ee', 'ee', 'q', 'q']]),
  },
  ponto: {
    text: 'O ponto soma metade do valor: mínima (2) com ponto dura 3 pulsos.',
    art: () => <RhythmArt cells={[['dh', 'q']]} />,
    demo: () => void playBars([['dh', 'q']]),
  },
  seminimaPontuada: {
    text: 'Semínima pontuada vale 1 e meio; com a colcheia que vem depois, dá 2 pulsos.',
    art: () => <RhythmArt cells={[['dqe', 'h']]} counts="halves" />,
    demo: () => void playBars([['dqe', 'h']]),
  },

  // ------------------------------------------------------------ leitura
  juntos: {
    text: 'Agora juntos: diga o nome de cada nota no tempo dela.',
    art: () => <StaffArt notes={artNotes('G4 A4 B4 G4')} spacing={56} />,
    demo: () => void playNotes('G4 A4 B4 G4', 1),
  },
  todaPauta: {
    text: 'Agora a pauta toda, com as suplementares. Mais devagar: conte a partir da borda e leia um pouco à frente.',
    art: () => <StaffArt notes={artNotes('A3 C4 G4 C5 E5 A5 C6')} spacing={44} />,
    demo: () => void playNotes('A3 C4 G4 C5 E5 A5 C6', 0.5),
  },
  frente: {
    text: 'Leia um pouco à frente: enquanto uma nota soa, olhe a próxima.',
    art: () => <StaffArt notes={[{ id: 'E4', label: 'agora', accent: true }, { id: 'G4', label: 'a seguir' }]} spacing={90} />,
  },

  // ------------------------------------------------------------ acidentes
  sustenido: {
    text: '♯ sustenido: meio tom acima. No violão, uma casa à frente.',
    art: () => (
      <div className="flex w-full flex-col items-center gap-2">
        <StaffArt notes={artNotes('F4 F#4')} spacing={80} minWidth={220} compact />
        <FretArt marks={[pos(4, 3, 'Fá'), pos(4, 4, 'Fá♯')]} toFret={5} />
      </div>
    ),
    demo: () => void playNotes('F4 F#4', 0.6),
  },
  bemol: {
    text: '♭ bemol: meio tom abaixo. No violão, uma casa para trás.',
    art: () => (
      <div className="flex w-full flex-col items-center gap-2">
        <StaffArt notes={artNotes('B4 Bb4')} spacing={80} minWidth={220} compact />
        <FretArt marks={[pos(3, 4, 'Si'), pos(3, 3, 'Si♭')]} toFret={5} />
      </div>
    ),
    demo: () => void playNotes('B4 Bb4', 0.6),
  },
  enarmonia: {
    text: 'Fá♯ e Sol♭ são o mesmo som, com nomes diferentes.',
    art: () => <StaffArt notes={artNotes('F#4 Gb4')} spacing={80} />,
    demo: () => void playNotes('F#4 Gb4', 0.8),
  },
  ateBarra: {
    text: 'O acidente vale até o fim do compasso: depois de um Fá♯, outro Fá no mesmo compasso também é Fá♯. A barra desfaz.',
    art: () => (
      <StaffArt
        notes={[
          { id: 'F#4', label: 'Fá♯' },
          { id: 'F4', label: 'Fá♯', accent: true },
          { id: 'F4', label: 'Fá' },
        ]}
        bars={[2]}
        spacing={80}
      />
    ),
    demo: () => void playNotes('F#4 F#4 F4', 0.6),
  },
  bequadro: {
    text: '♮ bequadro: cancela o acidente antes da barra, e a nota volta a ser natural.',
    art: () => (
      <StaffArt
        notes={[
          { id: 'F#4', label: 'Fá♯' },
          { id: 'F4', label: 'Fá♯' },
          { id: 'F4♮', label: 'Fá', accent: true },
        ]}
        spacing={80}
      />
    ),
    demo: () => void playNotes('F#4 F#4 F4', 0.6),
  },

  // ------------------------------------------------------------ violão
  corda1: stringCard('1ª corda, a mais fina: solta é Mi; casa 1, Fá; casa 3, Sol.', 'E5 F5 G5', [pos(1, 0, 'Mi'), pos(1, 1, 'Fá'), pos(1, 3, 'Sol')]),
  corda2: stringCard('2ª corda: solta é Si; casa 1, Dó; casa 3, Ré.', 'B4 C5 D5', [pos(2, 0, 'Si'), pos(2, 1, 'Dó'), pos(2, 3, 'Ré')]),
  corda3: stringCard('3ª corda: solta é Sol; casa 2, Lá.', 'G4 A4', [pos(3, 0, 'Sol'), pos(3, 2, 'Lá')]),
  corda4: stringCard('4ª corda: solta é Ré; casa 2, Mi; casa 3, Fá.', 'D4 E4 F4', [pos(4, 0, 'Ré'), pos(4, 2, 'Mi'), pos(4, 3, 'Fá')]),
  corda5: stringCard('5ª corda: solta é Lá; casa 2, Si; casa 3, Dó.', 'A3 B3 C4', [pos(5, 0, 'Lá'), pos(5, 2, 'Si'), pos(5, 3, 'Dó')]),
  corda6: stringCard('6ª corda, a mais grossa: solta é Mi; casa 1, Fá; casa 3, Sol.', 'E3 F3 G3', [pos(6, 0, 'Mi'), pos(6, 1, 'Fá'), pos(6, 3, 'Sol')]),
  dedos: {
    text: 'Na 1ª posição, o dedo segue a casa: dedo 1 na casa 1, dedo 2 na 2, dedo 3 na 3.',
    art: () => <FretArt marks={[pos(1, 1, '1'), pos(1, 2, '2'), pos(1, 3, '3')]} />,
  },
  escalaViolao: {
    text: 'Escala: as notas em ordem. Aqui, todas as naturais da 1ª posição, subindo e descendo.',
    art: () => <StaffArt notes={artNotes('C4 D4 E4 F4 G4 A4 B4 C5')} spacing={34} minWidth={320} />,
    demo: () => void playNotes('C4 D4 E4 F4 G4 A4 B4 C5'),
  },
}
