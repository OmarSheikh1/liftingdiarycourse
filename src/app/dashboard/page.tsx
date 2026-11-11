import { format, isValid, parse } from "date-fns";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddExercisesDialog } from "./add-exercises-dialog";
import { DateInput } from "./date-input";
import { isPlannableDate } from "@/application/workouts/planning";
import { listAvailableExercises } from "@/composition/exercises";
import { getWorkoutsForDate } from "@/composition/workouts";
import { getAssignedPlansForDate } from "@/composition/coach";
import type { CoachPlanExerciseDto } from "@/application/coach/coach-plan-repository";

const DATE_PARAM_FORMAT = "yyyy-MM-dd";

// CHG-20261110-003-COACH-PLANS
// Purpose: One-line summary of a coach prescription, e.g. "Squat: 3 × 8-12 @ 60 kg, rest 90s".
function describePrescription(item: CoachPlanExerciseDto): string {
  const reps =
    item.repsMax !== null && item.repsMax !== item.reps
      ? `${item.reps}-${item.repsMax}`
      : String(item.reps);
  const parts = [`${item.name}: ${item.sets} × ${reps}`];
  if (item.weight !== null) parts[0] += ` @ ${item.weight} kg`;
  if (item.restSeconds !== null) parts.push(`rest ${item.restSeconds}s`);
  if (item.notes) parts.push(item.notes);
  return parts.join(", ");
}

function parseDateParam(value: string | string[] | undefined): Date {
  if (typeof value === "string") {
    const parsed = parse(value, DATE_PARAM_FORMAT, new Date());
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({
  searchParams,
}: Pick<PageProps<"/dashboard">, "searchParams">) {
  // Defer to request time: the default date is "today", which can't be prerendered.
  await connection();
  const date = parseDateParam((await searchParams).date);
  // CHG-20261110-001-PLAN-FUTURE-WORKOUT
  // Change: On future dates, load the exercise catalog and offer planning.
  // Both reads run in parallel to avoid stacking database round trips.
  const canPlan = isPlannableDate(date);
  // CHG-20261110-003-COACH-PLANS
  // Change: Also load plans a coach assigned to the viewer for this date.
  const [workouts, availableExercises, assignedPlans] = await Promise.all([
    getWorkoutsForDate(date),
    canPlan ? listAvailableExercises() : Promise.resolve([]),
    getAssignedPlansForDate(date),
  ]);
  const plannedExercises = workouts.flatMap((workout) => workout.exercises);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <DateInput value={format(date, DATE_PARAM_FORMAT)} />
        {/* CHG-20261110-003-COACH-PLANS
            Purpose: Entry point to the coach screens. */}
        <Link
          href="/coach"
          className={buttonVariants({ variant: "outline" })}
        >
          Coach plans
        </Link>
      </div>

      {/* CHG-20261110-003-COACH-PLANS
          Purpose: Read-only plans assigned to this member by a coach. */}
      {assignedPlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>From your coach</CardTitle>
            <CardDescription>
              Assigned for {format(date, "do MMM yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {assignedPlans.map((plan) => (
              <Card key={plan.id} size="sm">
                <CardHeader>
                  <CardTitle>{plan.name ?? "Untitled plan"}</CardTitle>
                  <CardDescription>From {plan.coachEmail}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {plan.exercises.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No exercises yet.
                    </p>
                  ) : (
                    plan.exercises.map((exercise) => (
                      <p key={exercise.id} className="text-sm">
                        {exercise.order}. {describePrescription(exercise)}
                      </p>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Workouts</CardTitle>
          <CardDescription>
            {canPlan ? "Planned for" : "Logged on"} {format(date, "do MMM yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {canPlan && (
            <AddExercisesDialog
              key={format(date, DATE_PARAM_FORMAT)}
              workoutName={workouts[0]?.name ?? null}
              date={format(date, DATE_PARAM_FORMAT)}
              dateLabel={format(date, "do MMM yyyy")}
              exercises={availableExercises}
              planned={plannedExercises}
            />
          )}
          {workouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {canPlan
                ? "No exercises planned for this date."
                : "No workouts logged for this date."}
            </p>
          ) : (
            workouts.map((workout) => (
              <Card key={workout.id} size="sm">
                <CardHeader>
                  <CardTitle>{workout.name ?? "Untitled workout"}</CardTitle>
                  <CardDescription>
                    {workout.exerciseCount} exercises
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {canPlan ? (
                    workout.exercises.map((exercise) => (
                      <Badge key={exercise.id} variant="secondary">
                        {exercise.order}. {exercise.name}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">{workout.setCount} sets</Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
