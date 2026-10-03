# Changelog

As mudanças relevantes do PNP do Eron são registradas neste arquivo.

## 2026-09-26 - atualização 3

### Cricut: SVG no tamanho correto no Design Space

- O Pacote Cricut passa a gerar o SVG em pixels calculados a 72 DPI e sem `viewBox`, formato confirmado em teste real no Cricut Design Space para preservar a escala física da folha.
- Adicionado um retângulo sem preenchimento do tamanho completo da folha como âncora de dimensão, evitando que uma folha com poucas cartas seja importada pelo tamanho apenas da área desenhada.
- Os recortes das cartas passam a ser subcaminhos de um único caminho, mantendo as linhas de corte agrupadas no Design Space.
- O retângulo da folha serve apenas como referência de tamanho e deve ser removido do corte antes de cortar; as instruções do painel e do pacote foram atualizadas.
- Os exportadores SVG e DXF genéricos e o fluxo da Silhouette Cameo não mudam com esse ajuste.

### Cricut: alinhamento das marcas

- A leitura da área ocupada pelo desenho no PDF do Design Space não descarta mais uma faixa fixa depois das marcas.
- O detector passa a mascarar somente os pixels reais das marcas, com uma pequena folga para antisserrilhamento, permitindo reconhecer corretamente a primeira coluna quando ela começa alinhada ao braço em L.
- Corrigido o deslocamento horizontal observado nas marcas quando as cartas começavam junto ao braço em L do Design Space.
- Moldes de marcas criados com a leitura anterior devem ser importados novamente para usar o alinhamento corrigido.

### Sangria, persistência e grade Cameo

- Quando a sangria específica do verso está desativada, o verso passa a reutilizar a sangria gerada da frente em vez de esticar a arte original dentro da margem.
- IDs de imagens importadas agora são únicos entre sessões, evitando colisões com imagens restauradas de um trabalho salvo.
- A grade automática da Cameo passa a reservar também a borda branca configurada ao redor das marcas, evitando montar cartas em posições que seriam rejeitadas depois pela auditoria.
- A cobertura de regressão foi atualizada para validar que a grade automática não coloca cortes dentro da área protegida das marcas.

## 2026-09-26 - atualização 2

### Cricut: leitura e alinhamento das marcas

- Refeito o reconhecimento das marcas no PDF gerado pelo Cricut Design Space, com validação dos cantos e filtragem mais robusta dos elementos gráficos da página.
- O sistema passa a detectar a área ocupada pelo desenho no PDF e usa essa referência para deslocar as marcas até a posição real das cartas na montagem.
- A prévia mostra a área de desenho reconhecida e avisa quando ela não pôde ser detectada ou quando o tamanho do desenho não corresponde à montagem atual.
- Adicionados testes automatizados específicos para o alinhamento entre o desenho detectado no PDF e a geometria das cartas.

### Silhouette Cameo: marcas de registro

- Adicionada opção experimental para alterar o comprimento dos braços em L das marcas de registro entre 10 e 20 mm, em passos de 0,5 mm.
- O padrão continua em 10 mm, único tamanho fisicamente validado na Cameo 4.
- O tamanho escolhido passa pelo PDF, manifesto do trabalho, transporte local e PNP Cameo Bridge até o comando de registration da máquina.
- No protocolo da Cameo, somente o `TB51` varia quando o modo experimental é usado; os demais comandos, tempos e validações permanecem inalterados.
- Corrigida a área branca de proteção das marcas para acompanhar individualmente o quadrado e os braços em L, sem criar margem excessiva ao redor do quadrado.

### Folhas e dimensões

- Adicionados presets de folha A5, Carta, Ofício e Polaseal A4 (220 × 307 mm), além de A4, A3 e tamanho personalizado.
- Folhas personalizadas agora respeitam exatamente a largura e a altura digitadas, sem trocar automaticamente os valores pela orientação.
- A5, Carta e Polaseal podem ser selecionados no fluxo Cameo mediante confirmação experimental; A3 e Ofício continuam bloqueados nesse modo por excederem a largura útil considerada.
- O PNP Cameo Bridge continua validado para corte direto em A4 paisagem.

### Grade, margens e interface

- Quando as marcas do sensor bloqueiam posições da grade, o sistema passa a sugerir alternativas de organização que possam aproveitar melhor a folha.
- Adicionado atalho direto do aviso de grade para o ajuste da borda branca das marcas.
- Campos numéricos agora permitem digitação livre durante a edição e normalizam o valor ao confirmar ou sair do campo.
- Prévia, auditoria de tamanho, áreas seguras e mensagens de ajuda foram atualizados para considerar o tamanho configurado das marcas e os novos formatos de folha.


## 2026-09-26

### Montagem e gutterfold

- Adicionado gutterfold em dois formatos: **carta por carta** e **dobra da folha inteira**.
- A dobra da folha inteira pode ser automática, horizontal ou vertical. No modo automático, o sistema escolhe a direção com melhor aproveitamento da folha.
- O gutterfold de folha inteira passa a funcionar nos fluxos de Guilhotina, Silhouette Cameo e Cricut.
- Revisada a geometria da dobra para que canaleta de 0 mm encoste frente e verso exatamente na linha central.
- A canaleta passa a representar somente a distância real da dobra e nunca entra nos vetores de corte.
- Sangrias e áreas visíveis de frente e verso passam a ser isoladas para evitar invasão de cartas ou faces vizinhas.
- Corrigido o gutterfold carta por carta para impedir que a margem do verso atravesse a frente ou outra peça.
- A prévia passa a mostrar a linha de dobra da folha inteira e a rotação correta do verso.

### Organização da folha e sangria

- Adicionados modos guiados de organização: **Seguro**, **Econômico** e **Cartas coladas**.
- Adicionado modo **Personalizado** para liberar compartilhamento de margem, distância manual e grade avançada.
- O padrão agora usa organização segura, sem distância adicional entre cartas e com canaleta de gutterfold em 0 mm.
- Controles incompatíveis com a configuração atual permanecem visíveis, mas bloqueados com uma explicação do motivo.
- Margens que não se aplicam ao modo Cartas coladas são bloqueadas para evitar configurações contraditórias.
- Ajustes avançados de frente, verso, folha e exceções por carta foram reorganizados para reduzir ruído na interface.
- Trabalhos salvos anteriormente continuam sendo normalizados sem alterar suas medidas físicas.

### Fatiar folha

- O Fatiar folha passa a aceitar **PDF, PNG e JPG**.
- Cada página de um PDF importado é tratada como uma folha local independente.
- A exportação das cartas pode ser feita em **PNG ou JPG**.
- Adicionadas opções de **150, 300 e 600 DPI** para a saída das imagens.
- 300 DPI preserva a resolução-base do recorte, 150 DPI reduz proporcionalmente e 600 DPI amplia proporcionalmente.
- Ajustes dependentes do preenchimento de bordas agora deixam claro quando estão desativados.

### Silhouette Cameo

- As marcas de registro podem ficar na **frente ou no verso**, mantendo a frente como padrão.
- Quando o verso é escolhido, a geometria de corte é espelhada para acompanhar corretamente a folha carregada na máquina.
- O lado escolhido para as marcas passa a ser preservado no manifesto do trabalho de corte.
- A prévia exibe as marcas no lado realmente configurado para leitura pela Silhouette.

### Validação, download e interface

- Adicionada confirmação explícita para permitir o download de uma montagem mesmo quando a conferência encontra problemas relevantes.
- O aviso lista os problemas detectados e permite voltar aos ajustes antes de continuar.
- Campos dependentes de outras opções agora apresentam estado desativado consistente e explicam o que precisa ser habilitado para editá-los.
- A seleção de grade manual foi renomeada para **Personalizada** e seus campos ficam bloqueados enquanto a grade automática está ativa.
- As instruções permanentes da prévia foram movidas para um botão de informação, deixando a área de trabalho mais limpa.
- Textos de ajuda foram atualizados para refletir os novos fluxos de dobra, organização, exportação e corte.
