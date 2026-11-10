// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Seeds the starter built-in exercises (userId NULL). Safe to re-run.
// Usage: npm run db:seed
import "dotenv/config";

const STARTER_EXERCISES = [
  "Squat",
  "Bench Press",
  "Deadlift",
  "Overhead Press",
  "Barbell Row",
  "Pull-up",
];

async function main() {
  // Imported after dotenv so DATABASE_URL is set when the connection is created.
  const { db } = await import("./db");
  const { exercises } = await import("./schema");

  await db
    .insert(exercises)
    .values(STARTER_EXERCISES.map((name) => ({ name })))
    .onConflictDoNothing();

  console.log(`Seeded ${STARTER_EXERCISES.length} built-in exercises.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
