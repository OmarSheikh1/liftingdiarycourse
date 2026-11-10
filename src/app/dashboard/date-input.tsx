"use client";

import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";

// Thin client wrapper so changing the date navigates immediately (no submit button).
export function DateInput({ value }: { value: string }) {
  const router = useRouter();

  return (
    <Input
      type="date"
      defaultValue={value}
      className="w-fit"
      onChange={(event) => {
        if (event.target.value) {
          router.push(`/dashboard?date=${event.target.value}`);
        }
      }}
    />
  );
}
