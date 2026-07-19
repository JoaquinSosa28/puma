export async function register() {
  // Block form (not early-return) so the edge compile can dead-code-eliminate
  // the node-only imports — otherwise webpack tries to bundle mongodb for edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast on misconfiguration — a clear boot error beats a mid-request crash.
    const { validateEnv } = await import("@/lib/env");
    validateEnv();

    if (process.env.DATA_SOURCE === "mongodb") {
      const { warmMongoConnection } = await import("@/lib/mongodb");
      await warmMongoConnection().catch(() => {
        /* Pages will surface a friendly DB error if Atlas is unreachable. */
      });
    }
  }
}
