import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { states } from "@/lib/content";

/**
 * The form reads `?next=` with useSearchParams, which Next cannot prerender
 * without a Suspense boundary — the build fails outright otherwise. Server
 * shell here, client form inside.
 */
export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
