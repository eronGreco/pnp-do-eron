# PNP do Eron

Ferramenta web para preparar projetos Print & Play para impressão e corte, com foco em cartas, folhas de impressão e integração opcional com plotters de recorte.

## Interface

### Montar cartas

Fluxo de montagem, acabamento e preparação para corte com Silhouette Cameo, Cricut ou guilhotina.

![Montagem de cartas e preparação para corte](docs/screenshots/montar-cartas.webp)

### Fatiar folha

Separação visual de uma folha em cartas individuais, com controle de grade, margens e espaçamento.

![Fatiamento de uma folha em cartas individuais](docs/screenshots/fatiar-folha.webp)

## O que o projeto faz

- Abre e processa PDFs localmente no navegador.
- Detecta cartas e marcas de corte.
- Monta folhas para impressão em diferentes formatos.
- Gera sangria quando necessário.
- Trabalha com frente e verso.
- Exporta PDFs e vetores de corte.
- Possui fluxo específico para Silhouette Cameo 4 por meio de um bridge local para Windows.
- Possui ferramentas auxiliares para Cricut.
- Pode ser instalado como PWA.

## Privacidade

PDFs, imagens, previews e conteúdo das cartas são processados localmente no navegador. O projeto foi desenhado para que esses arquivos não precisem ser enviados a servidores externos.

Recursos opcionais que usam serviços online, como diagnóstico por IA, enviam somente os dados explicitamente informados pela interface e os parâmetros numéricos necessários ao diagnóstico. Eles não devem enviar PDFs, imagens ou previews.

## Stack

- React 19
- TypeScript
- TanStack Start e TanStack Router
- Vite
- Tailwind CSS
- Nitro
- pdf-lib e PDF.js
- Supabase para recursos opcionais de backend
- Python no PNP Cameo Bridge

## Desenvolvimento

Requisitos:

- Bun
- Git
- Python 3 para trabalhar no bridge local

```bash
git clone https://github.com/eronGreco/pnp-do-eron.git
cd pnp-do-eron
bun install
bun run dev
```

### Scripts

```bash
bun run dev
bun run build
bun run test
bun run typecheck
bun run lint
```

## Configuração opcional

O núcleo de preparação de arquivos roda localmente. Alguns recursos opcionais de servidor usam Supabase e OpenAI.

Copie `.env.example` para `.env` e preencha apenas o que realmente for usar.

Nunca commite chaves privadas, service roles ou tokens pessoais.

## PNP Cameo Bridge

O diretório `local-bridge/` contém o companion local para Windows responsável pela comunicação com a Silhouette Cameo 4 usando o driver padrão USBPRINT do Windows.

O bridge escuta somente em `127.0.0.1` e recebe dados estruturados de corte. Ele não deve receber PDFs, imagens ou pixels das cartas.

Consulte `local-bridge/README.md` para detalhes.

## Contribuindo

Contribuições são bem-vindas. Para alterações relevantes:

1. Faça um fork.
2. Crie uma branch para sua alteração.
3. Rode os testes e o build localmente.
4. Abra um Pull Request descrevendo claramente o problema e a solução.

Leia também [`CONTRIBUTING.md`](CONTRIBUTING.md).

Pull Requests passam por CI antes de serem considerados para integração na versão publicada.

## Segurança e privacidade

Mudanças que façam PDFs, imagens ou previews saírem do computador do usuário serão rejeitadas, salvo quando houver uma função explicitamente desenhada para isso, com consentimento claro e documentação correspondente.

## Licença

MIT. Consulte [`LICENSE`](LICENSE).
