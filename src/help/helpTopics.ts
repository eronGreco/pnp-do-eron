/**
 * Catalogo unico dos textos de ajuda.
 *
 * Cada assunto abre num modal a partir de um botao visivel. Escreva em portugues
 * simples, sem jargao e sem travessao. Nada aqui muda o comportamento do corte.
 */
export type HelpTopic = {
  /** Titulo do modal. */
  title: string;
  /** Uma frase direta do que aquilo faz. */
  lead: string;
  /** Passos curtos de uso. */
  howTo?: string[];
  /** Quando vale a pena mexer. */
  when?: string;
  /** Quando e melhor deixar como esta. */
  avoid?: string;
  /** Exemplo com numeros reais. */
  example?: string;
  /** Aviso em destaque, para risco de estragar a folha ou o corte. */
  warning?: string;
};

export const HELP_TOPICS = {
  // ---------------------------------------------------------------- etapa 1
  "etapa-acabamento": {
    title: "Etapa 1: Acabamento",
    lead: "Escolha SILHOUETTE para o fluxo de corte por máquina ou GUILHOTINA para cortar manualmente. Dentro de SILHOUETTE, escolha CAMEO ou CRICUT.",
    howTo: [
      "Escolha SILHOUETTE e depois CAMEO para usar o sensor de marcas e o PNP Cameo Bridge, ou CRICUT para usar Print Then Cut no Design Space.",
      "Escolha Guilhotina se você vai cortar na mão seguindo marcas impressas.",
      "Depois siga para a etapa 2 e adicione as imagens das cartas. Elas ficam no seu computador.",
    ],
    when: "Essa escolha comanda o resto do caminho: o tamanho de folha liberado, as marcas que saem impressas e se o botão de cortar na máquina aparece.",
    example:
      "Na Cameo, A4 deitada é o formato validado para o corte pelo programa local. Na Cricut, use A4 retrato para arranjos altos e confira a capacidade no Design Space. Na Guilhotina, corte manualmente seguindo as marcas escolhidas.",
    avoid: "Trocar de acabamento no meio do trabalho muda folha e marcas, então confira a prévia depois de trocar.",
  },
  "modo-silhouette": {
    title: "SILHOUETTE: corte por máquina",
    lead: "Neste menu, SILHOUETTE reúne os fluxos por máquina. Escolha CAMEO ou CRICUT no bloco abaixo; a Cricut é uma máquina de outra marca.",
    howTo: [
      "Escolha CAMEO para leitura das marcas pelo sensor e corte com o PNP Cameo Bridge no computador.",
      "Escolha CRICUT para gerar o Pacote Cricut e usar Print Then Cut no Design Space.",
      "Use GUILHOTINA, fora deste bloco, se o corte for manual.",
    ],
    warning: "Cameo e Cricut têm fluxos diferentes. A Cricut não usa o PNP Cameo Bridge; suas marcas são geradas pelo Design Space.",
  },
  "modo-cameo": {
    title: "Silhouette Cameo",
    lead: "Dentro de SILHOUETTE, escolha CAMEO para imprimir as marcas que o sensor lê e cortar pelo PNP Cameo Bridge, já com os cantos arredondados.",
    howTo: [
      "Imprima a folha em A4 deitada, sem redimensionar, na escala de 100%.",
      "Coloque a folha na base de corte e ligue o programa local no computador.",
      "Na etapa da máquina, teste a conexão, deixe a Cameo ler as marcas e mande cortar.",
    ],
    when: "É o caminho para quem quer acabamento redondo e igual em todas as cartas, sem esforço de mão.",
    example:
      "As marcas do sensor ficam a 10 mm da borda da folha: um quadrado de 5 mm num canto e dois L de 10 mm nos outros.",
    warning:
      "O padrão validado é A4 deitada, com braços do L de 10 mm e a posição original das marcas. Outras medidas são experimentais e precisam de teste na Cameo 4. O programa local corta apenas A4 deitada; não force cartas por cima da área das marcas.",
  },
  "modo-guilhotina": {
    title: "Guilhotina",
    lead: "Escolha GUILHOTINA no primeiro nível para cortar manualmente. A folha sai só com as marcas de corte que você escolher, sem precisar escolher Cameo ou Cricut.",
    howTo: [
      "Monte as folhas e escolha as marcas na etapa 5.",
      "Imprima em escala de 100% e corte seguindo as marcas.",
      "Se quiser cantos redondos, use um furador de canto depois de cortar.",
    ],
    when: "Ideal para quem não tem a máquina ou quer folha A3 e folha em pé.",
    example:
      "Marcas de canto com 4 mm de comprimento e 0,2 mm de espessura, afastadas 1 mm da carta, já dão uma referência limpa para a guilhotina.",
  },
  "modo-cricut": {
    title: "Cricut",
    lead: "Dentro de SILHOUETTE, escolha CRICUT para gerar um SVG com as linhas de corte e usar Print Then Cut no Design Space. As marcas vêm do PDF criado pelo próprio Design Space.",
    howTo: [
      "Monte as cartas no tamanho desejado e confira a prévia.",
      "Na etapa de montagem, baixe o Pacote Cricut e abra o SVG no Design Space.",
      "Apague ou oculte a camada APAGAR-ANTES-DO-PRINT-THEN-CUT antes de anexar ou transformar em Print Then Cut. Ela só preserva a escala na importação; mantenha os contornos das cartas e não rotacione nem reposicione o desenho.",
      "Use Print Then Cut no Design Space e salve o PDF com as marcas da Cricut.",
      "Volte aqui, importe esse PDF de marcas e monte o PDF final das cartas.",
    ],
    when: "Use quando o corte será feito na Cricut, mas as cartas serão montadas e impressas pelo PNP do Eron.",
    warning:
      "O sistema não conversa direto com a Cricut nem inventa marcas próprias. A âncora de escala não deve entrar no Print Then Cut. O filtro de capacidade elimina excessos óbvios, mas o Design Space é a validação final porque a área tem cantos irregulares.",
  },
  "modo-montagem": {
    title: "Modo de montagem",
    lead: "Define se cada carta será montada separada ou como uma peça dobrável com frente e verso juntos.",
    howTo: [
      "Use Normal para o fluxo tradicional de frente e verso em páginas separadas.",
      "Use Gutterfold quando você quer imprimir frente e verso lado a lado e dobrar a peça depois.",
      "Depois confira a etapa Folha e marcas, porque a peça gutterfold ocupa a largura de duas cartas mais a canaleta.",
    ],
    when: "Gutterfold é útil para protótipos colados ou dobrados, quando o verso precisa ficar fisicamente ligado à frente.",
    warning: "No gutterfold a canaleta central é guia de dobra. Ela aparece na impressão, mas nunca é enviada como linha de corte.",
  },
  "modo-montagem-normal": {
    title: "Montagem normal",
    lead: "É o jeito tradicional: uma página com frentes e outra página espelhada com versos.",
    howTo: [
      "Monte as frentes normalmente.",
      "Use verso comum ou verso próprio por carta.",
      "Imprima frente e verso em escala de 100%.",
    ],
    when: "Use para cartas soltas comuns, especialmente quando você vai imprimir frente e verso na impressora.",
  },
  "modo-gutterfold": {
    title: "Gutterfold",
    lead: "Monta cada carta como uma peça aberta: frente de um lado, verso do outro e uma canaleta de dobra no meio.",
    howTo: [
      "Escolha Gutterfold no modo de montagem.",
      "Defina a canaleta na etapa Folha e marcas.",
      "Suba um verso comum ou verso próprio. O verso aparece ao lado da frente na mesma página.",
      "Depois de imprimir, corte o contorno externo e dobre pela linha central.",
    ],
    when: "Funciona com Guilhotina, Silhouette Cameo e Cricut. Em todos os casos o corte é só o contorno externo da peça aberta.",
    warning: "A sangria da frente não atravessa para o verso, e a sangria do verso não invade a frente nem outra peça.",
  },
  "modo-gutterfold-folha": {
    title: "Dobrar a folha inteira",
    lead: "Coloca todas as frentes em uma metade e os versos correspondentes na outra, para dobrar a folha inteira antes do corte.",
    howTo: [
      "Escolha Silhouette Cameo, Cricut ou Guilhotina e depois Gutterfold.",
      "Selecione Dobrar a folha inteira.",
      "Escolha Automática para aproveitar melhor o papel, ou force a dobra horizontal ou vertical.",
      "Imprima em 100%, dobre pela linha central e só depois corte as cartas.",
    ],
    when: "Use quando o tamanho das cartas permite alinhar várias frentes e versos com uma única dobra, como na montagem 2 por 3 ou 4 por 1.",
    warning: "Na dobra horizontal, as frentes ficam em cima e os versos embaixo, girados de cabeça para baixo. A linha central é somente dobra, nunca corte.",
  },

  // ---------------------------------------------------------------- etapa 2
  "etapa-cartas": {
    title: "Etapa 2: Cartas",
    lead: "Aqui você começa dizendo se o baralho usa um verso igual para tudo ou versos diferentes por carta.",
    howTo: [
      "Escolha Mesmo verso quando todas as cartas usam o mesmo fundo.",
      "Escolha Versos diferentes quando cada carta tem uma frente e um verso próprio.",
      "Depois adicione as imagens na ordem certa para o modo escolhido.",
      "Arraste para reordenar. O verso próprio acompanha a frente.",
    ],
    example:
      "18 cartas com o mesmo fundo de baralho: suba as 18 frentes e um único verso comum. Só isso.",
    avoid: "Imagens muito pequenas esticam e ficam borradas. Prefira imagens com pelo menos 300 pontos por polegada no tamanho final.",
    warning: "As imagens ficam apenas no seu computador. Nada é enviado para a internet.",
  },
  "modo-importacao": {
    title: "Como serão os versos?",
    lead: "Essa escolha evita confusão na hora de subir muitas imagens.",
    howTo: [
      "Mesmo verso: suba uma imagem de verso comum e depois suba só as frentes.",
      "Versos diferentes: suba os arquivos em pares, sempre frente e depois verso da mesma carta.",
      "Se uma carta específica precisar de outro verso, você ainda pode trocar o verso dela na lista.",
    ],
    example:
      "Com 6 arquivos no modo Versos diferentes, você fica com 3 cartas, cada uma com seu próprio verso.",
    avoid: "No modo Versos diferentes, um arquivo sobrando no fim vira uma carta sem verso próprio, que passa a usar o verso comum se ele existir.",
  },
  "verso-proprio": {
    title: "Verso próprio de uma carta",
    lead: "É o verso que vale apenas naquela carta, ignorando o verso comum.",
    howTo: [
      "Clique em subir o verso dentro da carta na lista.",
      "Para voltar ao verso comum, use o botão de usar verso comum na mesma carta.",
    ],
    when: "Útil em baralhos com cartas de tipos diferentes, como cartas de evento e cartas de personagem.",
  },
  "verso-comum": {
    title: "Verso comum",
    lead: "Uma única imagem de verso usada em todas as cartas que não têm verso próprio.",
    howTo: [
      "Suba a imagem uma vez.",
      "Troque ou remova quando quiser, sem tocar nas frentes.",
    ],
    example: "Um baralho de 54 cartas com o mesmo fundo precisa de apenas um verso comum.",
  },
  "ordem-cartas": {
    title: "Ordem das cartas",
    lead: "A ordem da lista é a ordem em que as cartas entram nas folhas.",
    howTo: [
      "Arraste uma carta e solte no espaço âmbar que aparece entre as outras.",
      "O verso próprio vai junto com a frente.",
    ],
    when: "Vale organizar quando você quer certos grupos na mesma folha, para cortar tudo de uma vez.",
  },
  "trabalho-salvo": {
    title: "Trabalho salvo",
    lead: "As cartas e os ajustes ficam guardados apenas neste navegador, neste computador.",
    howTo: [
      "Feche e volte depois: o trabalho reaparece do jeito que estava.",
      "Use Limpar para começar de zero, o que apaga a lista de cartas.",
    ],
    avoid: "Não é uma cópia de segurança. Outro computador, outro navegador ou uma limpeza de dados do navegador começam vazios.",
  },

  // ---------------------------------------------------------------- etapa 3
  "etapa-tamanho": {
    title: "Etapa 3: Tamanho da carta",
    lead: "Aqui você define o tamanho final da carta depois do corte, e o quanto os cantos ficam redondos.",
    howTo: [
      "Escolha um padrão conhecido ou digite as medidas na mão.",
      "Confira o aviso de tamanho: ele compara as suas imagens com a medida escolhida.",
      "Ajuste o raio dos cantos olhando a prévia.",
    ],
    example: "Carta de jogo comum: 63,5 × 88 mm, com raio de 3 mm nos cantos.",
  },
  "padrao-carta": {
    title: "Padrão de carta",
    lead: "Atalhos com os tamanhos mais usados no mundo dos jogos de tabuleiro e de cartas.",
    howTo: [
      "Escolha o padrão e as medidas são preenchidas sozinhas.",
      "Se você digitar medidas diferentes, o campo passa a mostrar Personalizado.",
    ],
    example:
      "Mini USA 41 × 63 mm, Mini Euro 45 × 68 mm, Standard USA 56 × 87 mm, Bridge 57 × 89 mm, Euro ou Poker 63,5 × 88 mm, Magnum Space 61 × 103 mm, Tarot 70 × 120 mm.",
  },
  "medidas-carta": {
    title: "Medidas da carta",
    lead: "É o tamanho da carta já cortada, sem contar a sangria.",
    howTo: [
      "Digite largura e altura em milímetros, ou use as setinhas para andar de meio em meio milímetro.",
      "A sangria ao redor é escolhida na etapa seguinte.",
    ],
    when: "Mexa quando você mede uma carta original com régua e quer chegar exatamente naquele tamanho.",
    warning:
      "Medidas maiores que o normal reduzem quantas cartas cabem na folha. A contagem por folha aparece na etapa 5.",
  },
  "raio-cantos": {
    title: "Raio dos cantos",
    lead: "É o quanto o canto da carta fica arredondado, medido em milímetros.",
    howTo: [
      "Em 0 os cantos ficam retos.",
      "Suba aos poucos e olhe a prévia para escolher o que agrada.",
    ],
    example: "3 mm dá o canto clássico de carta de baralho. 2 mm fica discreto e 4 mm fica bem redondo.",
    when: "Na Silhouette Cameo esse valor é o que a máquina realmente corta. Na Guilhotina ele serve como guia na tela, e só sai impresso se você ligar o contorno.",
  },
  "contorno-impresso": {
    title: "Imprimir o contorno arredondado",
    lead: "Decide se a linha do canto redondo sai impressa no papel ou fica só na prévia.",
    howTo: [
      "Desligado: o arredondamento aparece na tela como guia, e o papel sai limpo.",
      "Ligado: o contorno sai impresso para você seguir com a tesoura de canto.",
    ],
    avoid: "Ligado, a linha impressa pode ficar visível na carta pronta se o corte não seguir bem o contorno.",
  },

  // ---------------------------------------------------------------- etapa 4
  "etapa-sangria": {
    title: "Etapa 4: Sangria",
    lead: "Escolha a margem da frente e como as cartas devem ocupar a folha. O sistema combina os espaços para você.",
    howTo: [
      "Escolha Seguro para preservar toda a margem, Econômico para compartilhar a faixa segura ou Cartas coladas para cortar na divisa.",
      "Se a frente veio cortada rente à carta, ligue Criar sangria nas frentes.",
      "Ajuste o verso separadamente quando ele precisar de outra margem.",
      "Abra Ajustes avançados apenas quando precisar controlar métodos ou medidas especiais.",
    ],
    example: "Frente com 0 mm e verso com 2 mm de sangria ajuda quando o verso tem borda sólida e a frente será a referência do corte.",
    warning: "A arte original nunca é alterada. A sangria é criada só na folha montada.",
  },
  "sangria-mm": {
    title: "Sangria da frente em milímetros",
    lead: "É a largura da faixa extra da frente que participa da organização das cartas na folha.",
    howTo: [
      "Comece com 2 mm, que serve para quase todo caso.",
      "Se o corte for na mão, 3 mm dá mais folga.",
      "Use 0 mm quando a frente deve ser impressa exatamente até a linha de corte.",
    ],
    example: "Carta de 63,5 × 88 mm com 2 mm de sangria ocupa 67,5 × 92 mm na folha, no modo de sangria completa.",
    avoid: "Sangria muito grande gasta folha e pode tirar uma carta de cada folha.",
  },
  "modo-sangria": {
    title: "Organização na folha",
    lead: "Você escolhe o resultado e o sistema combina sangria e distância sem controles concorrentes.",
    howTo: [
      "Seguro: cada carta preserva a sangria inteira nos quatro lados.",
      "Econômico: cartas vizinhas compartilham apenas a faixa segura, então cabe mais por folha.",
      "Cartas coladas: o corte cai na divisa e a margem entre vizinhas é descartada.",
      "Personalizado: libera a distância manual nos Ajustes avançados da folha.",
    ],
    when: "Compartilhada e coladas rendem mais folha, o que ajuda em baralhos grandes.",
    warning: "No modo coladas, um corte torto invade a carta vizinha. Use quando você confia no corte.",
  },
  "criar-sangria": {
    title: "Criar sangria nas frentes",
    lead: "Inventa uma faixa nas imagens de frente que vieram cortadas na linha, como digitalizações e imagens baixadas.",
    howTo: [
      "Ligue a criação de sangria nas frentes.",
      "Escolha o método de preenchimento.",
      "Confira o resultado na prévia antes de montar.",
    ],
    when: "O sistema avisa quantas cartas parecem estar cortadas na linha. Esse aviso é um bom sinal para ligar.",
    avoid: "Se a arte já vem com sangria de fábrica, deixe desligado para não repetir faixa.",
  },
  "sangria-fake-verso": {
    title: "Sangria só no verso",
    lead: "Cria no verso a mesma faixa que Criar sangria inventa na frente, sem mudar frente, grade, tamanho final ou receita da Cameo.",
    howTo: [
      "Ligue quando a frente vai sem sangria, mas o verso tem borda sólida e precisa cobrir pequenas diferenças de alinhamento.",
      "Escolha quantos milímetros o verso pode passar da linha de corte.",
      "Escolha o método usado para inventar essa faixa extra do verso.",
      "Use Reduzir a arte do verso quando quiser que a borda sólida do verso fique mais exposta: a imagem encolhe para dentro e o corte não muda.",
      "Confira a prévia do verso antes de montar o PDF.",
    ],
    when: "É útil quando duas cartas encostadas já têm a borda do verso servindo como margem, mas as laterais externas da folha ainda poderiam ficar brancas.",
    avoid: "Não use para corrigir corte errado da frente. A linha de corte continua a mesma, porque a frente ainda é a referência.",
    warning: "A expansão é limitada pela folha e pelo espaço entre cartas, para não imprimir um verso por cima do outro.",
  },
  "metodos-sangria": {
    title: "Métodos de criar sangria",
    lead: "Cada método inventa a faixa que falta de um jeito diferente.",
    howTo: [
      "Esticar: puxa os pixels da borda para fora. Simples e funciona na maioria dos casos.",
      "Espelhar: reflete a arte junto da borda. Bom para molduras e desenhos simétricos.",
      "Cor: preenche com uma cor lisa, tirada da média da borda ou escolhida por você.",
      "Esticar com desfoque: estica e depois suaviza, escondendo a repetição de padrões.",
    ],
    example: "Arte com moldura preta fica ótima com Cor. Foto de paisagem fica melhor com Esticar com desfoque.",
  },
  "aparar-borda": {
    title: "Aparar a borda antes de criar",
    lead: "Descarta uma faixa fininha na borda da arte antes de inventar a sangria.",
    howTo: [
      "Ligue quando a arte chega com canto arredondado ou sobra branca.",
      "Informe a faixa a aparar em milímetros.",
      "Ligue Aparar os cantos para fazer um corte arredondado em cada canto e informe o raio em milímetros.",
    ],
    example:
      "0,5 mm aparados resolvem a sobra branca típica de uma digitalização. Um raio de 3 mm tira o canto arredondado já impresso.",
    avoid: "Aparar demais come a arte útil da carta. Os cantos são arredondados depois da faixa aparada.",
  },
  "excecoes-carta": {
    title: "Ajuste só em uma carta",
    lead: "Uma carta pode ter um ajuste de sangria diferente do resto do baralho.",
    howTo: [
      "Clique na miniatura da carta para ajustar só ela.",
      "Use Copiar este ajuste para levar o mesmo ajuste a cartas escolhidas ou a todas.",
      "Use Voltar ao padrão para a carta seguir o baralho de novo.",
    ],
    example: "Uma carta digitalizada no meio de 40 cartas prontas: ligue a criação de sangria só nela.",
    when: "O selo âmbar na miniatura mostra quem está fora do padrão.",
  },
  "enquadramento-verso": {
    title: "Enquadramento do verso",
    lead: "Controla o zoom da imagem do verso dentro da área impressa do verso.",
    howTo: [
      "Suba o valor para afastar detalhes importantes da borda cortada.",
      "Use o botão para voltar a usar o mesmo valor da frente.",
    ],
    example: "Verso com moldura fina: 4 mm evita que a moldura encoste no corte.",
    avoid: "Isso não cria tinta fora da linha de corte sozinho. Para isso, use Sangria só no verso.",
  },

  // ---------------------------------------------------------------- etapa 5
  "etapa-folha": {
    title: "Etapa 5: Folha e marcas",
    lead: "Aqui você escolhe o papel, quantas cartas ficam por folha e quais marcas de corte saem impressas.",
    howTo: [
      "Escolha o tamanho da folha, ou digite a medida na opção Personalizada.",
      "Ajuste o espaço entre as cartas e a grade.",
      "Escolha as marcas e confira tudo na prévia ao lado.",
    ],
    when: "A prévia mostra na hora o que vai sair no papel, então vale testar valores olhando o resultado.",
  },
  "folha-tamanho": {
    title: "Tamanho da folha",
    lead: "É o papel em que as cartas serão impressas.",
    howTo: [
      "A4 é o papel comum, de 297 por 210 mm deitado.",
      "A3 rende mais cartas por folha.",
      "Personalizada deixa você digitar largura e altura, de 50 até 1000 mm.",
    ],
    warning:
      "Na Silhouette Cameo o padrão é A4 deitada, que é o tamanho testado na máquina. A3, folha em pé e folha personalizada aparecem depois que você liga a chave de folha diferente, no começo desta etapa, e são experimentais.",
  },
  orientacao: {
    title: "Orientação da folha",
    lead: "Folha deitada ou em pé muda quantas cartas cabem.",
    howTo: [
      "Deitada é o padrão e é obrigatório na Silhouette Cameo.",
      "Em pé vale só na Guilhotina, e às vezes rende uma carta a mais.",
    ],
    example: "Cartas de 63,5 × 88 mm costumam render mais em A4 deitada.",
  },
  "espaco-cartas": {
    title: "Espaço entre as cartas",
    lead: "No modo guiado, o sistema calcula a distância compatível com a organização escolhida.",
    howTo: [
      "Use Seguro, Econômico ou Cartas coladas para deixar o cálculo automático.",
      "Escolha Personalizado apenas quando precisar acrescentar uma distância manual.",
    ],
    example: "4 mm de espaço deixam lugar confortável para marcas de canto entre as cartas.",
    avoid: "Espaço grande demais tira cartas da folha.",
  },
  "canaleta-gutterfold": {
    title: "Canaleta do gutterfold",
    lead: "É o espaço entre a frente e o verso da peça dobrável.",
    howTo: [
      "Use 0 mm se frente e verso devem encostar exatamente na dobra.",
      "Use alguns milímetros se você quer uma lombada fina ou mais folga para dobrar.",
      "Confira a prévia: a linha tracejada mostra onde dobrar.",
    ],
    example: "4 mm costuma dar uma dobra confortável para protótipos colados.",
    warning: "A canaleta não é uma linha de corte. O arquivo de corte exportado e a Cameo recebem apenas o contorno externo.",
  },
  "direcao-gutterfold": {
    title: "Direção da dobra",
    lead: "Escolhe em qual sentido a folha inteira será dobrada ao meio.",
    howTo: [
      "Automática compara horizontal e vertical e usa a direção que comporta mais cartas.",
      "Horizontal coloca frentes em cima e versos invertidos embaixo, como na imagem de referência.",
      "Vertical coloca frentes à esquerda e versos espelhados à direita.",
    ],
    when: "Troque manualmente quando a posição do papel, a fibra ou o jeito de cortar forem mais importantes que o rendimento.",
  },
  grade: {
    title: "Grade da folha",
    lead: "Quantas cartas ficam por linha e por coluna em cada folha.",
    howTo: [
      "Automático usa tudo que cabe no tamanho escolhido.",
      "Eu escolho deixa você limitar, por exemplo para imprimir uma linha de teste.",
    ],
    example: "Automático em A4 deitada com carta de 63,5 × 88 mm costuma dar 4 por linha e 2 por coluna.",
    warning:
      "Se a grade pedida não cabe, ela é reduzida para o que a folha aceita. No acabamento Silhouette Cameo, espaços que cairiam sobre as marcas do sensor são deixados de fora.",
  },
  "marcas-tipos": {
    title: "Tipos de marca impressa",
    lead: "As linhas que aparecem no papel para guiar o corte na mão.",
    howTo: [
      "Cantos: traços curtos nos quatro cantos de cada carta.",
      "Cruzes: cruzinhas nos encontros entre cartas.",
      "Guias: linhas atravessando a folha inteira.",
      "Bordas: traços curtos só na margem da folha, para alinhar a guilhotina.",
      "Contorno: desenha a linha de corte em volta de cada carta.",
    ],
    when: "Pode ligar mais de um tipo ao mesmo tempo. A prévia mostra como cada um sai.",
    avoid: "Guias e contorno passam por cima da arte, então deixam risco visível se o corte sair fora.",
  },
  "marcas-medidas": {
    title: "Espessura, comprimento e distância",
    lead: "O tamanho das marcas impressas e o quanto elas ficam longe da carta.",
    howTo: [
      "Espessura: grossura do traço.",
      "Comprimento: tamanho do traço.",
      "Distância da carta: folga entre a marca e a linha de corte.",
    ],
    example: "0,2 mm de espessura, 4 mm de comprimento e 1 mm de distância dão uma marca discreta e fácil de ver.",
    avoid: "Distância zero coloca a marca em cima da carta, então ela pode aparecer na carta pronta.",
  },
  "marcas-cor": {
    title: "Cor das marcas",
    lead: "A cor do traço impresso.",
    howTo: [
      "Preto tem o maior contraste.",
      "Cinza fica discreto em artes claras.",
      "Ciano é fácil de ignorar com o olho e some em cópias em preto e branco.",
    ],
  },
  "marcas-onde": {
    title: "Onde imprimir as marcas",
    lead: "Escolhe se as marcas saem nas páginas da frente, nas do verso ou nas duas.",
    howTo: [
      "Use os três botões grandes no topo do bloco de marcas.",
      "Só na frente deixa o verso limpo.",
      "Só no verso esconde as marcas do lado que fica à mostra depois de colar.",
      "Frente e verso ajuda a conferir o alinhamento da impressão dos dois lados, e é o que a maioria das pessoas quer quando imprime em frente e verso.",
    ],
    when: "As páginas ímpares do PDF são a frente das cartas e as pares são o verso.",
  },
  "marcas-silhouette-onde": {
    title: "Marcas da Silhouette na frente ou no verso",
    lead: "Escolhe em qual lado da folha a Silhouette vai ler as marcas antes de cortar.",
    howTo: [
      "Na frente é o padrão e mantém o funcionamento atual.",
      "No verso imprime as marcas junto das artes do verso.",
      "Ao cortar, carregue na máquina o lado escolhido virado para cima.",
      "O sistema espelha as posições de corte automaticamente quando as marcas estão no verso.",
    ],
    warning: "Monte e baixe novamente o PDF depois de trocar o lado das marcas.",
  },
  "borda-branca-marcas": {
    title: "Borda branca das marcas",
    lead: "Uma faixa branca em volta das marcas do sensor, para o leitor da máquina enxergar bem.",
    howTo: [
      "Suba o valor se a máquina reclamar ao ler as marcas em arte escura.",
      "A faixa cobre só a arte ao redor das marcas.",
    ],
    example: "6 mm é o valor padrão e funciona bem em artes escuras.",
    warning:
      "Se essa faixa entrar no desenho da carta, aparece um aviso aqui mesmo com os ajustes que resolvem: mudar quantas cartas cabem por linha e coluna, reduzir a sangria ou reduzir a faixa. A faixa nunca pode ser desligada, senão a máquina não enxerga as marcas. Quando ela pega só a sangria, não há problema.",
  },

  // ---------------------------------------------------------------- etapa 6
  "etapa-montar": {
    title: "Etapa 6: Montar folhas",
    lead: "Aqui o sistema organiza tudo em folhas, e você gera o PDF de impressão.",
    howTo: [
      "Confira o resumo de cartas e folhas.",
      "Clique em Montar e baixar o PDF: num clique as folhas são montadas e o arquivo é salvo.",
      "Imprima em escala de 100%, sem ajustar à página.",
      "Se precisar cortar em outro programa, exporte as linhas de corte em DXF ou SVG aqui embaixo.",
    ],
    warning: "Montar de novo refaz tudo com os ajustes atuais, o que substitui a montagem anterior.",
  },
  "ajuste-verso": {
    title: "Ajuste da impressão do verso",
    lead: "Corrige o desalinhamento de impressoras que viram a folha fora de posição.",
    howTo: [
      "Imprima uma folha de teste dos dois lados.",
      "Meça o quanto o verso ficou fora do lugar.",
      "Informe esse valor aqui. Positivo move para a direita e para baixo, negativo para a esquerda e para cima.",
    ],
    example: "Verso 1,5 mm à esquerda do lugar: informe 1,5 no campo horizontal.",
    when: "O ajuste vale somente para as páginas de verso. A frente nunca é movida.",
  },
  "montar-folhas": {
    title: "Montar e baixar o PDF",
    lead: "Organiza as cartas nas folhas usando tamanho, sangria, grade e acabamento escolhidos, e já salva o PDF no seu computador.",
    howTo: [
      "Clique em Montar e baixar o PDF: num clique as folhas são montadas e o arquivo é salvo.",
      "Se quiser o mesmo arquivo outra vez, use Baixar novamente.",
      "Se mudar algo nas etapas anteriores, monte e baixe de novo: aparece um aviso quando isso acontece.",
    ],
    warning: "Imprima sempre em escala de 100%, sem ajustar à página, ou as medidas mudam no papel.",
  },
  "pdf-impressao": {
    title: "PDF para impressão",
    lead: "Gera um arquivo novo, pronto para a impressora, salvo no seu computador.",
    howTo: [
      "Gere o PDF depois de montar as folhas.",
      "Imprima em escala de 100%, sem margens automáticas.",
    ],
    warning:
      "O arquivo fica só no seu computador. O PDF ainda leva, invisível, a receita de corte, o que permite retomar o corte depois sem reconfigurar nada.",
  },
  "cartas-para-cortar": {
    title: "Cartas para cortar",
    lead: "Escolhe quais cartas da folha entram no corte da máquina.",
    howTo: [
      "Clique na carta na prévia para incluir ou retirar.",
      "Use Selecionar todas ou Desmarcar todas para ir rápido.",
    ],
    when: "Útil quando parte da folha já foi cortada ou quando você quer testar em uma carta só.",
  },

  // ---------------------------------------------------------------- fatiar
  "etapa-fatiar": {
    title: "Fatiar folha",
    lead: "Recorta uma folha cheia de cartas em imagens separadas, uma por carta.",
    howTo: [
      "Adicione folhas em PDF, PNG ou JPG. Cada página do PDF entra como uma folha separada.",
      "Ajuste as margens, o número de colunas e linhas e as folgas.",
      "Escolha PNG ou JPG e a qualidade em DPI.",
      "Baixe o zip com as cartas separadas.",
    ],
    warning: "O PDF e as imagens são abertos no seu computador. Nada é enviado para a internet.",
  },
  "fatiar-recorte": {
    title: "Margens, colunas e folgas",
    lead: "Diz ao sistema onde as cartas começam na folha e como estão distribuídas.",
    howTo: [
      "Ajuste as margens até a grade encostar na primeira carta.",
      "Informe quantas cartas há por linha e por coluna.",
      "Ajuste as folgas até a grade cair na divisa entre as cartas.",
    ],
    example: "Folha com 3 por linha e 3 por coluna: informe 3 colunas e 3 linhas e vá ajustando pela prévia.",
  },
  "fatiar-sobra": {
    title: "Sobra por carta",
    lead: "Faz o recorte pegar um pouco além ou um pouco dentro da linha.",
    howTo: [
      "Sobra positiva pega além da linha, o que ajuda a não perder arte.",
      "Sobra negativa fica por dentro, o que tira restos da carta vizinha.",
    ],
  },
  "fatiar-cantos": {
    title: "Preencher bordas automaticamente",
    lead: "Completa cantos e laterais de cada carta recortada com cores tiradas da própria carta.",
    howTo: [
      "Ligue quando a carta recortada tiver canto arredondado ou falha na borda.",
      "O raio dos cantos segue uma curva circular.",
      "A largura das laterais funciona de forma independente do raio.",
    ],
    example: "Raio de 6% e laterais de 1% resolvem a maioria das cartas com canto redondo.",
  },
  "fatiar-exportacao": {
    title: "Formato e qualidade",
    lead: "Define o tipo e a resolução das imagens de cartas incluídas no arquivo ZIP.",
    howTo: [
      "PNG preserva detalhes sem perdas e é o formato recomendado para impressão.",
      "JPG produz arquivos menores, mas aplica compressão à imagem.",
      "300 DPI mantém a quantidade atual de pixels; 150 reduz pela metade e 600 dobra.",
    ],
    warning: "Aumentar para 600 DPI não cria detalhes que não existiam na folha original, mas gera imagens maiores para o fluxo de impressão.",
  },

  // ---------------------------------------------------------------- maquina
  "etapa-maquina": {
    title: "Cameo",
    lead: "Aqui ficam os ajustes de material e o envio do corte para a Silhouette Cameo 4.",
    howTo: [
      "Escolha o preset do material que você está usando.",
      "Teste a conexão com o programa local.",
      "Deixe a máquina ler as marcas e depois mande cortar.",
    ],
    warning:
      "Se o corte parar no meio, não repita automaticamente. Confira a folha na base e recomece com calma, escolhendo só as cartas que faltam.",
  },
  "material-corte": {
    title: "Material e corte",
    lead: "Presets prontos com profundidade, força, velocidade e número de passadas para cada tipo de papel.",
    howTo: [
      "Papel comum, fotográfico glossy e fotográfico com BOPP linho já vêm ajustados.",
      "Personalizado libera os valores para você mexer.",
      "Teste sempre numa folha de sacrifício antes de cortar o baralho inteiro.",
    ],
    avoid: "Força alta em papel fino rasga a carta. Suba de pouco em pouco.",
  },
  "programa-local": {
    title: "Programa local",
    lead: "Um programa pequeno que roda no seu computador e é o único que fala com a Silhouette Cameo.",
    howTo: [
      "Baixe o pacote e rode o atalho de iniciar.",
      "Deixe a janela aberta enquanto for cortar.",
      "Use Testar conexão para confirmar que o site encontrou o programa.",
    ],
    when: "Ele recebe apenas medidas e ajustes de corte. Nunca recebe PDF, imagem ou pixels.",
    warning:
      "O corte na máquina funciona no Windows, porque usa a impressora USB do sistema. Em Mac e Linux o resto do site funciona, só o corte fica indisponível.",
  },
  "exportar-corte": {
    title: "Exportar linhas de corte",
    lead: "Gera um arquivo só com o contorno das cartas, sem nenhuma imagem, para cortar em outro programa.",
    howTo: [
      "Deixe marcadas as cartas que você quer cortar.",
      "Clique em DXF para abrir no Silhouette Studio, inclusive na versão gratuita.",
      "Clique em SVG para abrir no Illustrator, Inkscape, Corel ou em cortadoras de outras marcas.",
    ],
    when: "Útil quando você quer cortar em outra máquina, ou preparar o corte na mão dentro de outro programa.",
    example:
      "O arquivo sai no tamanho exato da folha, em milímetros, com um contorno por carta. Com mais de uma folha, vem um .zip com um arquivo por folha.",
    avoid:
      "O formato .studio3 não entra aqui: ele é fechado, sem documentação pública, e a única forma de criá-lo é abrindo o Silhouette Studio e salvando por lá. Importe o DXF e salve como .studio3 no próprio programa, se quiser esse arquivo.",
  },
  "cricut-design-space": {
    title: "PDF de marcas da Cricut",
    lead: "É o PDF que o Design Space cria no Print Then Cut, contendo as marcas pretas que a Cricut vai ler.",
    howTo: [
      "Baixe o Pacote Cricut e abra o SVG da folha no Design Space.",
      "Confira se o SVG ficou no tamanho real em milímetros.",
      "Use Print Then Cut e escolha salvar em PDF em vez de imprimir direto.",
      "Importe esse PDF de volta no PNP do Eron para usar as mesmas marcas nas cartas.",
      "Não precisa apagar o contorno de corte do PDF: o sistema usa esse desenho para alinhar as marcas às cartas.",
      "O Design Space põe o desenho no canto, e aqui as cartas ficam no centro. O sistema move as marcas junto, mantendo a mesma distância entre marca e corte.",
    ],
    avoid:
      "Não edite a posição, o tamanho nem a rotação do SVG depois de gerar o PDF de marcas. Se mexer, gere o pacote novamente.",
    warning:
      "Imprima o PDF final em 100% de escala. Se o sistema operacional ajustar para caber na página, o corte sai fora do lugar.",
  },
  "folha-personalizada": {
    title: "Folha personalizada",
    lead: "Você escolhe largura e altura da folha em milímetros, de 50 até 1000 mm.",
    howTo: [
      "Escolha Personalizada na lista de folhas.",
      "Digite a largura e a altura do papel que você tem.",
      "Confira na prévia quantas cartas passaram a caber.",
    ],
    when: "Para papel fora do padrão: carta, ofício, fotográfico 10x15, folha cortada na guilhotina.",
    example: "Uma folha de 330 por 480 mm rende bem mais cartas do que uma A4.",
    warning:
      "Imprima sempre na escala de 100%. Se a impressora reduzir para caber, o tamanho da carta sai errado.",
  },
  "folha-experimental-cameo": {
    title: "Folha diferente na Silhouette Cameo",
    lead: "As marcas de leitura e a conversa com a máquina foram testadas fisicamente só em A4 deitada.",
    howTo: [
      "Aceite o aviso para liberar a folha personalizada na Cameo.",
      "Faça um teste em papel comum, com a força baixa, antes de usar papel bom.",
      "Se a máquina não achar as marcas, volte para A4 deitada.",
    ],
    when: "Só use se você aceitar testar. Em A4 deitada nada muda: o comando enviado continua exatamente o mesmo de sempre.",
    warning:
      "Em folha diferente a leitura das marcas pode falhar, e a máquina pode recusar o trabalho. O risco é seu papel, então teste primeiro.",
  },
  "marcas-cobrem-arte": {
    title: "Faixa branca cobrindo a carta",
    lead: "Cada marca do sensor precisa de um fundo branco ao redor, senão a máquina não enxerga a marca.",
    howTo: [
      "Se a faixa cobre só a sangria, está tudo bem: aquela parte é aparada no corte.",
      "Se ela cobre o desenho da carta, mude a quantidade de cartas por linha e por coluna.",
      "Reduzir a sangria em 1 mm também costuma resolver.",
    ],
    when: "O aviso aparece só quando a faixa entra na área final da carta, que é a parte que fica na mão de quem joga.",
    avoid:
      "Não existe desligar a faixa branca: sem ela a leitura das marcas falha e a Cameo não corta.",
    example:
      "Em A4 deitada com carta de 63,5 por 88 mm, passar de 4 para 3 cartas por linha normalmente tira todas de baixo das marcas.",
  },
  "etapa-retomar": {
    title: "Retomar corte",
    lead: "Abre um PDF gerado aqui e recupera a receita de corte que ficou guardada dentro dele.",
    howTo: [
      "Abra o PDF que você gerou neste site.",
      "As folhas e as cartas voltam prontas, sem reconfigurar nada.",
      "Escolha a folha e mande cortar.",
    ],
    when: "Perfeito para imprimir hoje e cortar amanhã.",
  },
} satisfies Record<string, HelpTopic>;

export type HelpTopicId = keyof typeof HELP_TOPICS;

export function helpTopic(id: HelpTopicId): HelpTopic {
  return HELP_TOPICS[id];
}
