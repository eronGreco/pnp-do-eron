import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_TOPICS, helpTopic } from "@/help/helpTopics";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("catálogo de ajuda", () => {
  it("todo assunto tem título e frase de abertura", () => {
    for (const [id, topic] of Object.entries(HELP_TOPICS)) {
      expect(topic.title.length, id).toBeGreaterThan(3);
      expect(topic.lead.length, id).toBeGreaterThan(10);
      expect(topic.howTo.length, id).toBeGreaterThan(0);
    }
  });

  it("nenhum texto de ajuda usa travessão", () => {
    expect(JSON.stringify(HELP_TOPICS)).not.toContain("—");
  });

  it("todo id usado nos painéis existe no catálogo", () => {
    const files = walk(join(process.cwd(), "src", "components")).filter((f) => f.endsWith(".tsx"));
    const used = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/topic="([a-z0-9-]+)"/g)) used.add(match[1]!);
      for (const match of source.matchAll(/help="([a-z0-9-]+)"/g)) used.add(match[1]!);
    }
    expect(used.size).toBeGreaterThan(10);
    for (const id of used) {
      expect(HELP_TOPICS, id).toHaveProperty(id);
      expect(helpTopic(id as keyof typeof HELP_TOPICS).title).toBeTruthy();
    }
  });
});
