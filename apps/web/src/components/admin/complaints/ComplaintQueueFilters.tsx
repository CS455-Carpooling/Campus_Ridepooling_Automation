'use client';

import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import type { QueueFilters } from '@/lib/admin-complaint-queries';
import { COMPLAINT_CATEGORIES, complaintCategoryLabels } from '@/lib/complaint-rules';
import { routes } from '@/lib/routes';

/**
 * The complaint queue's filters (CS455-53): a plain GET form, so a filtered queue has its own
 * URL that can be shared or bookmarked, and works without JavaScript.
 */
export function ComplaintQueueFilters({ filters }: { filters: QueueFilters }) {
  return (
    <form
      method="get"
      action={routes.adminComplaints}
      aria-label="Filter complaints"
      className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <SelectField label="Status" name="status" defaultValue={filters.status}>
        <option value="open">Open (submitted or under review)</option>
        <option value="resolved">Resolved</option>
        <option value="all">All</option>
      </SelectField>
      <SelectField label="Category" name="category" defaultValue={filters.category}>
        <option value="all">All categories</option>
        {COMPLAINT_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {complaintCategoryLabels[category]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Came from" name="source" defaultValue={filters.source}>
        <option value="all">All sources</option>
        <option value="form">Complaint form</option>
        <option value="chat_report">Chat reports</option>
        <option value="payment_dispute">Payment disputes</option>
      </SelectField>
      <Button type="submit" variant="secondary">
        Show
      </Button>
    </form>
  );
}
