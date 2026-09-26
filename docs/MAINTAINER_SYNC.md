# Fluxo de manutenção

Este repositório público é a superfície de colaboração com a comunidade.

## Entrada de contribuições

1. Contribuidores abrem Pull Requests contra `main`.
2. O CI executa testes, typecheck e build.
3. Mudanças aprovadas são revisadas funcionalmente.
4. Apenas alterações validadas são promovidas para o repositório privado de publicação.

## Publicação

O ambiente de publicação pode usar infraestrutura diferente do repositório público. Por isso, uma contribuição aprovada no código público não implica publicação automática.

## Sincronização

Ao promover mudanças para o repositório privado:

- prefira commits pequenos e rastreáveis;
- preserve diferenças de infraestrutura e credenciais;
- nunca copie `.env` ou segredos entre repositórios;
- rode novamente os testes e o build no repositório privado antes de publicar.

No sentido contrário, mudanças feitas na versão privada devem ser reaplicadas ao repositório público sem carregar arquivos internos, credenciais, histórico privado ou configurações específicas de infraestrutura.

## Controle de sincronização

Último snapshot promovido do repositório de publicação:

- Data: `2026-09-26`
- Commit de origem: `65b33bec6cb6dc9231ce9984412c5de8f579d42a`
- Pull Request público: `#2`
- Commit público resultante: `245b556266121a90ff1410a7136031d7a76dd65d`

Na próxima sincronização do privado para o público, use o commit de origem acima como base da comparação e atualize este bloco depois que o novo lote for validado e incorporado.
