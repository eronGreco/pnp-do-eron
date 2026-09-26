# AGENTS.md

## Objetivo

Preserve a confiabilidade do fluxo Print & Play, a privacidade dos arquivos do usuário e a compatibilidade com os formatos de impressão e corte suportados.

## Regras

- PDFs, imagens e previews devem permanecer no computador do usuário, salvo quando uma função documentada exigir explicitamente comunicação externa.
- Não envie conteúdo de cartas para telemetria, logs remotos ou serviços de terceiros.
- Não altere geometrias ou protocolos de corte fisicamente validados sem testes específicos.
- Não inclua segredos, tokens, chaves privadas ou credenciais no repositório.
- Preserve compatibilidade com o PNP Cameo Bridge ao alterar contratos em `src/cameo/`.
- Antes de concluir mudanças relevantes, rode `bun run test`, `bun run typecheck` e `bun run build`.
- Novos recursos devem incluir testes quando houver lógica determinística testável.
