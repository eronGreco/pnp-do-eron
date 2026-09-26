# PNP Cameo Bridge

Serviço local mínimo. É o único componente autorizado a falar com a Silhouette Cameo 4.

O bridge é um programa local temporário. Feche a janela e ele deixa de funcionar.

## Como usar

1. Baixe o arquivo `PNP-Cameo-Bridge.zip` pelo botão exibido no site.
2. Clique com o botão direito no ZIP e escolha **Extrair tudo**.
3. Abra a pasta extraída e dê dois cliques em `INICIAR_BRIDGE.bat`.
4. Deixe a janela aberta e volte para o site.
5. Clique em **Verificar novamente**.

O Windows precisa ter Python 3.9 ou superior. Se ele não estiver disponível, o
iniciador abre automaticamente a página oficial para instalação. Depois disso, execute
`INICIAR_BRIDGE.bat` novamente.

O app detecta o bridge automaticamente. Sem ele, tudo de PDF continua funcionando
e apenas os botões de hardware ficam indisponíveis.

## O que o bridge recebe

Somente números:

```json
{
  "sheet": 1,
  "markArmMm": 10,
  "cards": [{ "x0Mm": 20.0, "y0Mm": 20.0, "x1Mm": 72.0, "y1Mm": 72.0 }],
  "settings": {
    "depth": 4, "force": 18, "speed": 2, "passes": 1,
    "radiusMm": 3, "lineOvercut": false, "lineOvercutMm": 0.1
  }
}
```

Nunca PDF, nunca imagem, nunca pixels, nunca caminho de arquivo, nunca comando de sistema.
Campos desconhecidos, valores fora de faixa e cartas fora da folha A4 são recusados
em `validation.py` antes de qualquer acesso à máquina.

## Segurança

- Escuta apenas em `127.0.0.1:8787`, nunca em `0.0.0.0`.
- CORS restrito às origens oficiais do app.
- Token de sessão novo a cada execução, entregue no handshake `GET /health` e exigido
  em todas as demais chamadas (`X-Bridge-Token`).
- Um trabalho físico por vez: chamadas concorrentes são recusadas.

## HTTPS e conteúdo misto

O app é servido por HTTPS e o bridge por HTTP em `127.0.0.1`. Isso **não** é conteúdo
misto bloqueado: navegadores tratam `127.0.0.1` e `localhost` como origens
potencialmente confiáveis (W3C Secure Contexts), então `fetch` e `EventSource` para
`http://127.0.0.1:8787` são permitidos a partir de uma página HTTPS. Por isso o bridge
não precisa de certificado, e por isso ele nunca deve escutar em outro endereço:
o endereço de loopback é justamente o que garante a exceção e mantém o serviço
inacessível pela rede.

## Endpoints

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/health` | handshake, versão e token de sessão |
| GET | `/events?token=...` | fluxo de log e progresso (SSE) |
| POST | `/test-connection` | sessão exclusiva, ESC ENQ, verifica READY, fecha |
| POST | `/read-marks` | READY, registration completo, READY final |
| POST | `/cut-job` | READY, registration, AutoBlade, cartas, `M0,0`, READY |

## Protocolo congelado

`cameo_protocol.py`, `usbprint.py` e `persistent_reader.py` reproduzem exatamente o
comportamento validado fisicamente no PNP-Cameo-GUI v1.7v:

- USBPRINT nativo do Windows, GUID `{28d78fad-5a12-11d1-ae5b-0000f803a8c2}`,
  VID `0x0B4D` / PID `0x1137`. Sem Zadig, libusb, PyUSB, WinUSB, Inkscape ou Bluetooth.
- `CreateFileW` com `dwShareMode = 0` (exclusivo) e `FILE_FLAG_OVERLAPPED`.
  Sharing violation aborta com a mensagem sobre o Silhouette Studio.
- BULK-IN sempre pendente durante o registration; `CancelIoEx` só no encerramento.
- Status `ESC ENQ` (`0x1B 0x05`): `0` READY, `1` MOVING, `2` UNLOADED.
- Registration: bloco 1, espera 108 ms, bloco 2, primeiro status em 526 ms,
  polling de 1,015 s. Sucesso REAL somente `b"    0\x03"`, seguido de novo `ESC ENQ`
  e `b"0\x03"`. `b"    1\x03"` não é sucesso; `b"   -1\x03"` é falha; resposta
  desconhecida em sessão exclusiva é erro de protocolo.
- AutoBlade no holder 1, na ordem exata do arquivo.
- 1 mm = 20 unidades (`round(mm * 20)`); origem lógica na marca superior esquerda
  (10, 10) mm; comandos `M`/`D` na ordem Y,X.
- Fim do trabalho: `M0,0` e READY.

O protocolo fisicamente validado continua usando `TB51,200`, equivalente a braços de **10 mm**. O modo experimental aceita braços entre 10 e 20 mm e altera somente o valor de `TB51` na proporção de 20 unidades por milímetro. `TB53,20`, `TB123,3800,5540,118,118`, os tempos, a sequência de registration e os critérios de sucesso permanecem congelados.

## Arquivos

- `bridge.py` — servidor HTTP local, CORS, token, SSE.
- `usbprint.py` — handle exclusivo USBPRINT e escrita overlapped.
- `persistent_reader.py` — BULK-IN persistente.
- `cameo_protocol.py` — registration, AutoBlade, caminhos de corte, trabalho completo.
- `validation.py` — validação de geometria e parâmetros.
