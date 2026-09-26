const PARAMS: { label: string; value: string }[] = [
  { label: "Interface", value: "USBPRINT nativo do Windows" },
  { label: "Acesso", value: "Sessão exclusiva, leitura contínua" },
  { label: "Registration", value: "TB123,3800,5540,118,118" },
  { label: "Sensibilidade", value: "TB51,200 · TB53,20 · TB55,1" },
  { label: "Inset das marcas", value: "10 mm" },
  { label: "Espaçamento", value: "277 × 190 mm" },
  { label: "Unidades", value: "1 mm = 20 unidades da máquina" },
  { label: "Ordem dos comandos", value: "Y,X" },
  { label: "Suporte de lâmina", value: "AutoBlade, holder 1" },
];

export function ProtectedParams() {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background/50 p-3">
      <p className="text-xs text-muted-foreground">
        Estes valores foram validados na máquina e não podem ser editados.
      </p>
      <dl className="space-y-1 text-xs">
        {PARAMS.map((param) => (
          <div key={param.label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{param.label}</dt>
            <dd className="text-right font-mono">{param.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
