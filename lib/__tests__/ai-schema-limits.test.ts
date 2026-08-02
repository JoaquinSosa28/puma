// Anthropic's structured-output grammar rejects schemas past hard limits:
// 24 optional parameters, 16 union-typed parameters (nullable counts). Both
// failures happen at request time with a working API key — which is exactly
// where a test suite can't see them unless we count the compiled schema here.
import { describe, it, expect } from "vitest";
import * as z from "zod/v4";
import { assistantResponseSchema } from "@/lib/ai/assistant-schema";

function count(schema: z.ZodType): { optionals: number; unions: number } {
  const json = z.toJSONSchema(schema, { io: "input" });
  let optionals = 0;
  let unions = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.properties && typeof n.properties === "object") {
      const required = new Set((n.required as string[]) ?? []);
      for (const [key, child] of Object.entries(
        n.properties as Record<string, unknown>
      )) {
        if (!required.has(key)) optionals++;
        const c = child as Record<string, unknown>;
        if (c && (c.anyOf || c.oneOf || Array.isArray(c.type))) unions++;
      }
    }
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(walk);
      else walk(v);
    }
  };
  walk(json);
  return { optionals, unions };
}

describe("the assistant schema vs Anthropic's grammar limits", () => {
  it("stays under 24 optional parameters", () => {
    expect(count(assistantResponseSchema).optionals).toBeLessThanOrEqual(24);
  });

  it("stays under 16 union-typed parameters", () => {
    expect(count(assistantResponseSchema).unions).toBeLessThanOrEqual(16);
  });
});
