/**
 * Quick MongoDB health check — connection time, ping, and sample reads.
 *   npx tsx scripts/db-bench.ts
 */
import { MongoClient } from "mongodb";
import { loadScriptEnv } from "./_env";

loadScriptEnv();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "puma";

function ms(start: number) {
  return `${(performance.now() - start).toFixed(0)}ms`;
}

async function main() {
  if (!uri) {
    console.error("MONGODB_URI is not set (.env.local)");
    process.exit(1);
  }

  const host = uri.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
  console.log(`\nMongoDB bench — ${host}`);
  console.log(`Database: ${dbName}\n`);

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
  });

  const connectStart = performance.now();
  try {
    await client.connect();
    console.log(`✓ connect()           ${ms(connectStart)}`);
  } catch (err) {
    console.error(`✗ connect() failed after ${ms(connectStart)}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const db = client.db(dbName);

  const pingStart = performance.now();
  const ping = await db.command({ ping: 1 });
  console.log(`✓ ping                ${ms(pingStart)}  (ok: ${ping.ok})`);

  const collections = [
    "users",
    "settings",
    "tags",
    "tasks",
    "habits",
    "habitEntries",
    "notes",
    "goals",
    "projects",
    "agenda",
  ] as const;

  console.log("\nCollection reads (find → toArray):");
  const readTimes: number[] = [];

  for (const name of collections) {
    const start = performance.now();
    try {
      const docs = await db.collection(name).find({}).limit(500).toArray();
      const elapsed = performance.now() - start;
      readTimes.push(elapsed);
      console.log(`  ${name.padEnd(14)} ${ms(start).padStart(6)}  (${docs.length} docs)`);
    } catch (err) {
      console.log(`  ${name.padEnd(14)}  ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  const parallelStart = performance.now();
  await Promise.all(
    collections.map((name) => db.collection(name).find({}).limit(500).toArray())
  );
  console.log(`\n✓ parallel (10 cols)  ${ms(parallelStart)}`);

  const coldStart = performance.now();
  const client2 = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
  });
  await client2.connect();
  await client2.db(dbName).command({ ping: 1 });
  await client2.close();
  console.log(`✓ 2nd cold connect    ${ms(coldStart)}  (simulates reconnect)`);

  const total = readTimes.reduce((a, b) => a + b, 0);
  const max = Math.max(...readTimes);
  console.log("\n--- Summary ---");
  console.log(`Sequential reads total: ${total.toFixed(0)}ms`);
  console.log(`Slowest collection:     ${max.toFixed(0)}ms`);
  if (performance.now() - connectStart > 3000) {
    console.log("\n⚠ Connect took >3s — likely Atlas network, SSL, IP allowlist, or cold cluster.");
  } else if (max > 500) {
    console.log("\n⚠ A collection read took >500ms — check indexes or doc sizes.");
  } else {
    console.log("\n✓ DB looks healthy from this machine.");
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
