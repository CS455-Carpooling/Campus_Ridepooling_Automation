'use client';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { routes } from '@/lib/routes';

/** The rider search (CS455-53): a GET form, so a search has its own URL. */
export function RiderSearchForm({ query }: { query: string }) {
  return (
    <form
      method="get"
      action={routes.adminRiders}
      role="search"
      aria-label="Find a rider"
      className="flex flex-wrap items-end gap-3"
    >
      <Field
        label="Name, email or roll number"
        hint="At least 2 characters."
        name="q"
        type="search"
        defaultValue={query}
        minLength={2}
        className="min-w-0 flex-1 sm:max-w-md"
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}
