'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { DesignSystem } from '@/components/ui/DesignSystem';
import { Field } from '@/components/ui/Field';
import { routes } from '@/lib/routes';
import type { ProfileData } from '@/lib/profile-types';
import { CommentsAboutYou, YourRating } from './RatingSummary';

type SelectedTag = { id: string; visible: boolean };

export function ProfileEditor({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [pickupPoint, setPickupPoint] = useState(profile.defaultPickupPointId ?? '');
  const [vehicleType, setVehicleType] = useState(profile.preferredVehicleTypeId ?? '');
  const [maxFare, setMaxFare] = useState(profile.maxAcceptableFareShare?.toString() ?? '');
  const [mobileNumber, setMobileNumber] = useState(profile.mobileNumber ?? '');
  const [aiTagConsent, setAiTagConsent] = useState(profile.aiTagConsent);
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>(
    profile.tags.filter((tag) => tag.selected).map(({ id, visible }) => ({ id, visible })),
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const toggleTag = (id: string, selected: boolean) => {
    setSaved(false);
    setSelectedTags((current) => {
      if (!selected) return current.filter((tag) => tag.id !== id);
      if (current.length >= 10) {
        setError('You can choose up to 10 interest tags.');
        return current;
      }
      setError('');
      return [...current, { id, visible: true }];
    });
  };

  const setTagVisibility = (id: string, visible: boolean) => {
    setSaved(false);
    setSelectedTags((current) => current.map((tag) => (tag.id === id ? { ...tag, visible } : tag)));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    setSaved(false);

    const fareValue = maxFare.trim() === '' ? null : Number(maxFare);
    if (displayName.trim().length < 2 || displayName.trim().length > 40) {
      setError('Display name must be between 2 and 40 characters.');
      return;
    }
    if (!pickupPoint) {
      setError('Choose a default pickup point.');
      return;
    }
    if (fareValue !== null && (!Number.isSafeInteger(fareValue) || fareValue < 1)) {
      setError('Maximum fare share must be a positive whole number of rupees.');
      return;
    }
    if (mobileNumber && !/^\d{10}$/.test(mobileNumber)) {
      setError('Enter a 10-digit Indian mobile number or leave it blank.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          defaultPickupPointId: pickupPoint,
          interestTags: selectedTags,
          preferredVehicleTypeId: vehicleType || null,
          maxAcceptableFareShare: fareValue,
          aiTagConsent,
          mobileNumber: mobileNumber || null,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'Your profile could not be saved. Please try again.');
        return;
      }
      setSaved(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE' || deleting) return;
    setError('');
    setDeleting(true);
    try {
      const response = await fetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'Your account could not be deleted. Please try again.');
        return;
      }
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const visibleTags = profile.tags.filter((tag) =>
    selectedTags.some((selected) => selected.id === tag.id && selected.visible),
  );

  return (
    <DesignSystem className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
            Account settings
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Your profile</h1>
          <p className="mt-3 max-w-2xl text-ink-muted">
            Update the details and preferences used for your future rides and suggestions.
          </p>
        </div>
        <ButtonLink href={routes.home} variant="secondary">
          Back to dashboard
        </ButtonLink>
      </div>

      <section
        aria-labelledby="public-profile-heading"
        className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="public-profile-heading" className="text-xl font-bold">
              Rider preview
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Other riders see your display name, visible tags, completed-trip count and, from 3
              ratings, your average rating. They do not see your email or phone number.
            </p>
          </div>
          <span className="rounded-control bg-panel px-3 py-1 text-sm font-semibold">
            {profile.completedTrips} completed {profile.completedTrips === 1 ? 'trip' : 'trips'}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-semibold">{displayName.trim() || 'Your display name'}</span>
          {visibleTags.length > 0 ? (
            visibleTags.map((tag) => (
              <span key={tag.id} className="rounded-control border border-line px-2 py-1 text-sm">
                {tag.name}
              </span>
            ))
          ) : (
            <span className="text-sm text-ink-muted">No visible interest tags</span>
          )}
        </div>
        {/* CS455-44: the placeholder "Rating: not available yet" is now the real rating. */}
        <YourRating rating={profile.rating} />
      </section>

      <CommentsAboutYou rating={profile.rating} />

      <form onSubmit={save} className="mt-8 space-y-8">
        <section aria-labelledby="personal-heading">
          <h2 id="personal-heading" className="text-xl font-bold">
            Personal details
          </h2>
          <div className="mt-4 grid gap-5 rounded-panel border border-line bg-surface p-5 sm:grid-cols-2 sm:p-6">
            <Field
              label="Display name"
              name="displayName"
              value={displayName}
              minLength={2}
              maxLength={40}
              autoComplete="nickname"
              hintPosition="after"
              onChange={(event) => {
                setDisplayName(event.target.value);
                setSaved(false);
              }}
              hint="This is the name other riders will see."
            />
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Default pickup point
              <select
                name="defaultPickupPointId"
                value={pickupPoint}
                required
                onChange={(event) => {
                  setPickupPoint(event.target.value);
                  setSaved(false);
                }}
                className="min-h-12 rounded-control border border-line-strong bg-surface px-3 text-base text-ink"
              >
                <option value="">Choose a campus pickup point</option>
                {profile.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="IITK email" value={profile.email} readOnly />
            <Field label="Roll number" value={profile.rollNumber} readOnly />
            <Field label="Registered full name" value={profile.fullName} readOnly />
            <Field
              label="Mobile number (optional)"
              name="mobileNumber"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              value={mobileNumber}
              hintPosition="after"
              hint="10 digits. Not shown to other riders. Administrator-only SOS access is not implemented. Never sent to AI."
              onChange={(event) => {
                setMobileNumber(event.target.value);
                setSaved(false);
              }}
            />
          </div>
        </section>

        <section aria-labelledby="interests-heading">
          <div>
            <h2 id="interests-heading" className="text-xl font-bold">
              Interest tags
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Choose up to 10 tags from the approved list. New tags are visible to other riders by
              default; you can hide any tag.
            </p>
          </div>
          <div className="mt-4 grid gap-3 rounded-panel border border-line bg-surface p-5 sm:grid-cols-2 sm:p-6">
            {profile.tags.map((tag) => {
              const selected = selectedTags.find((item) => item.id === tag.id);
              return (
                <div key={tag.id} className="rounded-control border border-line p-3">
                  <label className="flex min-h-11 items-center gap-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={(event) => toggleTag(tag.id, event.target.checked)}
                    />
                    {tag.name}
                  </label>
                  {selected && (
                    <label className="ml-8 flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.visible}
                        onChange={(event) => setTagVisibility(tag.id, event.target.checked)}
                      />
                      Show this tag to other riders
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-ink-muted">{selectedTags.length} of 10 tags selected.</p>
        </section>

        <section aria-labelledby="preferences-heading">
          <h2 id="preferences-heading" className="text-xl font-bold">
            Ride preferences
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Optional saved filters for future ride searches. The current Offer a ride form uses your
            pickup point and vehicle defaults; search-filter prefill will apply when that screen is
            available.
          </p>
          <div className="mt-4 grid gap-5 rounded-panel border border-line bg-surface p-5 sm:grid-cols-2 sm:p-6">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Preferred vehicle type
              <select
                name="preferredVehicleTypeId"
                value={vehicleType}
                onChange={(event) => {
                  setVehicleType(event.target.value);
                  setSaved(false);
                }}
                className="min-h-12 rounded-control border border-line-strong bg-surface px-3 text-base text-ink"
              >
                <option value="">No preference</option>
                {profile.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Maximum acceptable fare share (₹)"
              name="maxAcceptableFareShare"
              type="number"
              min={1}
              max={2_147_483_647}
              step={1}
              inputMode="numeric"
              value={maxFare}
              hintPosition="after"
              hint="Optional, in whole rupees."
              onChange={(event) => {
                setMaxFare(event.target.value);
                setSaved(false);
              }}
            />
          </div>
        </section>

        <section aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="text-xl font-bold">
            Privacy and suggestions
          </h2>
          <div className="mt-4 rounded-panel border border-line bg-surface p-5 sm:p-6">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={aiTagConsent}
                onChange={(event) => {
                  setAiTagConsent(event.target.checked);
                  setSaved(false);
                }}
                className="mt-1"
              />
              <span>
                <span className="font-semibold">
                  Allow my interest tags to inform AI suggestions
                </span>
                <span className="mt-1 block text-sm text-ink-muted">
                  Optional. Only tags you selected may be used. You can withdraw consent here at any
                  time; without consent, tags are not used for AI suggestions or ranking.
                </span>
              </span>
            </label>
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="font-semibold">Account and data</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Reset your password, download a machine-readable copy of your account data, or
                permanently delete your account. Deletion removes your sign-in and profile data;
                ride history remains with your name anonymized so existing ride records stay
                consistent.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                <ButtonLink href="/forgot-password" variant="quiet" className="px-0">
                  Reset password
                </ButtonLink>
                <a
                  href="/api/profile/export"
                  className="inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-4"
                >
                  Download my data (JSON)
                </a>
              </div>
              <div className="mt-4">
                {!showDeleteConfirm ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="border-danger text-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete account
                  </Button>
                ) : (
                  <div className="max-w-xl rounded-panel border border-danger p-4">
                    <p className="font-semibold">This action cannot be undone.</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Type DELETE to confirm. Your account will be signed out and personal profile
                      data removed.
                    </p>
                    <Field
                      label="Confirmation"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      autoComplete="off"
                    />
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={deleting || deleteConfirmation !== 'DELETE'}
                        className="border-danger text-danger"
                        onClick={deleteAccount}
                      >
                        {deleting ? 'Deleting…' : 'Confirm deletion'}
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmation('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {(error || saved) && (
          <p
            role={error ? 'alert' : 'status'}
            className={error ? 'text-danger' : 'text-accent-text'}
          >
            {error || 'Profile saved.'}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
          <ButtonLink href={routes.home} variant="secondary">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </DesignSystem>
  );
}
