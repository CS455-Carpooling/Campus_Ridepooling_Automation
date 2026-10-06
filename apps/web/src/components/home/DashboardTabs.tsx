import type { KeyboardEvent } from 'react';

export function DashboardTabs({
  current,
  onChange,
}: {
  current: 'upcoming' | 'history';
  onChange: (tab: 'upcoming' | 'history') => void;
}) {
  const selectTab = (tab: 'upcoming' | 'history') => {
    onChange(tab);
    document.getElementById(`${tab}-tab`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectTab(current === 'upcoming' ? 'history' : 'upcoming');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectTab(current === 'history' ? 'upcoming' : 'history');
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectTab('upcoming');
    } else if (event.key === 'End') {
      event.preventDefault();
      selectTab('history');
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Dashboard rides"
      onKeyDown={handleKeyDown}
      className="mt-8 flex gap-6 border-b border-line"
    >
      <button
        id="upcoming-tab"
        type="button"
        role="tab"
        aria-selected={current === 'upcoming'}
        aria-controls="upcoming-panel"
        tabIndex={current === 'upcoming' ? 0 : -1}
        onClick={() => onChange('upcoming')}
        className={`inline-flex min-h-11 items-center border-b-2 px-1 font-semibold ${
          current === 'upcoming'
            ? 'border-brand text-ink'
            : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Your rides
      </button>
      <button
        id="history-tab"
        type="button"
        role="tab"
        aria-selected={current === 'history'}
        aria-controls="history-panel"
        tabIndex={current === 'history' ? 0 : -1}
        onClick={() => onChange('history')}
        className={`inline-flex min-h-11 items-center border-b-2 px-1 font-semibold ${
          current === 'history'
            ? 'border-brand text-ink'
            : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Ride history
      </button>
    </div>
  );
}
