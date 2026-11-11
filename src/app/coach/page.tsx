// CHG-20261110-003-COACH-PLANS
// Purpose: Coach overview. Server Component: lists the plans the signed-in coach created.
import { format } from "date-fns";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  earliestEditableDate,
  parsePlanDate,
} from "@/application/coach/coach-plan-rules";
import { listCoachPlans } from "@/composition/coach";
import { DeletePlanButton } from "./delete-plan-button";
import { NewPlanDialog } from "./new-plan-dialog";

export default function CoachPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Coach</h1>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <CoachContent />
      </Suspense>
    </main>
  );
}

async function CoachContent() {
  // Defer to request time: "upcoming" depends on today's date.
  await connection();
  const plans = await listCoachPlans();
  const firstEditable = earliestEditableDate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member plans</CardTitle>
        <CardDescription>
          Plans you assigned to members by email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <NewPlanDialog />
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have not created any plans yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Exercises</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const upcoming = plan.planDate >= firstEditable;
                return (
                  <TableRow key={plan.id}>
                    <TableCell>{plan.memberEmail}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      {format(parsePlanDate(plan.planDate), "do MMM yyyy")}
                      <Badge variant={upcoming ? "secondary" : "outline"}>
                        {upcoming ? "Upcoming" : "Past"}
                      </Badge>
                    </TableCell>
                    <TableCell>{plan.name ?? "Untitled plan"}</TableCell>
                    <TableCell>{plan.exerciseCount}</TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Link
                        href={`/coach/${plan.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Open
                      </Link>
                      {upcoming && <DeletePlanButton planId={plan.id} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
