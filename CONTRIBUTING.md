# Contribuindo com o PNP do Eron

Obrigado pelo interesse em melhorar o projeto.

## Fluxo recomendado

1. Faça um fork do repositório público.
2. Crie uma branch a partir de `main`.
3. Faça mudanças pequenas e focadas.
4. Inclua ou atualize testes quando houver lógica testável.
5. Rode localmente:

```bash
bun install
bun run test
bun run typecheck
bun run build
```

6. Abra um Pull Request explicando o problema, a solução e como você testou.

## Regras importantes

- Não commite `.env`, tokens, service roles ou qualquer segredo.
- Não envie PDFs, imagens ou previews de usuários para serviços externos.
- Mudanças em protocolos da Cameo devem preservar o uso do driver padrão do Windows e a lógica de acesso exclusivo já validada.
- Mudanças que alterem geometria, escala, sangria ou marcas de registro devem incluir teste ou evidência reproduzível.
- Evite refatorações grandes misturadas com correções pequenas no mesmo PR.

## Pull Requests

O CI precisa passar antes de uma contribuição ser integrada. Um PR aprovado no repositório público ainda pode passar por uma etapa adicional de validação antes de chegar à versão publicada.
