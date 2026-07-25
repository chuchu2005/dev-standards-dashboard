// tests/globalSetup.ts
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { execSync } from "node:child_process";

// Prisma's MongoDB connector requires a replica set (transactions, change streams).
// MongoMemoryServer defaults to a standalone mongod; MongoMemoryReplSet starts a
// 1-node replica set and runs rs.initiate() automatically.
let mongo: MongoMemoryReplSet;

export async function setup() {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // Insert a named DB into the URI. The standalone form is `mongodb://host:port/`,
  // but the replset form is `mongodb://host:port/?replicaSet=...` — appending "test"
  // verbatim would corrupt the query string, so use the URL API.
  const url = new URL(mongo.getUri());
  url.pathname = "/test";
  process.env.DATABASE_URL = url.toString();

  // Apply schema + run seed against the in-memory DB.
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
  execSync("npm run seed", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
}

export async function teardown() {
  if (mongo) await mongo.stop();
}
