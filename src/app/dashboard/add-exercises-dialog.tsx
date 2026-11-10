"use client";

// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Dialog (shadcn components only) to add/remove exercises on a future date.
// Data arrives via props from the Server Component; mutations use Server Actions.
import { useOptimistic, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExerciseDto } from "@/application/exercises/exercise-repository";
import type { PlannedExerciseDto } from "@/application/workouts/workout-repository";
import {
  addExerciseAction,
  createAndAddExerciseAction,
  removeExerciseAction,
  renameWorkoutAction,
  type ActionResult,
} from "./actions";

// Optimistic updates keep the dialog instant: the list changes immediately while the
// (slow) server round trips happen in the background. Controls are never locked, so
// several exercises can be added in a row; Server Actions are dispatched in order.
type OptimisticChange =
  | { type: "add"; name: string }
  | { type: "remove"; id: number };

interface AddExercisesDialogProps {
  /** Selected date as yyyy-MM-dd. */
  date: string;
  /** Selected date formatted for display. */
  dateLabel: string;
  exercises: ExerciseDto[];
  planned: PlannedExerciseDto[];
  /** Current workout name for this date, if any. */
  workoutName: string | null;
}

export function AddExercisesDialog({
  date,
  dateLabel,
  exercises,
  planned,
  workoutName,
}: AddExercisesDialogProps) {
  // CHG-20261110-002-WORKOUT-NAME
  // Purpose: Editable workout name, saved explicitly with the "Save name" button.
  const [nameDraft, setNameDraft] = useState(workoutName ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [items, applyChange] = useOptimistic(
    planned,
    (state: PlannedExerciseDto[], change: OptimisticChange) =>
      change.type === "add"
        ? [
            ...state,
            {
              // Temporary negative id until the server data replaces it.
              id: -(state.length + 1),
              exerciseId: 0,
              name: change.name,
              order: (state.at(-1)?.order ?? 0) + 1,
            },
          ]
        : state.filter((item) => item.id !== change.id),
  );

  function submit(change: OptimisticChange, action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      applyChange(change);
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button className="w-fit" />}>
        Add exercises
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan workout</DialogTitle>
          <DialogDescription>Exercises for {dateLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="workout-name">Workout name</Label>
          <div className="flex gap-2">
            <Input
              id="workout-name"
              value={nameDraft}
              maxLength={80}
              placeholder="e.g. Push day"
              onChange={(event) => setNameDraft(event.target.value)}
            />
            <Button
              variant="outline"
              disabled={nameDraft.trim() === (workoutName ?? "")}
              onClick={() => {
                const name = nameDraft.trim();
                setNameDraft(name);
                setError(null);
                startTransition(async () => {
                  const result = await renameWorkoutAction({ date, name });
                  if (!result.ok) setError(result.error);
                });
              }}
            >
              Save name
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No exercises planned yet.
            </p>
          ) : (
            items.map((exercise, index) => (
              <div
                key={exercise.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">
                  {index + 1}. {exercise.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={exercise.id < 0}
                  onClick={() =>
                    submit({ type: "remove", id: exercise.id }, () =>
                      removeExerciseAction({ workoutExerciseId: exercise.id }),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Choose an exercise</Label>
          <div className="flex gap-2">
            <Select
              value={selected}
              onValueChange={setSelected}
              items={exercises.map((e) => ({
                value: String(e.id),
                label: e.name,
              }))}
            >
              <SelectTrigger className="flex-1">
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
            <Button
              disabled={selected === null}
              onClick={() => {
                const exercise = exercises.find((e) => String(e.id) === selected);
                if (!exercise) return;
                setSelected(null);
                submit({ type: "add", name: exercise.name }, () =>
                  addExerciseAction({ date, exerciseId: exercise.id }),
                );
              }}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="custom-exercise">Or create a custom exercise</Label>
          <div className="flex gap-2">
            <Input
              id="custom-exercise"
              value={newName}
              maxLength={80}
              placeholder="e.g. Romanian Deadlift"
              onChange={(event) => setNewName(event.target.value)}
            />
            <Button
              variant="outline"
              disabled={newName.trim().length === 0}
              onClick={() => {
                const name = newName.trim();
                setNewName("");
                submit({ type: "add", name }, () =>
                  createAndAddExerciseAction({ date, name }),
                );
              }}
            >
              Create &amp; add
            </Button>
          </div>
        </div>

        {isPending && (
          <p className="text-sm text-muted-foreground">Saving…</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
