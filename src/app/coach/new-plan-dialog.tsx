"use client";

// CHG-20261110-003-COACH-PLANS
// Purpose: Dialog (shadcn components only) to create a plan for a member email on a
// future date, then open the plan editor.
import { addDays, format, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createCoachPlanAction } from "./actions";

export function NewPlanDialog() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Plans can only be created for days after today.
  const tomorrow = addDays(startOfDay(new Date()), 1);

  function submit() {
    if (!date) return;
    setError(null);
    startTransition(async () => {
      const result = await createCoachPlanAction({
        memberEmail: email,
        date: format(date, "yyyy-MM-dd"),
        name,
      });
      if (result.ok) {
        router.push(`/coach/${result.planId}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button className="w-fit" />}>
        New plan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New member plan</DialogTitle>
          <DialogDescription>
            The member sees it on their dashboard when they sign in with this
            email.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="member-email">Member email</Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            maxLength={254}
            placeholder="member@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" className="w-fit" />}>
              {date ? format(date, "do MMM yyyy") : "Pick a future date"}
            </PopoverTrigger>
            <PopoverContent className="w-auto">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={{ before: tomorrow }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="plan-name">Plan name (optional)</Label>
          <Input
            id="plan-name"
            value={name}
            maxLength={80}
            placeholder="e.g. Leg day"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          disabled={isPending || email.trim().length === 0 || !date}
          onClick={submit}
        >
          {isPending ? "Creating…" : "Create and add exercises"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
