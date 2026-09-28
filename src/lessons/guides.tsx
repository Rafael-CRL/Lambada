import type { ReactNode } from 'react'
import { Kbd } from '../ui/controls'
import { artNotes, FigureArt, MeterArt, playBars, playNotes, playPulse, PulseArt, RestPairsArt, RhythmArt, StaffArt } from './art'

/**
 * Guias: a teoria de uma unidade para ler com calma, numa página. Opcionais:
 * quem está confortável segue pelos cartões; quem se perdeu encontra aqui a
 * explicação inteira, em ordem (a do Chediak: altura → notas → pauta →
 * clave → leitura), com desenhos grandes. Texto próprio, curto e exato.
 */
export interface GuideSection {
  title: string
  body: ReactNode
  art?: () => ReactNode
  /** botão ouvir */
  demo?: () => void
}

export interface Guide {
  title: string
  intro: string
  sections: GuideSection[]
}

const LETTERS: [string, string][] = [
  ['C', 'Dó'],
  ['D', 'Ré'],
  ['E', 'Mi'],
  ['F', 'Fá'],
  ['G', 'Sol'],
  ['A', 'Lá'],
  ['B', 'Si'],
]

/** Notas na pauta */
const NOTAS: Guide = {
  title: 'Notas na pauta',
  intro: 'Tudo o que a unidade ensina, em ordem e com calma. Leia antes das lições ou volte aqui quando travar.',
  sections: [
    {
      title: 'O som: grave e agudo',
      body: (
        <>
          <p>
            Cada nota é um som com uma <b>altura</b>: mais <b>grave</b> (grosso, como a 6ª corda do violão) ou mais <b>agudo</b> (fino, como a 1ª). Em música, “alto” e
            “baixo” falam dessa altura, não do volume.
          </p>
          <p>Na partitura, a altura vira posição: quanto mais agudo o som, mais acima a nota é escrita.</p>
        </>
      ),
      art: () => <StaffArt notes={[{ id: 'E4', label: 'grave' }, { id: 'B4' }, { id: 'F5', label: 'agudo' }]} spacing={80} />,
      demo: () => void playNotes('E4 B4 F5', 0.6),
    },
    {
      title: 'As sete notas naturais',
      body: (
        <>
          <p>
            São sete nomes que se repetem: <b>Dó, Ré, Mi, Fá, Sol, Lá, Si</b>. Depois do Si vem outro Dó, mais agudo, e a sequência recomeça. Essa volta ao mesmo nome,
            oito notas acima, é a <b>oitava</b>.
          </p>
          <p>
            Tocadas em ordem, do grave para o agudo, elas formam a <b>escala natural</b>. No piano, são as teclas brancas.
          </p>
          <p>As notas também têm nomes em letras, usados nas cifras e nos botões do app:</p>
        </>
      ),
      art: () => (
        <div className="flex w-full flex-col items-center gap-4">
          <StaffArt notes={artNotes('C4 D4 E4 F4 G4 A4 B4 C5')} spacing={34} minWidth={320} />
          <div className="grid w-full max-w-md grid-cols-7 gap-2 text-center">
            {LETTERS.map(([l, n]) => (
              <div key={l} className="flex flex-col rounded-lg bg-surface py-2.5">
                <span className="font-mono text-2xl font-semibold text-accent">{l}</span>
                <span className="text-sm text-sub">{n}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      demo: () => void playNotes('C4 D4 E4 F4 G4 A4 B4 C5'),
    },
    {
      title: 'O pentagrama',
      body: (
        <>
          <p>
            A <b>pauta</b>, ou pentagrama, tem <b>5 linhas</b> e os <b>4 espaços</b> entre elas. Os dois são contados de baixo para cima: a 1ª linha é a de baixo, e o 1º
            espaço fica logo acima dela.
          </p>
          <p>
            Uma nota fica <b>na linha</b> (a linha passa pelo meio dela) ou <b>no espaço</b> (entre duas linhas, sem ser cortada). Cada linha e cada espaço é o lugar de
            uma nota.
          </p>
        </>
      ),
      art: () => (
        <div className="flex w-full flex-col items-center gap-2">
          <StaffArt glow={[0, 2, 4, 6, 8, 1, 3, 5, 7]} numbers="both" />
          <StaffArt
            notes={[
              { id: 'G4', label: 'na linha' },
              { id: 'C5', label: 'no espaço' },
            ]}
            spacing={110}
            compact
          />
        </div>
      ),
    },
    {
      title: 'A clave de sol',
      body: (
        <>
          <p>
            Sozinha, a pauta não diz qual nota é qual. Quem diz é a <b>clave</b>, o símbolo no começo da pauta: ela é a chave de leitura, que dá nome às linhas e aos
            espaços.
          </p>
          <p>
            A <b>clave de sol</b> nasceu de uma letra G (Sol) escrita à mão, que foi ganhando curvas ao longo dos séculos. Ela se enrola na <b>2ª linha</b>, e isso quer
            dizer: <b>a 2ª linha é sempre Sol</b>.
          </p>
          <p>
            É a clave do violão, da flauta, do violino e da mão direita do piano. Existem outras (a de fá, para os sons graves), que dão outros nomes às mesmas linhas.
          </p>
        </>
      ),
      art: () => <StaffArt glow={[2]} notes={artNotes('G4')} />,
      demo: () => void playNotes('G4'),
    },
    {
      title: 'Do Sol às outras notas: passo e pulo',
      body: (
        <>
          <p>
            Com o Sol no lugar, as outras notas seguem a ordem da escala. Da linha para o espaço logo acima (ou do espaço para a linha) é um <b>passo</b>: a nota
            seguinte. Subindo do Sol: Lá, Si, Dó… Descendo: Fá, Mi.
          </p>
          <p>
            De uma linha para a próxima linha (ou de um espaço para o próximo espaço) é um <b>pulo</b>: pula-se uma nota. Um pulo acima do Sol é o Si; um abaixo, o Mi.
          </p>
        </>
      ),
      art: () => (
        <StaffArt
          notes={[
            { id: 'E4', label: 'Mi' },
            { id: 'F4', label: 'Fá' },
            { id: 'G4', label: 'Sol', accent: true },
            { id: 'A4', label: 'Lá' },
            { id: 'B4', label: 'Si' },
          ]}
          spacing={56}
        />
      ),
      demo: () => void playNotes('G4 A4 B4 G4 F4 E4', 0.5),
    },
    {
      title: 'O mapa da pauta',
      body: (
        <>
          <p>As nove notas, do Mi da 1ª linha ao Fá da 5ª:</p>
          <ul>
            <li>
              <b>Linhas</b>, de baixo para cima: Mi, Sol, Si, Ré, Fá.
            </li>
            <li>
              <b>Espaços</b>, de baixo para cima: Fá, Lá, Dó, Mi.
            </li>
          </ul>
          <p>
            Não é preciso decorar as listas. Guarde duas referências, o <b>Sol da 2ª linha</b> e o <b>Dó do 3º espaço</b> (bem no meio), e conte a partir da mais próxima.
            Com o tempo, as notas passam a ser reconhecidas de relance, sem contar.
          </p>
          <p>Acima e abaixo da pauta ela continua com linhas curtas, as suplementares, numa unidade mais adiante.</p>
        </>
      ),
      art: () => (
        <StaffArt
          notes={['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'].map((id) => ({
            ...artNotes(id)[0],
            accent: id === 'G4' || id === 'C5',
          }))}
          spacing={34}
          minWidth={340}
        />
      ),
      demo: () => void playNotes('E4 F4 G4 A4 B4 C5 D5 E5 F5', 0.35),
    },
    {
      title: 'Como treinar',
      body: (
        <>
          <p>Primeiro leia devagar e acerte; a velocidade vem com a repetição. Poucos minutos por dia rendem mais do que uma hora de vez em quando.</p>
          <p>
            Nas lições, quando travar, use <b>ver a cola</b> (<Kbd>H</Kbd>): a nota não conta e volta mais tarde.
          </p>
          <p>
            Depois da unidade, continue em <b>Praticar › Leitura</b>, com as notas da pauta.
          </p>
        </>
      ),
    },
  ],
}

const TRAIN_RHYTHM: GuideSection = {
  title: 'Como treinar',
  body: (
    <>
      <p>Marque o pulso com o pé e bata o ritmo com a mão. Conte em voz alta. Comece devagar: bater certo importa mais do que bater rápido.</p>
      <p>
        Depois da unidade, continue em <b>Praticar › Ritmo</b>, alguns minutos por dia.
      </p>
    </>
  ),
}

export const GUIDES: Record<string, Guide> = {
  notas: NOTAS,

  figuras: {
    title: 'Pulso e figuras',
    intro: 'O que é o pulso e como a partitura diz quanto dura cada som.',
    sections: [
      {
        title: 'O pulso',
        body: (
          <p>
            A música tem um <b>pulso</b>: batidas regulares, como o tique-taque de um relógio ou os passos de quem caminha. É o que o pé marca sem pensar quando se ouve
            uma música. O ritmo é medido em pulsos.
          </p>
        ),
        art: () => <PulseArt />,
        demo: () => void playPulse(8),
      },
      {
        title: 'As figuras',
        body: (
          <>
            <p>
              Cada duração tem um desenho, a <b>figura</b>:
            </p>
            <ul>
              <li>
                <b>Semibreve</b>: cabeça vazada, sem haste. Dura <b>4 pulsos</b>.
              </li>
              <li>
                <b>Mínima</b>: cabeça vazada, com haste. Dura <b>2 pulsos</b>.
              </li>
              <li>
                <b>Semínima</b>: cabeça cheia, com haste. Dura <b>1 pulso</b>.
              </li>
            </ul>
            <p>Cada uma vale metade da anterior: uma semibreve = duas mínimas = quatro semínimas.</p>
          </>
        ),
        art: () => (
          <div className="flex items-end justify-center gap-10">
            <FigureArt cell="w" />
            <FigureArt cell="h" />
            <FigureArt cell="q" />
          </div>
        ),
      },
      {
        title: 'Bater e segurar',
        body: (
          <p>
            Bate-se uma vez no <b>começo</b> de cada som e segura-se até a figura seguinte. Numa mínima, bate no 1 e segura o 2; o próximo som só começa no 3.
          </p>
        ),
        art: () => <RhythmArt cells={[['h', 'q', 'q']]} />,
        demo: () => void playBars([['h', 'q', 'q']]),
      },
      TRAIN_RHYTHM,
    ],
  },

  compasso: {
    title: 'Compasso',
    intro: 'Como os pulsos se agrupam e o que dizem os dois números no começo da pauta.',
    sections: [
      {
        title: 'A barra de compasso',
        body: (
          <p>
            A música é dividida em <b>compassos</b>: grupos com o mesmo número de pulsos, separados por <b>barras</b> verticais. O 1º pulso de cada compasso é o mais
            forte, e é por ele que se sente onde o compasso começa.
          </p>
        ),
        art: () => (
          <RhythmArt
            cells={[
              ['h', 'q', 'q'],
              ['q', 'q', 'h'],
            ]}
          />
        ),
        demo: () =>
          void playBars([
            ['h', 'q', 'q'],
            ['q', 'q', 'h'],
          ]),
      },
      {
        title: 'A fórmula de compasso',
        body: (
          <p>
            No começo da pauta ficam dois números empilhados. O de <b>cima</b> diz quantos pulsos cabem em cada compasso. O de <b>baixo</b> diz qual figura vale um pulso:{' '}
            <b>4 = semínima</b>.
          </p>
        ),
        art: () => <MeterArt mark="top" />,
      },
      {
        title: '4/4, 3/4 e 2/4',
        body: (
          <ul>
            <li>
              <b>4/4</b>: quatro pulsos, o mais comum. Conta-se <b>1</b> 2 3 4.
            </li>
            <li>
              <b>3/4</b>: três pulsos, como uma valsa: <b>1</b> 2 3.
            </li>
            <li>
              <b>2/4</b>: dois pulsos, como uma marcha: <b>1</b> 2.
            </li>
          </ul>
        ),
        art: () => (
          <RhythmArt
            cells={[
              ['h', 'q'],
              ['q', 'q', 'q'],
            ]}
            meter={3}
          />
        ),
        demo: () =>
          void playBars(
            [
              ['h', 'q'],
              ['q', 'q', 'q'],
            ],
            3,
          ),
      },
      {
        title: 'O compasso fecha a conta',
        body: (
          <p>
            As figuras de um compasso somam exatamente os pulsos da fórmula. Em 4/4, mínima (2) + semínima (1) + semínima (1) = 4. Por isso, se falta uma figura, dá para
            descobrir qual: é a que completa a conta.
          </p>
        ),
      },
      TRAIN_RHYTHM,
    ],
  },

  suplementares: {
    title: 'Suplementares',
    intro: 'As notas acima e abaixo das cinco linhas, e como achá-las sem decorar.',
    sections: [
      {
        title: 'Além das cinco linhas',
        body: (
          <p>
            A pauta tem só nove lugares, mas as notas continuam acima e abaixo dela. Para escrevê-las usam-se linhas curtas, do tamanho da nota: as{' '}
            <b>linhas suplementares</b>. Elas também são contadas a partir da pauta: a 1ª é a mais perto dela.
          </p>
        ),
        art: () => <StaffArt notes={artNotes('C4 A5')} spacing={110} />,
      },
      {
        title: 'Conte a partir da borda',
        body: (
          <p>
            Não é preciso decorar: comece na nota da borda e siga a escala. Abaixo do <b>Mi da 1ª linha</b>: Ré (logo abaixo), Dó (na 1ª suplementar), Si, Lá… Acima do{' '}
            <b>Fá da 5ª linha</b>: Sol (logo acima), Lá (na 1ª suplementar), Si, Dó…
          </p>
        ),
        art: () => <StaffArt notes={artNotes('E4 D4 C4 B3 A3')} spacing={50} />,
        demo: () => void playNotes('E4 D4 C4 B3 A3'),
      },
      {
        title: 'O Dó central',
        body: (
          <p>
            O Dó da 1ª suplementar de baixo é o <b>Dó central</b>, o do meio do piano. É uma boa referência para as notas graves. No violão, que soa uma oitava abaixo do
            que está escrito, ele fica na 5ª corda, casa 3.
          </p>
        ),
        art: () => <StaffArt notes={[{ id: 'C4', label: 'Dó central', accent: true }]} />,
        demo: () => void playNotes('C4'),
      },
      {
        title: 'O mesmo nome, oito notas acima',
        body: (
          <p>
            O nome volta a cada oito notas (a <b>oitava</b>). Da pauta para fora há quatro Mis: o grave, abaixo da 3ª suplementar; o da 1ª linha; o do 4º espaço; e o
            agudo, na 3ª suplementar de cima. Mesmo nome, alturas diferentes.
          </p>
        ),
        art: () => <StaffArt notes={artNotes('E3 E4 E5 E6')} spacing={60} />,
        demo: () => void playNotes('E3 E4 E5 E6', 0.6),
      },
      {
        title: 'Como treinar',
        body: (
          <p>
            Leia devagar, contando a partir da borda, até as notas ficarem conhecidas. Depois da unidade, continue em <b>Praticar › Leitura</b>, com as notas
            suplementares.
          </p>
        ),
      },
    ],
  },

  pausas: {
    title: 'Pausas',
    intro: 'Como a partitura escreve o silêncio.',
    sections: [
      {
        title: 'O silêncio também dura',
        body: (
          <p>
            A <b>pausa</b> é um silêncio medido: não se toca, mas se continua contando os pulsos. Sem contar, a nota seguinte entra antes ou depois da hora.
          </p>
        ),
        art: () => <RhythmArt cells={[['q', 'qr', 'q', 'qr']]} />,
        demo: () => void playBars([['q', 'qr', 'q', 'qr']]),
      },
      {
        title: 'Uma pausa para cada figura',
        body: <p>Cada figura tem a sua pausa, com a mesma duração: pausa de semínima (1 pulso), de mínima (2) e de semibreve (4).</p>,
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
      {
        title: 'Mínima ou semibreve?',
        body: (
          <p>
            As duas são um retângulo pequeno; muda a posição. A de <b>semibreve</b> fica <b>pendurada</b> embaixo da linha; a de <b>mínima</b> fica <b>sentada</b> sobre
            ela. Um jeito de lembrar: a semibreve, mais longa, é mais pesada e fica pendurada.
          </p>
        ),
        art: () => <RhythmArt cells={[['wr'], ['hr', 'h']]} counts="none" />,
      },
      TRAIN_RHYTHM,
    ],
  },

  colcheias: {
    title: 'Colcheias',
    intro: 'Quando um pulso tem dois sons.',
    sections: [
      {
        title: 'Dois sons num pulso',
        body: (
          <p>
            A <b>colcheia</b> dura <b>meio pulso</b>: duas cabem em um. Sozinha ela tem uma bandeirinha na haste; em dupla, as duas são ligadas por uma barra.
          </p>
        ),
        art: () => <RhythmArt cells={[['ee', 'ee', 'q', 'q']]} counts="halves" />,
        demo: () => void playBars([['ee', 'ee', 'q', 'q']]),
      },
      {
        title: 'Contar “1 e 2 e”',
        body: (
          <p>
            Para não correr, divida o pulso em voz alta: <b>1 e 2 e 3 e 4 e</b>. O pé bate no número; a segunda colcheia cai no “e”, quando o pé sobe.
          </p>
        ),
        art: () => <RhythmArt cells={[['q', 'ee', 'h']]} counts="halves" />,
        demo: () => void playBars([['q', 'ee', 'h']]),
      },
      TRAIN_RHYTHM,
    ],
  },

  ponto: {
    title: 'Ponto de aumento',
    intro: 'O ponto depois da figura: metade a mais.',
    sections: [
      {
        title: 'Metade a mais',
        body: (
          <p>
            Um <b>ponto</b> logo depois da figura aumenta <b>metade</b> da duração dela. Mínima (2) com ponto: 2 + 1 = <b>3 pulsos</b>.
          </p>
        ),
        art: () => <RhythmArt cells={[['dh', 'q']]} />,
        demo: () => void playBars([['dh', 'q']]),
      },
      {
        title: 'Mínima pontuada em 3/4',
        body: <p>Em 3/4, a mínima pontuada enche o compasso inteiro: um som só, segurado por três pulsos.</p>,
        art: () => <RhythmArt cells={[['dh'], ['q', 'q', 'q']]} meter={3} />,
        demo: () => void playBars([['dh'], ['q', 'q', 'q']], 3),
      },
      {
        title: 'Semínima pontuada',
        body: (
          <p>
            Semínima (1) com ponto: 1 + ½ = <b>1 pulso e meio</b>. Quase sempre vem seguida de uma colcheia, que completa 2 pulsos: um som longo e um curto. Conte “1 e 2
            e”: a colcheia cai no “e” do 2.
          </p>
        ),
        art: () => <RhythmArt cells={[['dqe', 'h']]} counts="halves" />,
        demo: () => void playBars([['dqe', 'h']]),
      },
      TRAIN_RHYTHM,
    ],
  },

  leitura: {
    title: 'Leitura de partitura',
    intro: 'Notas e ritmo ao mesmo tempo, no andamento.',
    sections: [
      {
        title: 'Altura e duração juntas',
        body: (
          <p>
            Cada nota da partitura diz duas coisas: <b>qual</b> é (o lugar na pauta) e <b>quanto dura</b> (a figura). Ler no tempo é dizer o nome quando a nota chega e
            esperar o tempo dela antes da próxima.
          </p>
        ),
        art: () => <StaffArt notes={artNotes('G4 A4 B4 G4')} spacing={56} />,
        demo: () => void playNotes('G4 A4 B4 G4', 1),
      },
      {
        title: 'Leia um pouco à frente',
        body: <p>Enquanto uma nota soa, os olhos já vão para a próxima. Se errar, não pare: o metrônomo continua, e parar faz perder também as notas seguintes.</p>,
        art: () => (
          <StaffArt
            notes={[
              { id: 'E4', label: 'agora', accent: true },
              { id: 'G4', label: 'a seguir' },
            ]}
            spacing={90}
          />
        ),
      },
      {
        title: 'Devagar primeiro',
        body: (
          <p>
            Um andamento lento lido sem parar vale mais do que um rápido cheio de paradas. Na prática, suba o BPM só quando a leitura estiver sem esforço. Continue em{' '}
            <b>Praticar › Leitura</b>, com o metrônomo.
          </p>
        ),
      },
    ],
  },

  acidentes: {
    title: 'Acidentes',
    intro: 'Sustenido, bemol e bequadro: as notas entre as naturais.',
    sections: [
      {
        title: 'O meio tom',
        body: (
          <p>
            Entre a maioria das notas naturais vizinhas cabe mais uma: no piano, são as teclas pretas. A distância de uma tecla para a vizinha é o <b>meio tom</b>; no
            violão, <b>uma casa</b>. Entre Mi e Fá, e entre Si e Dó, não há tecla preta: elas já estão a meio tom.
          </p>
        ),
      },
      {
        title: 'Sustenido e bemol',
        body: (
          <p>
            O <b>♯ sustenido</b> sobe a nota meio tom; o <b>♭ bemol</b> desce meio tom. O sinal fica antes da nota, na mesma linha ou espaço, e o nome continua: Fá♯ se lê
            “fá sustenido”. Fá♯ e Sol♭ são o mesmo som com nomes diferentes (<b>enarmonia</b>).
          </p>
        ),
        art: () => <StaffArt notes={artNotes('F4 F#4 B4 Bb4')} spacing={64} />,
        demo: () => void playNotes('F4 F#4 B4 Bb4', 0.6),
      },
      {
        title: 'Vale até a barra',
        body: (
          <p>
            O acidente vale até o fim do compasso para as notas de mesma altura: depois de um Fá♯, outro Fá no mesmo compasso também é Fá♯, mesmo sem o sinal. A barra de
            compasso desfaz. Para cancelar antes da barra, usa-se o <b>♮ bequadro</b>: a nota volta a ser natural.
          </p>
        ),
        art: () => (
          <StaffArt
            notes={[
              { id: 'F#4', label: 'Fá♯' },
              { id: 'F4', label: 'Fá♯' },
              { id: 'F4♮', label: 'Fá' },
              { id: 'F#4', label: 'Fá♯' },
              { id: 'F4', label: 'Fá' },
            ]}
            bars={[3]}
            spacing={60}
          />
        ),
        demo: () => void playNotes('F#4 F#4 F4 F#4 F4', 0.5),
      },
      {
        title: 'Como treinar',
        body: (
          <p>
            Leia primeiro a nota natural, depois o sinal. Continue em <b>Praticar › Leitura</b>, com ♯♭ ligado.
          </p>
        ),
      },
    ],
  },
}

export function guideOf(unit: string): Guide | null {
  return GUIDES[unit] ?? null
}
