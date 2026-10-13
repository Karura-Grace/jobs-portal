import { Suspense } from "react";
import { SignUpForm } from "@/components/signup-form";
import { states } from "@/lib/content";

/** Same Suspense requirement as login — the form reads ?next=. */
export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-6 py-20">
          <div className="clay p-8">
            <p className="text-sm text-muted">{states.loading}</p>
          </div>
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
