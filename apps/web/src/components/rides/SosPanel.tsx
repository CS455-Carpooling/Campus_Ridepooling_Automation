'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { EmergencyContacts } from '@/components/complaints/EmergencyContacts';
import { Button } from '@/components/ui/Button';
import { formatClockTime } from '@/lib/format';
import type { SosIncident } from '@/lib/sos';
import { SOS_RULES } from '@/lib/sos-rules';

type LocationState = 'idle' | 'asking' | 'shared' | 'not_shared';

const sendFailed = 'The alert could not be sent. Call 112 or campus security now.';

/**
 * SOS on the ride page (CS455-64: FR-RD-15, FR-RO-13.2), for active occupants while the trip is
 * under way. It asks once, then sends the alert straight away; only after that does it ask for
 * the location, so a slow or refused location never delays the alert. The emergency numbers and
 * the no-dispatch note are on screen from the question on (FR-RD-15.3). The rest of the pool is
 * never told (FR-RD-15.4). The person who raised it can mark it a false alarm (FR-RD-15.5).
 */
export function SosPanel({
  rideId,
  incident: fromServer,
  canRaise,
}: {
  rideId: string;
  incident: SosIncident | null;
  canRaise: boolean;
}) {
  const router = useRouter();
  const [incident, setIncident] = useState(fromServer);
  const [lastFromServer, setLastFromServer] = useState(fromServer);
  const [step, setStep] = useState<'idle' | 'confirm' | 'false_alarm'>('idle');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<LocationState>('idle');
  const question = useRef<HTMLElement>(null);
  const headingId = useId();

  // The server's view wins whenever the page is read again.
  if (fromServer !== lastFromServer) {
    setLastFromServer(fromServer);
    setIncident(fromServer);
  }
  const locationShared = incident?.locationShared || location === 'shared';

  useEffect(() => {
    if (step !== 'idle') question.current?.focus();
  }, [step]);

  async function call(url: string, init: RequestInit): Promise<SosIncident | null> {
    const response = await fetch(url, init);
    const data = (await response.json().catch(() => ({}))) as {
      incident?: SosIncident;
      error?: string;
    };
    if (!response.ok || !data.incident) {
      setError(data.error ?? sendFailed);
      return null;
    }
    return data.incident;
  }

  function shareLocation(incidentId: string) {
    if (!('geolocation' in navigator)) {
      setLocation('not_shared');
      return;
    }
    setLocation('asking');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const updated = await call(`/api/sos/${encodeURIComponent(incidentId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
          });
          setLocation(updated?.locationShared ? 'shared' : 'not_shared');
        } catch {
          setLocation('not_shared');
        }
      },
      () => setLocation('not_shared'),
      { enableHighAccuracy: true, timeout: SOS_RULES.locationTimeoutMs, maximumAge: 0 },
    );
  }

  async function raise() {
    setSending(true);
    setError('');
    try {
      const raised = await call(`/api/rides/${encodeURIComponent(rideId)}/sos`, {
        method: 'POST',
      });
      if (!raised) return;
      setIncident(raised);
      setStep('idle');
      if (!raised.locationShared) shareLocation(raised.id);
      router.refresh();
    } catch {
      setError(sendFailed);
    } finally {
      setSending(false);
    }
  }

  async function markFalseAlarm() {
    if (!incident) return;
    setSending(true);
    setError('');
    try {
      const updated = await call(`/api/sos/${encodeURIComponent(incident.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ falseAlarm: true }),
      });
      if (!updated) return;
      setIncident(updated);
      setStep('idle');
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  const active = incident && !incident.falseAlarm;
  const errorLine = error && (
    <p role="alert" className="mt-3 font-semibold text-danger">
      {error}
    </p>
  );

  if (step === 'confirm') {
    return (
      <section
        ref={question}
        tabIndex={-1}
        aria-labelledby={headingId}
        className="mt-8 rounded-panel border-2 border-danger p-5 sm:p-6"
      >
        <h2 id={headingId} className="text-xl font-bold tracking-tight">
          Send an SOS alert?
        </h2>
        <p className="mt-2">
          Operations admins are alerted at once with the details of this trip, and your location if
          you allow it. The others on this ride are not told.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="danger" onClick={raise} disabled={sending}>
            {sending ? 'Sending the alert…' : 'Yes, send SOS'}
          </Button>
          <Button variant="secondary" onClick={() => setStep('idle')} disabled={sending}>
            Not now
          </Button>
        </div>
        {errorLine}
        <div className="mt-5">
          <EmergencyContacts />
        </div>
      </section>
    );
  }

  if (active) {
    return (
      <section
        aria-labelledby={headingId}
        className="mt-8 rounded-panel border-2 border-danger p-5 sm:p-6"
      >
        <h2 id={headingId} className="text-xl font-bold tracking-tight">
          Your SOS alert was sent
        </h2>
        <p className="mt-2" aria-live="polite">
          Reference <span className="font-mono font-semibold">{incident.reference}</span>, sent at{' '}
          <time dateTime={incident.raisedAt} className="font-mono tabular-nums">
            {formatClockTime(incident.raisedAt)}
          </time>
          . Operations admins have been alerted. The others on this ride have not been told.
        </p>
        <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
          {locationShared && 'Your location was shared with the admins.'}
          {!locationShared && location === 'asking' && 'Finding your location…'}
          {!locationShared &&
            location === 'not_shared' &&
            'Your location was not shared. The admins still have the trip details.'}
        </p>
        <div className="mt-5">
          <EmergencyContacts />
        </div>
        {step === 'false_alarm' ? (
          <section
            ref={question}
            tabIndex={-1}
            aria-label="Mark as a false alarm?"
            className="mt-5 rounded-panel border border-line-strong p-4"
          >
            <p className="font-semibold">Mark this alert as a false alarm?</p>
            <p className="mt-1 text-sm text-ink-muted">
              The admins still see it, marked as a false alarm.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button onClick={markFalseAlarm} disabled={sending}>
                {sending ? 'Marking…' : 'Yes, it was a false alarm'}
              </Button>
              <Button variant="secondary" onClick={() => setStep('idle')} disabled={sending}>
                Keep the alert
              </Button>
            </div>
          </section>
        ) : (
          <div className="mt-5">
            <Button variant="secondary" onClick={() => setStep('false_alarm')}>
              It was a false alarm
            </Button>
          </div>
        )}
        {errorLine}
      </section>
    );
  }

  if (!canRaise) return null;
  return (
    <div className="mt-8">
      {incident?.falseAlarm && (
        <p className="mb-3 text-sm text-ink-muted">
          You marked your alert {incident.reference} as a false alarm. You can still send a new one.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="danger" onClick={() => setStep('confirm')}>
          SOS
        </Button>
        <p className="text-sm text-ink-muted">
          For an emergency on this trip. The others on the ride are not told.
        </p>
      </div>
      {errorLine}
    </div>
  );
}
