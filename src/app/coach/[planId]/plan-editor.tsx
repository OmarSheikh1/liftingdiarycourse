"use client";

// CHG-20261110-003-COACH-PLANS
// Purpose: Editor (shadcn components only) for a coach plan: prescribed exercises with
// sets, reps (range), rest, weight and notes. Data arrives via props; mutations use
// Server Actions. Adds and removals are optimistic because database round trips are slow.
import { useOptimistic, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ExerciseDto } from "@/application/exercises/exercise-repository";
import type {
  CoachPlanDto,
  CoachPlanExerciseDto,
} from "@/application/coach/coach-plan-repository";
import {
  addPlanExerciseAction,
  createAndAddPlanExerciseAction,
  removePlanExerciseAction,
  renameCoachPlanAction,
  updatePlanExerciseAction,
  type ActionResult,
} from "../actions";

type OptimisticChange =
  | { type: "add"; item: Omit<CoachPlanExerciseDto, "id" | "order"> }
  | { type: "remove"; id: number };

/** String form state of one prescription (inputs are text until submitted). */
interface Draft {
  sets: string;
  reps: string;
  repsMax: string;
  rest: string;
  weight: string;
  notes: string;
}

const EMPTY_DRAFT: Draft = {
  sets: "3",
  reps: "10",
  repsMax: "",
  rest: "",
  weight: "",
  notes: "",
};

function draftOf(item: CoachPlanExerciseDto): Draft {
  return {
    sets: String(item.sets),
    reps: String(item.reps),
    repsMax: item.repsMax === null ? "" : String(item.repsMax),
    rest: item.restSeconds === null ? "" : String(item.restSeconds),
    weight: item.weight === null ? "" : String(item.weight),
    notes: item.notes ?? "",
  };
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

/** Converts a draft to action input, or null when sets/reps are not numbers. */
function prescriptionOf(draft: Draft) {
  const sets = Number(draft.sets);
  const reps = Number(draft.reps);
  if (!Number.isFinite(sets) || !Number.isFinite(reps)) return null;
  return {
    sets,
    reps,
    repsMax: optionalNumber(draft.repsMax),
    restSeconds: optionalNumber(draft.rest),
    weight: optionalNumber(draft.weight),
    notes: draft.notes.trim() === "" ? null : draft.notes.trim(),
  };
}

interface PlanEditorProps {
  plan: CoachPlanDto;
  exercises: ExerciseDto[];
  /** Plan date formatted for display. */
  dateLabel: string;
  /** False once the plan date has passed: everything is read-only. */
  editable: boolean;
}

export function PlanEditor({
  plan,
  exercises,
  dateLabel,
  editable,
}: PlanEditorProps) {
  const [nameDraft, setNameDraft] = useState(plan.name ?? "");
  const [rowDrafts, setRowDrafts] = useState<Record<number, Draft>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [items, applyChange] = useOptimistic(
    plan.exercises,
    (state: CoachPlanExerciseDto[], change: OptimisticChange) =>
      change.type === "add"
        ? [
            ...state,
            {
              ...change.item,
              // Temporary negative id until the server data replaces it.
              id: -(state.length + 1),
              order: (state.at(-1)?.order ?? 0) + 1,
            },
          ]
        : state.filter((item) => item.id !== change.id),
  );

  function run(
    change: OptimisticChange | null,
    action: () => Promise<ActionResult>,
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      if (change) applyChange(change);
      const result = await action();
      if (result.ok) onSuccess?.();
      else setError(result.error);
    });
  }

  function setRowField(item: CoachPlanExerciseDto, field: keyof Draft, value: string) {
    setRowDrafts((drafts) => ({
      ...drafts,
      [item.id]: { ...(drafts[item.id] ?? draftOf(item)), [field]: value },
    }));
  }

  function saveRow(item: CoachPlanExerciseDto) {
    const draft = rowDrafts[item.id];
    if (!draft || item.id < 0) return;
    const prescription = prescriptionOf(draft);
    if (!prescription) {
      setError("Sets and reps must be numbers.");
      return;
    }
    run(
      null,
      () => updatePlanExerciseAction({ planExerciseId: item.id, ...prescription }),
      () =>
        setRowDrafts((drafts) =>
          Object.fromEntries(
            Object.entries(drafts).filter(([id]) => Number(id) !== item.id),
          ),
        ),
    );
  }

  function addExercise() {
    const prescription = prescriptionOf(newDraft);
    if (!prescription) {
      setError("Sets and reps must be numbers.");
      return;
    }
    const exercise = exercises.find((e) => String(e.id) === selected);
    const custom = customName.trim();
    if (!exercise && custom === "") return;

    const name = exercise?.name ?? custom;
    setSelected(null);
    setCustomName("");
    run(
      {
        type: "add",
        item: {
          exerciseId: exercise?.id ?? 0,
          name,
          sets: prescription.sets,
          reps: prescription.reps,
          repsMax: prescription.repsMax,
          restSeconds: prescription.restSeconds,
          weight: prescription.weight,
          notes: prescription.notes,
        },
      },
      () =>
        exercise
          ? addPlanExerciseAction({
              planId: plan.id,
              exerciseId: exercise.id,
              ...prescription,
            })
          : createAndAddPlanExerciseAction({
              planId: plan.id,
              exerciseName: custom,
              ...prescription,
            }),
    );
  }

  const numberInput = "w-20";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{plan.name ?? "Untitled plan"}</CardTitle>
        <CardDescription>
          {plan.memberEmail} · {dateLabel}{" "}
          {!editable && <Badge variant="outline">Past: read-only</Badge>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {editable && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input
              id="plan-name"
              value={nameDraft}
              maxLength={80}
              placeholder="e.g. Leg day"
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => {
                const name = nameDraft.trim();
                setNameDraft(name);
                if (name === (plan.name ?? "")) return;
                run(null, () => renameCoachPlanAction({ planId: plan.id, name }));
              }}
            />
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No exercises in this plan yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Exercise</TableHead>
                <TableHead>Sets</TableHead>
                <TableHead>Reps</TableHead>
                <TableHead>Max reps</TableHead>
                <TableHead>Rest (s)</TableHead>
                <TableHead>Weight (kg)</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const draft = rowDrafts[item.id] ?? draftOf(item);
                const locked = !editable || item.id < 0;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    {(
                      [
                        ["sets", "Sets"],
                        ["reps", "Reps"],
                        ["repsMax", "Max reps"],
                        ["rest", "Rest seconds"],
                        ["weight", "Weight kg"],
                      ] as const
                    ).map(([field, label]) => (
                      <TableCell key={field}>
                        <Input
                          type="number"
                          aria-label={`${label} for ${item.name}`}
                          className={numberInput}
                          min={0}
                          step={field === "weight" ? 0.5 : 1}
                          disabled={locked}
                          value={draft[field]}
                          onChange={(event) =>
                            setRowField(item, field, event.target.value)
                          }
                          onBlur={() => saveRow(item)}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Input
                        aria-label={`Notes for ${item.name}`}
                        maxLength={280}
                        disabled={locked}
                        value={draft.notes}
                        onChange={(event) =>
                          setRowField(item, "notes", event.target.value)
                        }
                        onBlur={() => saveRow(item)}
                      />
                    </TableCell>
                    <TableCell>
                      {editable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={item.id < 0}
                          onClick={() =>
                            run({ type: "remove", id: item.id }, () =>
                              removePlanExerciseAction({
                                planExerciseId: item.id,
                              }),
                            )
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {editable && (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <h2 className="text-sm font-medium">Add exercise</h2>
            <div className="flex flex-wrap gap-2">
              <Select
                value={selected}
                onValueChange={setSelected}
                items={exercises.map((e) => ({
                  value: String(e.id),
                  label: e.name,
                }))}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select an exercise" />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((exercise) => (
                    <SelectItem key={exercise.id} value={String(exercise.id)}>
                      {exercise.name}
                      {exercise.isCustom && (
                        <Badge variant="secondary">Custom</Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Or create a custom exercise"
                className="w-64"
                value={customName}
                maxLength={80}
                placeholder="Or create a custom exercise"
                onChange={(event) => setCustomName(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {(
                [
                  ["sets", "Sets"],
                  ["reps", "Reps"],
                  ["repsMax", "Max reps"],
                  ["rest", "Rest (s)"],
                  ["weight", "Weight (kg)"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="flex flex-col gap-1">
                  <Label htmlFor={`new-${field}`}>{label}</Label>
                  <Input
                    id={`new-${field}`}
                    type="number"
                    className={numberInput}
                    min={0}
                    step={field === "weight" ? 0.5 : 1}
                    value={newDraft[field]}
                    onChange={(event) =>
                      setNewDraft((d) => ({ ...d, [field]: event.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-notes">Notes</Label>
              <Textarea
                id="new-notes"
                maxLength={280}
                value={newDraft.notes}
                onChange={(event) =>
                  setNewDraft((d) => ({ ...d, notes: event.target.value }))
                }
              />
            </div>
            <Button
              className="w-fit"
              disabled={selected === null && customName.trim() === ""}
              onClick={addExercise}
            >
              Add
            </Button>
          </div>
        )}

        {isPending && <p className="text-sm text-muted-foreground">Saving…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
