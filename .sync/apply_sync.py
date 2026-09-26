from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"{label}: trecho esperado não encontrado em {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# Mantém a configuração pública do bridge e adiciona apenas o novo parâmetro funcional.
bridge = Path("local-bridge/bridge.py")
text = bridge.read_text(encoding="utf-8")
if 'mark_arm_mm=job["mark_arm_mm"]' not in text:
    old = '''                        on_progress=lambda card, total, p, tp: publish({
                            "type": "progress",
                            "card": card,
                            "totalCards": total,
                            "pass": p,
                            "totalPasses": tp,
                        }),
                    )'''
    new = '''                        on_progress=lambda card, total, p, tp: publish({
                            "type": "progress",
                            "card": card,
                            "totalCards": total,
                            "pass": p,
                            "totalPasses": tp,
                        }),
                        mark_arm_mm=job["mark_arm_mm"],
                    )'''
    if old not in text:
        raise SystemExit("bridge: bloco cut_job não encontrado")
    bridge.write_text(text.replace(old, new, 1), encoding="utf-8")

# README
replace_once(
    "README.md",
    '''- **A4**.
- **A3** para fluxos compatíveis.
- Folha **personalizada**, entre 50 e 1000 mm por lado.
- Orientação paisagem ou retrato quando compatível com o acabamento escolhido.''',
    '''- **A4**, **A3** e **A5**.
- **Carta (279 × 216 mm)** e **Ofício (356 × 216 mm)**.
- **Polaseal A4 (220 × 307 mm)** para projetos plastificados antes do corte.
- Folha **personalizada**, entre 50 e 1000 mm por lado.
- Orientação paisagem ou retrato quando compatível com o acabamento escolhido.
- Em folhas personalizadas, largura e altura são respeitadas exatamente como digitadas.''',
    "README folhas",
)
replace_once(
    "README.md",
    '> Na Silhouette Cameo, o formato fisicamente validado é **A4 paisagem**. Folhas personalizadas e retrato exigem confirmação explícita no sistema. A3 não é usada no modo Cameo.',
    '> Na Silhouette Cameo, o corte direto pelo PNP Cameo Bridge permanece fisicamente validado em **A4 paisagem**. Outros formatos que cabem na largura da máquina podem aparecer como experimentais na montagem; A3 e Ofício permanecem bloqueados no modo Cameo.',
    "README aviso Cameo",
)
replace_once(
    "README.md",
    'No fluxo Cricut, apenas o **SVG de corte** precisa ir para o Design Space. As imagens das cartas permanecem no PNP do Eron.',
    '''No fluxo Cricut, apenas o **SVG de corte** precisa ir para o Design Space. As imagens das cartas permanecem no PNP do Eron.

- O PDF devolvido pelo Design Space é analisado para localizar as marcas e a área ocupada pelo desenho, mantendo o alinhamento com a posição real das cartas.
- Na Cameo, o braço em L das marcas usa **10 mm por padrão**. Há um ajuste experimental entre 10 e 20 mm que altera somente o comprimento do braço e o comando correspondente de registration.''',
    "README Cricut/Cameo",
)

# Bridge README
replace_once(
    "local-bridge/README.md",
    '  "sheet": 1,\n  "cards":',
    '  "sheet": 1,\n  "markArmMm": 10,\n  "cards":',
    "bridge README exemplo",
)
replace_once(
    "local-bridge/README.md",
    '''Não alterar `TB51,200`, `TB53,20`, `TB123,3800,5540,118,118`, os tempos ou as marcas
de 10 mm sem uma nova captura USBPcap que comprove a mudança.''',
    '''O protocolo fisicamente validado continua usando `TB51,200`, equivalente a braços de **10 mm**. O modo experimental aceita braços entre 10 e 20 mm e altera somente o valor de `TB51` na proporção de 20 unidades por milímetro. `TB53,20`, `TB123,3800,5540,118,118`, os tempos, a sequência de registration e os critérios de sucesso permanecem congelados.''',
    "bridge README protocolo",
)

# Changelog
changelog = Path("CHANGELOG.md")
text = changelog.read_text(encoding="utf-8")
heading = "## 2026-09-26 - atualização 2"
if heading not in text:
    section = '''

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
- Prévia, auditoria de tamanho, áreas seguras e mensagens de ajuda foram atualizadas para considerar o tamanho configurado das marcas e os novos formatos de folha.
'''
    anchor = "As mudanças relevantes do PNP do Eron são registradas neste arquivo."
    if anchor not in text:
        raise SystemExit("CHANGELOG: âncora não encontrada")
    changelog.write_text(text.replace(anchor, anchor + section, 1), encoding="utf-8")
