import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";

type Props = {
  bridgeOnline: boolean | null;
  bridgeVersion?: string | null;
  bridgeOutdated?: boolean;
  requiredBridgeVersion?: string;
  busy: boolean;
  canCut: boolean;
  installHint: string;
  onTest: () => void;
  onReadMarks: () => void;
  onCut: () => void;
  onRefreshBridge: () => void;
};

export function CameoControls({
  bridgeOnline,
  bridgeVersion,
  bridgeOutdated,
  requiredBridgeVersion,
  busy,
  canCut,
  installHint,
  onTest,
  onReadMarks,
  onCut,
  onRefreshBridge,
}: Props) {
  const offline = bridgeOnline === false;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${
            bridgeOnline === null
              ? "bg-muted-foreground"
              : bridgeOnline
                ? "bg-primary"
                : "bg-destructive"
          }`}
        />
        <span className="text-muted-foreground">
          {bridgeOnline === null
            ? "Procurando o programa local"
            : bridgeOnline
              ? `Programa local conectado${bridgeVersion ? ` (versão ${bridgeVersion})` : ""}`
              : "PNP Cameo Bridge não encontrado."}
        </span>
      </div>

      {bridgeOnline === true && !bridgeOutdated && requiredBridgeVersion && (
        <p className="text-[11px] text-muted-foreground">
          Versão conferida com este site (esperada: {requiredBridgeVersion}). Nada a atualizar.
        </p>
      )}

      {bridgeOnline === true && bridgeOutdated && (
        <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
          <p className="text-xs font-semibold text-warning">Programa local desatualizado</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Você tem a versão {bridgeVersion ?? "antiga"} e este site já usa a{" "}
            {requiredBridgeVersion}. Baixe o pacote novo, feche a janela antiga e dê dois cliques em
            INICIAR_BRIDGE.bat.
          </p>
          <div className="grid gap-2">
            <Button asChild size="sm" className="w-full text-xs">
              <a href="/downloads/PNP-Cameo-Bridge.zip" download>
                <Download className="shrink-0" />
                Atualizar
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={onRefreshBridge}
            >
              <RefreshCw className="shrink-0" />
              Verificar novamente
            </Button>
          </div>
        </div>
      )}


      {offline && (
        <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 p-3">
          <div>
            <p className="text-xs font-semibold text-warning">Antes de usar a Cameo:</p>
            <ol className="mt-2 list-inside list-decimal space-y-1.5 text-xs text-muted-foreground">
              <li>Baixe e extraia o programa local.</li>
              <li>Dê dois cliques em INICIAR_BRIDGE.bat.</li>
              <li>Deixe a janela aberta e clique em Verificar novamente.</li>
            </ol>
          </div>
          <div className="grid gap-2">
            <Button asChild size="sm" className="w-full text-xs">
              <a href="/downloads/PNP-Cameo-Bridge.zip" download>
                <Download className="shrink-0" />
                Baixar
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={onRefreshBridge}
            >
              <RefreshCw className="shrink-0" />
              Verificar novamente
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            O navegador não consegue falar com a máquina de corte sozinho, e é para isso que
            existe este programa. Ele roda no seu computador, só conversa com este site na sua
            própria máquina e recebe apenas as medidas de onde cortar. Nenhum PDF, imagem ou
            prévia sua passa por ele ou sai do seu computador.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="text-xs"
          onClick={onTest}
          disabled={busy || offline}
        >
          Testar conexão
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="text-xs"
          onClick={onReadMarks}
          disabled={busy || offline}
        >
          Ler marcas
        </Button>
      </div>

      <Button
        className="h-11 w-full font-display text-xs font-bold tracking-widest uppercase"
        onClick={onCut}
        disabled={busy || offline || !canCut}
      >
        Cortar selecionadas
      </Button>
    </div>
  );
}
