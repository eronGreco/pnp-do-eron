import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const IssueTypeSchema = z.enum([
  "deslocamento",
  "rotacao",
  "escala",
  "marcas",
  "frente-verso",
  "outro",
]);

const DiagnosticInputSchema = z.object({
  issueType: IssueTypeSchema,
  operatorNote: z.string().trim().min(12).max(1600),
  triedAdjustment: z.string().trim().max(800).optional().default(""),
  currentSettings: z
    .object({
      finishMode: z.string(),
      assemblyMode: z.string(),
      paperSize: z.string(),
      orientation: z.string(),
      cardWidthMm: z.number(),
      cardHeightMm: z.number(),
      bleedMm: z.number(),
      gapMm: z.number(),
      bleedMode: z.string(),
      gridMode: z.string(),
      gridColumns: z.number(),
      gridRows: z.number(),
      backOffsetXMm: z.number(),
      backOffsetYMm: z.number(),
      backExtraBleedMm: z.number(),
      gutterfoldGapMm: z.number(),
      cricutMarksImported: z.boolean(),
      cricutTemplateMatches: z.boolean(),
      cricutPagesDetected: z.number(),
      cricutContentConflicts: z.number(),
      cricutBleedConflicts: z.number(),
      cardsCount: z.number(),
      layoutsCount: z.number(),
    })
    .strict(),
});

export type CricutDiagnosticResult = {
  id: string | null;
  diagnosis: string;
  recommendations: string[];
  saved: boolean;
  runId: string | null;
};

const ISSUE_LABELS: Record<z.infer<typeof IssueTypeSchema>, string> = {
  deslocamento: "corte deslocado",
  rotacao: "corte girado ou torto",
  escala: "tamanho ou escala diferente",
  marcas: "leitura ou posição das marcas",
  "frente-verso": "frente e verso desencontrados",
  outro: "outro problema de alinhamento",
};

const FALLBACK_DIAGNOSIS =
  "Não consegui gerar o diagnóstico com IA agora. O relato foi guardado para análise dos testes. Enquanto isso, confira se o SVG entrou no Design Space em tamanho real, se o PDF final foi impresso em 100% de escala e se o molde de marcas foi gerado de novo depois de qualquer mudança na grade, folha ou tamanho das cartas.";

function formatSettings(settings: z.infer<typeof DiagnosticInputSchema>["currentSettings"]) {
  return [
    `Acabamento: ${settings.finishMode}`,
    `Montagem: ${settings.assemblyMode}`,
    `Folha: ${settings.paperSize} ${settings.orientation}`,
    `Carta: ${settings.cardWidthMm} x ${settings.cardHeightMm} mm`,
    `Sangria: ${settings.bleedMm} mm, modo ${settings.bleedMode}`,
    `Espaço: ${settings.gapMm} mm`,
    `Grade: ${settings.gridMode}, ${settings.gridColumns} por ${settings.gridRows}`,
    `Ajuste do verso: X ${settings.backOffsetXMm} mm, Y ${settings.backOffsetYMm} mm`,
    `Sangria do verso: ${settings.backExtraBleedMm} mm`,
    `Canaleta gutterfold: ${settings.gutterfoldGapMm} mm`,
    `Molde Cricut importado: ${settings.cricutMarksImported ? "sim" : "não"}`,
    `Molde bate com a montagem atual: ${settings.cricutTemplateMatches ? "sim" : "não"}`,
    `Páginas de marcas detectadas: ${settings.cricutPagesDetected}`,
    `Conflitos com conteúdo: ${settings.cricutContentConflicts}`,
    `Conflitos com sangria: ${settings.cricutBleedConflicts}`,
    `Cartas: ${settings.cardsCount}`,
    `Folhas calculadas: ${settings.layoutsCount}`,
  ].join("\n");
}

function extractRecommendations(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);

  const markerIndex = lines.findIndex((line) => /recomenda/i.test(line));
  const source = markerIndex >= 0 ? lines.slice(markerIndex + 1) : lines;
  return source.filter((line) => line.length > 18).slice(0, 6);
}

function safeErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const maybe = error as { responseBody?: unknown; data?: unknown; message?: unknown };
    const body = maybe.responseBody;
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body) as { message?: unknown; error?: { message?: unknown } };
        const message = parsed.message ?? parsed.error?.message;
        if (typeof message === "string" && message.trim()) return message.trim();
      } catch {
        if (body.trim()) return body.trim().slice(0, 500);
      }
    }
    const data = maybe.data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message.trim();
  }
  return "Falha ao chamar a IA.";
}

async function saveDiagnostic(
  data: z.infer<typeof DiagnosticInputSchema>,
  diagnosis: string,
  recommendations: string[],
  aiStatus: "ok" | "erro",
  aiError: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inserted, error } = await supabaseAdmin
    .from("cricut_alignment_diagnostics")
    .insert({
      operator_note: data.operatorNote,
      issue_type: data.issueType,
      current_settings: data.currentSettings,
      diagnosis,
      recommendations,
      ai_status: aiStatus,
      ai_error: aiError,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return inserted?.id ?? null;
}

export const diagnoseCricutAlignment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DiagnosticInputSchema.parse(input))
  .handler(async ({ data }): Promise<CricutDiagnosticResult> => {
    const apiKey = process.env["OPENAI_API_KEY"];
    const model = process.env["OPENAI_MODEL"];
    const baseURL = process.env["OPENAI_BASE_URL"]?.trim() || undefined;

    if (!apiKey || !model) {
      throw new Error("A IA não está configurada. Defina OPENAI_API_KEY e OPENAI_MODEL.");
    }

    let diagnosis = "";
    let recommendations: string[] = [];
    let aiStatus: "ok" | "erro" = "ok";
    let aiError: string | null = null;

    try {
      const openai = createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
      const result = streamText({
        model: openai.responses(model),
        maxRetries: 0,
        system:
          "Você ajuda operadores em testes do fluxo Cricut do PNP do Eron. Responda em português brasileiro. Não peça imagens ou PDFs. Use apenas o relato e os ajustes numéricos. Seja prático, cauteloso e não prometa correção automática.",
        prompt: `Diagnostique um problema de alinhamento da Cricut.\n\nTipo percebido: ${ISSUE_LABELS[data.issueType]}\n\nRelato do operador:\n${data.operatorNote}\n\nAjuste já tentado:\n${data.triedAdjustment || "Nenhum informado"}\n\nAjustes atuais do trabalho:\n${formatSettings(data.currentSettings)}\n\nResponda com no máximo 220 palavras usando estes blocos:\nDiagnóstico provável\nO que testar agora\nRegistro útil para corrigir o sistema\n\nNas recomendações, priorize: escala 100%, SVG em tamanho real no Design Space, molde de marcas recriado depois de mudar folha ou grade, conflitos das marcas com conteúdo, rotação do papel, quantidade de linhas e colunas, ajuste do verso apenas quando for desalinhamento da impressão e diferenças do gutterfold quando houver.`,
      });

      diagnosis = (await result.text).trim();
      recommendations = extractRecommendations(diagnosis);
      if (recommendations.length === 0) recommendations = [diagnosis.slice(0, 240)];
    } catch (error) {
      aiStatus = "erro";
      aiError = safeErrorMessage(error);
      diagnosis = `${FALLBACK_DIAGNOSIS}\n\nMensagem da IA: ${aiError}`;
      recommendations = [
        "Imprima em 100% de escala.",
        "Recrie o molde no Design Space depois de mudar folha, grade ou tamanho.",
        "Confira se o SVG manteve o tamanho real em milímetros.",
      ];
    }

    const id = await saveDiagnostic(data, diagnosis, recommendations, aiStatus, aiError);
    if (aiStatus === "erro") throw new Error(diagnosis);

    return {
      id,
      diagnosis,
      recommendations,
      saved: true,
      runId: null,
    };
  });
