import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
      <div className="clay flex w-full max-w-md flex-col items-center px-8 py-12">
        <Compass className="h-7 w-7 text-accent-text" aria-hidden />
        <p className="mt-4 font-display text-lg font-600 text-ink">
          Page not found
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          That page doesn&apos;t exist, or has moved.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="btn-accent">
            Back home
          </Link>
          <Link href="/jobs" className="btn-secondary">
            Browse jobs
          </Link>
        </div>
      </div>
    </div>
  );
}
