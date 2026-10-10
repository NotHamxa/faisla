// MongoDB connection (server only). Local Mongo in development, Atlas in production via MONGODB_URI.
import "server-only";
import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB ?? "faisla";

// Reuse one client across hot reloads and serverless invocations.
const globalForMongo = globalThis as unknown as { faislaMongo?: Promise<MongoClient>; faislaIndexes?: Promise<void> };

function clientPromise(): Promise<MongoClient> {
  globalForMongo.faislaMongo ??= new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
  return globalForMongo.faislaMongo;
}

export async function getDb(): Promise<Db> {
  const db = (await clientPromise()).db(dbName);
  globalForMongo.faislaIndexes ??= ensureIndexes(db);
  await globalForMongo.faislaIndexes;
  return db;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("decisions").createIndex({ companyId: 1, updatedAt: -1 }),
  ]);
}
