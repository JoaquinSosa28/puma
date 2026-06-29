export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DATA_SOURCE !== "mongodb") return;

  const { warmMongoConnection } = await import("@/lib/mongodb");
  await warmMongoConnection().catch(() => {
    /* Pages will surface a friendly DB error if Atlas is unreachable. */
  });
}
