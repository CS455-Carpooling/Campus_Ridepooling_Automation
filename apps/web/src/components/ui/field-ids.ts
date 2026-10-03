import { useId } from 'react';

/**
 * Ids that tie a form control to its hint and error message. The control
 * gets aria-describedby={describedBy}; the hint and error get hintId and errorId.
 */
export function useFieldIds(id: string | undefined, hint?: string, error?: string) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { controlId, hintId, errorId, describedBy };
}
