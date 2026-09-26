# Changelog

As mudanças relevantes do PNP do Eron são registradas neste arquivo.

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
