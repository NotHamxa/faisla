"use client";
// Submit button for the empty dashboard's "Load sample data" form (shows progress while seeding).
import { useFormStatus } from "react-dom";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function LoadSampleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : <DatabaseZap data-icon="inline-start" />}
      {pending ? "Loading sample data…" : "Load sample data"}
    </Button>
  );
}
