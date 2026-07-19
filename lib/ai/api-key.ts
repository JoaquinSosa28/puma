// Resolves which Anthropic key to use for a given user. Real (mongodb) accounts
// MUST bring their own key (stored encrypted in settings) — the operator never
// pays for hosted users' tokens. The shared ANTHROPIC_API_KEY env var is used
// ONLY in memory mode (local dev / single-user self-host demo).
import "server-only";
import { getAiApiKeyEnc } from "@/lib/db/settings";
import { decryptSecret } from "@/lib/crypto";

export const NO_API_KEY_MESSAGE =
  "Add your own Anthropic API key in Settings → Assistant to use Plan and Ask.";

export async function resolveAnthropicKey(userId: string): Promise<string | null> {
  const enc = await getAiApiKeyEnc(userId);
  if (enc) {
    const decrypted = decryptSecret(enc);
    // A key that won't decrypt (secret rotated / tampered) counts as "not set".
    return decrypted ?? null;
  }
  // No per-user key. The shared env key is a local-dev/demo convenience only —
  // never let real accounts spend the operator's tokens.
  if (process.env.DATA_SOURCE !== "mongodb") {
    return process.env.ANTHROPIC_API_KEY ?? null;
  }
  return null;
}

/** Whether an AI call for this user would have a usable key (no secret exposed). */
export async function hasResolvableAnthropicKey(userId: string): Promise<boolean> {
  return (await resolveAnthropicKey(userId)) !== null;
}
