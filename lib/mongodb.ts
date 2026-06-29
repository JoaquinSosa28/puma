// Phase 2: MongoDB Atlas connection via the official driver.
// Set DATA_SOURCE=mongodb and configure MONGODB_URI + MONGODB_DB.
//
// The driver is imported dynamically so the memory demo never loads it
// (and never requires the `mongodb` package to be installed at runtime).
// Only `import type` is used at module scope, which erases to nothing.

// Hard boundary: importing this (or anything that reaches it) from a Client
// Component is a build error, so the driver can never leak into the browser bundle.
import "server-only";
import type { Db, MongoClient } from "mongodb";

const globalForMongo = globalThis as unknown as {
  __pumaMongoClient?: Promise<MongoClient>;
};

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Configure it in .env.local for DATA_SOURCE=mongodb."
    );
  }
  // Dynamic import keeps the driver out of the memory-mode bundle/graph.
  return import("mongodb").then(({ MongoClient }) => {
    const client = new MongoClient(uri);
    return client.connect();
  });
}

/** Returns a connected Db, caching the client across hot reloads / requests. */
export async function getDb(): Promise<Db> {
  if (process.env.DATA_SOURCE !== "mongodb") {
    throw new Error(
      "getDb() called but DATA_SOURCE !== 'mongodb'. Use DATA_SOURCE=memory for the demo."
    );
  }
  if (!globalForMongo.__pumaMongoClient) {
    globalForMongo.__pumaMongoClient = connect();
  }
  const client = await globalForMongo.__pumaMongoClient;
  return client.db(process.env.MONGODB_DB ?? "puma");
}
