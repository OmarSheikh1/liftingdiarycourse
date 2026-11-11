// CHG-20261110-003-COACH-PLANS
// Purpose: Plan editor page. Server Component: loads the coach's own plan (notFound when
// not owned) and the exercise catalog in parallel.
import { format } from "date-fns";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  earliestEditableDate,
  parsePlanDate,
} from "@/application/coach/coach-plan-rules";
import { getCoachPlan } from "@/composition/coach";
import { listAvailableExercises } from "@/composition/exercises";
import { PlanEditor } from "./plan-editor";

export default function CoachPlanPage({
  params,
}: PageProps<"/coach/[planId]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <Link
        href="/coach"
        className={buttonVariants({ variant: "ghost", size: "sm" }) + " w-fit"}
      >
        ← All plans
      </Link>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <PlanContent params={params} />
      </Suspense>
    </main>
  );
}

async function PlanContent({
  params,
}: Pick<PageProps<"/coach/[planId]">, "params">) {
  await connection();
  const planId = Number((await params).planId);
  if (!Number.isInteger(planId) || planId <= 0) notFound();

  const [plan, exercises] = await Promise.all([
    getCoachPlan(planId),
    listAvailableExercises(),
  ]);
  if (!plan) notFound();

  return (
    <PlanEditor
      plan={plan}
      exercises={exercises}
      dateLabel={format(parsePlanDate(plan.planDate), "do MMM yyyy")}
      editable={plan.planDate >= earliestEditableDate()}
    />
  );
}
