import { initializeDatabase, type DatabaseInitResult } from "./database";
import {
  seedDefaultBusinessAndStore,
  type SeedResult,
} from "./seed";

export type DatabaseTestResult = DatabaseInitResult & {
  seed?: SeedResult;
};

export async function runDatabaseTest(): Promise<DatabaseTestResult> {
  const initResult = await initializeDatabase();

  if (!initResult.success) {
    console.log("DATABASE TEST RESULT: - databaseTest.ts:15", initResult);
    return initResult;
  }

  const seedResult = await seedDefaultBusinessAndStore();

  const finalResult: DatabaseTestResult = {
    ...initResult,
    success: initResult.success && seedResult.success,
    message: seedResult.success
      ? `${initResult.message} ${seedResult.message}`
      : seedResult.message,
    error: seedResult.error,
    seed: seedResult,
  };

  console.log("DATABASE TEST RESULT: - databaseTest.ts:31", finalResult);

  return finalResult;
}