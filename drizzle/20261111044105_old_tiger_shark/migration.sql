CREATE TABLE "coach_plan_exercises" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coach_plan_exercises_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"coach_plan_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"order" integer NOT NULL,
	"sets" integer NOT NULL,
	"reps" integer NOT NULL,
	"reps_max" integer,
	"rest_seconds" integer,
	"weight" numeric(7,2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_plan_exercises_sets_positive" CHECK ("sets" > 0),
	CONSTRAINT "coach_plan_exercises_reps_positive" CHECK ("reps" > 0),
	CONSTRAINT "coach_plan_exercises_reps_max_gte" CHECK ("reps_max" is null or "reps_max" >= "reps"),
	CONSTRAINT "coach_plan_exercises_rest_range" CHECK ("rest_seconds" is null or ("rest_seconds" >= 0 and "rest_seconds" <= 1800)),
	CONSTRAINT "coach_plan_exercises_weight_nonneg" CHECK ("weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "coach_plans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coach_plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"coach_user_id" text NOT NULL,
	"coach_email" text NOT NULL,
	"member_email" text NOT NULL,
	"plan_date" date NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "coach_plan_exercises_plan_order_uq" ON "coach_plan_exercises" ("coach_plan_id","order");--> statement-breakpoint
CREATE INDEX "coach_plan_exercises_exercise_idx" ON "coach_plan_exercises" ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_plans_coach_member_date_uq" ON "coach_plans" ("coach_user_id","member_email","plan_date");--> statement-breakpoint
CREATE INDEX "coach_plans_member_date_idx" ON "coach_plans" ("member_email","plan_date");--> statement-breakpoint
CREATE INDEX "coach_plans_coach_date_idx" ON "coach_plans" ("coach_user_id","plan_date");--> statement-breakpoint
ALTER TABLE "coach_plan_exercises" ADD CONSTRAINT "coach_plan_exercises_coach_plan_id_coach_plans_id_fkey" FOREIGN KEY ("coach_plan_id") REFERENCES "coach_plans"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "coach_plan_exercises" ADD CONSTRAINT "coach_plan_exercises_exercise_id_exercises_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT;