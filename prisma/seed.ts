import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed-data";

const db = new PrismaClient();

async function main(): Promise<void> {
  const result = await runSeed(db);
  console.log(`Seed done: ${result.categories} categories, ${result.cards} cards (idempotent).`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
