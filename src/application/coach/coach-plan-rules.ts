// CHG-20261110-003-COACH-PLANS
// Purpose: Pure business rules for coach plans (email normalisation, plan date,
// prescription limits). No framework or persistence imports.
import { format, isValid, parse, startOfDay } from "date-fns";
import {
  isPlannableDate,
  PlanningError,
  startOfTomorrow,
} from "@/application/workouts/planning";

export { PlanningError };

export const PLAN_DATE_FORMAT = "yyyy-MM-dd";
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PLAN_NAME_LENGTH = 80;
export const MAX_NOTES_LENGTH = 280;
export const MAX_SETS = 20;
export const MAX_REPS = 100;
export const MAX_REST_SECONDS = 1800;
export const MAX_WEIGHT_KG = 1000;

export interface PrescriptionInput {
  sets: number;
  reps: number;
  /** Upper end of a rep range (e.g. 12 in "8-12"), or null for a fixed rep target. */
  repsMax: number | null;
  restSeconds: number | null;
  /** Kilograms, or null when not prescribed. */
  weight: number | null;
  notes: string | null;
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const valid =
    normalized.length > 0 &&
    normalized.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  if (!valid) throw new PlanningError("Enter a valid member email.");
  return normalized;
}

export function normalizePlanName(name: string | null): string | null {
  const trimmed = (name ?? "").trim();
  if (trimmed.length > MAX_PLAN_NAME_LENGTH) {
    throw new PlanningError(
      `Plan name must be at most ${MAX_PLAN_NAME_LENGTH} characters.`,
    );
  }
  return trimmed.length === 0 ? null : trimmed;
}

/** Parses a yyyy-MM-dd calendar day. */
export function parsePlanDate(value: string): Date {
  const parsed = parse(value, PLAN_DATE_FORMAT, new Date());
  if (!isValid(parsed)) throw new PlanningError("Invalid date.");
  return parsed;
}

/** Throws unless `value` (yyyy-MM-dd) is a day after today; returns it normalised. */
export function assertFuturePlanDate(
  value: string,
  now: Date = new Date(),
): string {
  const date = parsePlanDate(value);
  if (!isPlannableDate(date, now)) {
    throw new PlanningError("Plans can only be created for future dates.");
  }
  return format(startOfDay(date), PLAN_DATE_FORMAT);
}

/** First plan date (yyyy-MM-dd) that is still editable: tomorrow. */
export function earliestEditableDate(now: Date = new Date()): string {
  return format(startOfTomorrow(now), PLAN_DATE_FORMAT);
}

export function validatePrescription(
  input: PrescriptionInput,
): PrescriptionInput {
  const isInt = Number.isInteger;
  if (!isInt(input.sets) || input.sets < 1 || input.sets > MAX_SETS) {
    throw new PlanningError(`Sets must be between 1 and ${MAX_SETS}.`);
  }
  if (!isInt(input.reps) || input.reps < 1 || input.reps > MAX_REPS) {
    throw new PlanningError(`Reps must be between 1 and ${MAX_REPS}.`);
  }
  if (
    input.repsMax !== null &&
    (!isInt(input.repsMax) ||
      input.repsMax < input.reps ||
      input.repsMax > MAX_REPS)
  ) {
    throw new PlanningError("Max reps must be at least the reps value.");
  }
  if (
    input.restSeconds !== null &&
    (!isInt(input.restSeconds) ||
      input.restSeconds < 0 ||
      input.restSeconds > MAX_REST_SECONDS)
  ) {
    throw new PlanningError(
      `Rest must be between 0 and ${MAX_REST_SECONDS} seconds.`,
    );
  }
  if (
    input.weight !== null &&
    (!Number.isFinite(input.weight) ||
      input.weight < 0 ||
      input.weight > MAX_WEIGHT_KG)
  ) {
    throw new PlanningError(
      `Weight must be between 0 and ${MAX_WEIGHT_KG} kg.`,
    );
  }
  const notes = (input.notes ?? "").trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new PlanningError(
      `Notes must be at most ${MAX_NOTES_LENGTH} characters.`,
    );
  }
  return { ...input, notes: notes.length === 0 ? null : notes };
}
