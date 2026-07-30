// One-time migration from the code-quality taxonomy to the engagement taxonomy.
// Run against the target environment's DB:  npx tsx prisma/migrate-to-engagement.ts
import { PrismaClient } from "@prisma/client";
import { migrateToEngagement } from "../src/lib/migrations/migrate-to-engagement";

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await migrateToEngagement(prisma);
    console.log("Migration complete:", result);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
