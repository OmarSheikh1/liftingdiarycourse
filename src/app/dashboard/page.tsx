import { format, isValid, parse } from "date-fns";
import { connection } from "next/server";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateInput } from "./date-input";
import { getWorkoutsForDate } from "@/composition/workouts";

const DATE_PARAM_FORMAT = "yyyy-MM-dd";

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
  const workouts = await getWorkoutsForDate(date);

  return (
    <>
      <DateInput value={format(date, DATE_PARAM_FORMAT)} />

      <Card>
        <CardHeader>
          <CardTitle>Workouts</CardTitle>
          <CardDescription>
            Logged on {format(date, "do MMM yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {workouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workouts logged for this date.
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
                <CardContent>
                  <Badge variant="secondary">{workout.setCount} sets</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
