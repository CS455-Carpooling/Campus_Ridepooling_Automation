CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_iitk_only CHECK (email ~ '^[a-z0-9._%+-]+@iitk\.ac\.in$')
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  detail TEXT,
  type TEXT NOT NULL CHECK (type IN ('campus', 'transport_hub')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicle_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS interest_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO interest_tags (id, name)
VALUES
  ('academic-tracks', 'Academic tracks'),
  ('hobbies', 'Hobbies'),
  ('quiet-ride', 'Quiet ride')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  default_pickup_point_id TEXT REFERENCES locations(id),
  preferred_vehicle_type_id TEXT REFERENCES vehicle_types(id),
  max_acceptable_fare_share INTEGER CHECK (max_acceptable_fare_share > 0),
  ai_tag_consent BOOLEAN NOT NULL DEFAULT FALSE,
  mobile_number TEXT CHECK (mobile_number IS NULL OR mobile_number ~ '^[0-9]{10}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profile_tags (
  user_id UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES interest_tags(id),
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, tag_id)
);

INSERT INTO user_profiles (user_id, display_name)
SELECT id, CASE WHEN char_length(trim(full_name)) < 2 THEN 'User'
                ELSE left(trim(full_name), 40) END
FROM users
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  direction TEXT NOT NULL CHECK (direction IN ('to_hub', 'from_hub')),
  hub_id TEXT NOT NULL REFERENCES locations(id),
  vehicle_type_id TEXT NOT NULL REFERENCES vehicle_types(id),
  capacity_snapshot INTEGER NOT NULL CHECK (capacity_snapshot > 0),
  departure_start TIMESTAMPTZ NOT NULL,
  departure_end TIMESTAMPTZ NOT NULL,
  expected_total_fare INTEGER NOT NULL CHECK (expected_total_fare > 0),
  state TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (state IN ('scheduled', 'pickup_in_progress', 'in_transit', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rides_departure_window_valid CHECK (departure_start < departure_end)
);

CREATE INDEX IF NOT EXISTS rides_owner_departure_idx
  ON rides(owner_id, departure_start);

CREATE INDEX IF NOT EXISTS rides_hub_departure_idx
  ON rides(hub_id, departure_start);

CREATE INDEX IF NOT EXISTS rides_state_departure_idx
  ON rides(state, departure_start);

CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  campus_location_id TEXT NOT NULL REFERENCES locations(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  CONSTRAINT riders_ride_user_unique UNIQUE (ride_id, user_id)
);

-- When the person got their seat: when the owner created the ride, or when a rider's
-- request was accepted. It orders the fare split (Table T-2: owner first, then riders
-- in the order they were accepted), so a riders row must be inserted on acceptance.
-- Added after the table, so existing databases get it too.
ALTER TABLE riders ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE riders ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- "My rides" looks rides up by person; the unique (ride_id, user_id) index cannot serve that.
CREATE INDEX IF NOT EXISTS riders_user_idx ON riders(user_id);

-- Initial configurable locations. Stable IDs match the current Create Ride form
-- values so the UI can later read these records directly from the database.
INSERT INTO locations (id, name, detail, type, sort_order, is_active)
VALUES
  ('hall-1', 'Hall 1', NULL, 'campus', 1, TRUE),
  ('hall-2', 'Hall 2', NULL, 'campus', 2, TRUE),
  ('hall-3', 'Hall 3', NULL, 'campus', 3, TRUE),
  ('hall-4', 'Hall 4', NULL, 'campus', 4, TRUE),
  ('hall-5', 'Hall 5', NULL, 'campus', 5, TRUE),
  ('hall-6', 'Hall 6', NULL, 'campus', 6, TRUE),
  ('hall-7', 'Hall 7', NULL, 'campus', 7, TRUE),
  ('hall-8', 'Hall 8', NULL, 'campus', 8, TRUE),
  ('hall-9', 'Hall 9', NULL, 'campus', 9, TRUE),
  ('hall-10', 'Hall 10', NULL, 'campus', 10, TRUE),
  ('hall-11', 'Hall 11', NULL, 'campus', 11, TRUE),
  ('hall-12', 'Hall 12', NULL, 'campus', 12, TRUE),
  ('hall-13', 'Hall 13', NULL, 'campus', 13, TRUE),
  ('hall-14', 'Hall 14', NULL, 'campus', 14, TRUE),
  ('main-gate', 'Main Gate', NULL, 'campus', 15, TRUE),
  ('kanpur-central', 'Kanpur Central', 'Railway station', 'transport_hub', 1, TRUE),
  ('kanpur-anwarganj', 'Kanpur Anwarganj', 'Railway station', 'transport_hub', 2, TRUE),
  ('bus-stand', 'Bus stand', 'Kanpur', 'transport_hub', 3, TRUE),
  ('metro-station', 'Metro station', 'Kanpur Metro', 'transport_hub', 4, TRUE),
  ('kanpur-airport', 'Kanpur airport', 'Airport', 'transport_hub', 5, TRUE),
  ('lucknow-airport', 'Lucknow airport', 'Airport', 'transport_hub', 6, TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE locations SET sort_order = CASE id
  WHEN 'hall-1' THEN 1 WHEN 'hall-2' THEN 2 WHEN 'hall-3' THEN 3 WHEN 'hall-4' THEN 4
  WHEN 'hall-5' THEN 5 WHEN 'hall-6' THEN 6 WHEN 'hall-7' THEN 7 WHEN 'hall-8' THEN 8
  WHEN 'hall-9' THEN 9 WHEN 'hall-10' THEN 10 WHEN 'hall-11' THEN 11 WHEN 'hall-12' THEN 12
  WHEN 'hall-13' THEN 13 WHEN 'hall-14' THEN 14 WHEN 'main-gate' THEN 15
  WHEN 'kanpur-central' THEN 1 WHEN 'kanpur-anwarganj' THEN 2 WHEN 'bus-stand' THEN 3
  WHEN 'metro-station' THEN 4 WHEN 'kanpur-airport' THEN 5 WHEN 'lucknow-airport' THEN 6
  ELSE sort_order END;

INSERT INTO vehicle_types (id, name, capacity, sort_order, is_active)
VALUES
  ('car', 'Car', 4, 1, TRUE),
  ('auto', 'Auto', 3, 2, TRUE),
  ('vikram', 'Vikram', 7, 3, TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE vehicle_types SET sort_order = CASE id
  WHEN 'car' THEN 1 WHEN 'auto' THEN 2 WHEN 'vikram' THEN 3
  ELSE sort_order END;

-- Completing and rating a ride (CS455-39: FR-RO-09.4, FR-RD-12, FR-RO-12).
-- When the owner marked the ride completed. Rating is open for 72 hours from then (P-16), so a
-- completed ride must have it, and no other ride may. Rides set to completed by hand before the
-- column existed take the end of their departure window.
ALTER TABLE rides ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

UPDATE rides SET completed_at = departure_end
WHERE state = 'completed' AND completed_at IS NULL;

UPDATE rides SET cancelled_at = now()
WHERE state = 'cancelled' AND cancelled_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rides_completed_at_matches_state'
  ) THEN
    ALTER TABLE rides ADD CONSTRAINT rides_completed_at_matches_state
      CHECK ((state = 'completed') = (completed_at IS NOT NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rides_cancelled_at_matches_state'
  ) THEN
    ALTER TABLE rides ADD CONSTRAINT rides_cancelled_at_matches_state
      CHECK ((state = 'cancelled') = (cancelled_at IS NOT NULL));
  END IF;
END $$;

-- Private ride pool chat. Chat opens at lock, persists for the pool, and stops accepting writes
-- immediately on cancellation or 24 hours after completion. History remains readable until it is
-- deleted 30 days after the read-only point, unless an unresolved complaint needs it for review.
CREATE TABLE IF NOT EXISTS ride_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL UNIQUE REFERENCES rides(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  read_only_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

ALTER TABLE ride_chats ADD COLUMN IF NOT EXISTS read_only_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ride_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES ride_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reported_at TIMESTAMPTZ,
  report_reason TEXT
);

CREATE INDEX IF NOT EXISTS ride_chat_messages_chat_created_idx
  ON ride_chat_messages(chat_id, created_at);

CREATE TABLE IF NOT EXISTS ride_chat_message_limits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  message_count INTEGER NOT NULL CHECK (message_count BETWEEN 1 AND 20)
);

CREATE TABLE IF NOT EXISTS ride_chat_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES ride_chats(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES ride_chat_messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT ride_chat_complaints_reporter_message_unique UNIQUE (reporter_id, message_id),
  CONSTRAINT ride_chat_complaints_resolution_matches_status
    CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ride_chat_complaints_open_created_idx
  ON ride_chat_complaints(created_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pool_chat_opened','pool_chat_message','ride_update')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_ride_id UUID REFERENCES rides(id),
  related_chat_id UUID REFERENCES ride_chats(id),
  related_message_id UUID REFERENCES ride_chat_messages(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

-- One person's rating of another after a ride (US-RD-28). Both must have a seat on that ride
-- (a riders row: the owner has one too), nobody rates themselves, and each person rates each
-- other person once per ride (AC2). Ratings are never updated or deleted by the app; they go
-- only when the seat or the ride does. Who gave a rating is never shown to anyone (P-24).
CREATE TABLE IF NOT EXISTS ride_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL,
  ratee_id UUID NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  -- Optional, and shown only to the person rated, without the rater's name or the score.
  comment TEXT CHECK (comment IS NULL OR char_length(comment) BETWEEN 1 AND 500),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ride_ratings_once UNIQUE (ride_id, rater_id, ratee_id),
  CONSTRAINT ride_ratings_not_self CHECK (rater_id <> ratee_id),
  CONSTRAINT ride_ratings_rater_on_ride FOREIGN KEY (ride_id, rater_id)
    REFERENCES riders (ride_id, user_id) ON DELETE CASCADE,
  CONSTRAINT ride_ratings_ratee_on_ride FOREIGN KEY (ride_id, ratee_id)
    REFERENCES riders (ride_id, user_id) ON DELETE CASCADE
);

-- A person's average and the comments about them are looked up by the person rated.
CREATE INDEX IF NOT EXISTS ride_ratings_ratee_idx ON ride_ratings (ratee_id, submitted_at DESC);

-- ============================================================================================
-- Operations admin (CS455-46; schema: CS455-47). Admins configure vehicle types, hubs and
-- fares, review complaints with an AI summary and recommendation, and warn, suspend or
-- reactivate riders. The rules that must never break are enforced here, not only in the app.
-- ============================================================================================

-- Roles (SYS-FR-39 to 41). Every account is a student. An operator makes an existing account an
-- admin with `npm run admin:grant` (scripts/admin-role.mjs); nothing in the app changes a role.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

-- Every state-changing admin action, including refused and failed ones (SYS-FR-45, SYS-NFR-01,
-- 06). Entities are referenced by type and ID as text, so no cascade can remove a record.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'operator_script', 'system')),
  admin_id UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
  entity_type TEXT NOT NULL CHECK (char_length(entity_type) BETWEEN 1 AND 50),
  entity_id TEXT NOT NULL CHECK (char_length(entity_id) BETWEEN 1 AND 200),
  reason TEXT CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 1000),
  before_state JSONB,
  after_state JSONB,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'refused', 'failed')),
  error_code TEXT CHECK (error_code IS NULL OR char_length(error_code) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_admin_named CHECK (actor_type <> 'admin' OR admin_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx
  ON admin_audit_log (entity_type, entity_id, created_at DESC);

-- Optimistic concurrency for configuration (SYS-NFR-04, 05): an edit names the version it read,
-- and is refused when another admin has changed the item since.
ALTER TABLE locations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE vehicle_types ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- One fixed fare per pair of campus places and vehicle type (OA-FR-10). A pair is stored once,
-- in ID order. That both places are campus places is checked by the configuration API.
CREATE TABLE IF NOT EXISTS campus_fares (
  from_location_id TEXT NOT NULL REFERENCES locations(id),
  to_location_id TEXT NOT NULL REFERENCES locations(id),
  vehicle_type_id TEXT NOT NULL REFERENCES vehicle_types(id),
  fare INTEGER NOT NULL CHECK (fare BETWEEN 1 AND 50000),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_location_id, to_location_id, vehicle_type_id),
  CONSTRAINT campus_fares_pair_once CHECK (from_location_id < to_location_id)
);

-- An approximate fare range for a trip to or from an external hub, per vehicle type (OA-FR-11).
-- Riders see it only as an estimate; the ride owner sets the exact fare (SYS-FR-12, 13).
CREATE TABLE IF NOT EXISTS external_fare_ranges (
  hub_id TEXT NOT NULL REFERENCES locations(id),
  vehicle_type_id TEXT NOT NULL REFERENCES vehicle_types(id),
  min_fare INTEGER NOT NULL CHECK (min_fare BETWEEN 1 AND 50000),
  max_fare INTEGER NOT NULL CHECK (max_fare BETWEEN 1 AND 50000),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hub_id, vehicle_type_id),
  CONSTRAINT external_fare_ranges_ordered CHECK (min_fare <= max_fare)
);

-- A rider's complaint about someone they shared a trip with (FR-RD-13, OA-FR-18, SYS-FR-19).
-- Categories are the rider ones of FR-RD-13.1; the admin requirements' "SOS complaint" is Safety.
-- Chat reports (FR-RD-09.6) are complaints too: source 'chat_report', with the reported
-- messages in complaint_chat_messages. Both people must have a seat on the ride, nobody
-- complains about themselves, and there is one complaint per complainant, trip and accused
-- (FR-RD-13.4). The app never deletes a complaint or a ride.
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE
    DEFAULT ('CMP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  -- The reference of a chat report copied from ride_chat_complaints, such as chat-1a2b3c4d.
  legacy_reference TEXT UNIQUE,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  complainant_id UUID NOT NULL REFERENCES users(id),
  accused_id UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL
    CHECK (category IN ('safety', 'harassment', 'tardiness', 'payment', 'no_show', 'other')),
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'chat_report')),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'resolved')),
  -- Set on resolution; riders see whether action was taken, never which (FR-RD-13.5).
  action_taken BOOLEAN,
  resolution_note TEXT
    CHECK (resolution_note IS NULL OR char_length(resolution_note) BETWEEN 1 AND 1000),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 20 to 2000 characters from the form (P-17); a chat report carries the reporter's reason.
  CONSTRAINT complaints_description_length CHECK (
    char_length(description) BETWEEN (CASE WHEN source = 'form' THEN 20 ELSE 1 END) AND 2000
  ),
  CONSTRAINT complaints_once UNIQUE (complainant_id, ride_id, accused_id),
  CONSTRAINT complaints_not_self CHECK (complainant_id <> accused_id),
  CONSTRAINT complaints_complainant_on_ride FOREIGN KEY (ride_id, complainant_id)
    REFERENCES riders (ride_id, user_id) ON DELETE CASCADE,
  CONSTRAINT complaints_accused_on_ride FOREIGN KEY (ride_id, accused_id)
    REFERENCES riders (ride_id, user_id) ON DELETE CASCADE,
  CONSTRAINT complaints_resolution_matches_status
    CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
  CONSTRAINT complaints_resolved_with_outcome
    CHECK (status <> 'resolved' OR action_taken IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS complaints_open_created_idx
  ON complaints (created_at) WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS complaints_accused_created_idx
  ON complaints (accused_id, created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_complainant_created_idx
  ON complaints (complainant_id, created_at DESC);

-- The chat messages a complaint is about. Reporting another message from the same person on
-- the same trip adds it to the existing complaint. A message deleted under the chat retention
-- rules (FR-RD-09.5) takes its link with it.
CREATE TABLE IF NOT EXISTS complaint_chat_messages (
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES ride_chat_messages(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (complaint_id, message_id)
);

CREATE INDEX IF NOT EXISTS complaint_chat_messages_message_idx
  ON complaint_chat_messages (message_id);

-- Warnings and suspensions (OA-FR-21, 23, 28; SYS-FR-24 to 27). Both need a reason. A
-- suspension has an end time or is explicitly indefinite, never both and never neither
-- (UC-OA-08), and a lift needs a reason (US-OA-14). Nothing is deleted: a reactivation sets
-- lifted_at, and an ended suspension simply stops being active.
CREATE TABLE IF NOT EXISTS rider_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000),
  issued_by UUID NOT NULL REFERENCES users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rider_warnings_not_self CHECK (user_id <> issued_by)
);

CREATE INDEX IF NOT EXISTS rider_warnings_user_idx ON rider_warnings (user_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS rider_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL,
  -- Shown to the suspended rider with the end date (FR-RD-01.5); the reason text is not.
  reason_category TEXT NOT NULL
    CHECK (reason_category IN ('safety', 'harassment', 'tardiness', 'payment', 'no_show', 'other')),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_indefinite BOOLEAN NOT NULL,
  issued_by UUID NOT NULL REFERENCES users(id),
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES users(id),
  lift_reason TEXT CHECK (lift_reason IS NULL OR char_length(btrim(lift_reason)) BETWEEN 1 AND 1000),
  CONSTRAINT rider_suspensions_one_length CHECK (is_indefinite = (ends_at IS NULL)),
  CONSTRAINT rider_suspensions_ends_after_start CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT rider_suspensions_lift_complete CHECK (
    (lifted_at IS NULL) = (lifted_by IS NULL) AND (lifted_at IS NULL) = (lift_reason IS NULL)
  ),
  CONSTRAINT rider_suspensions_not_self CHECK (user_id <> issued_by)
);

CREATE INDEX IF NOT EXISTS rider_suspensions_user_idx ON rider_suspensions (user_id, starts_at DESC);

-- Suspensions in force now. A temporary one ends at ends_at without any job running, so the
-- account reactivates on time (SYS-FR-25); an indefinite one lasts until lifted (SYS-FR-26).
CREATE OR REPLACE VIEW active_rider_suspensions AS
  SELECT *
  FROM rider_suspensions
  WHERE lifted_at IS NULL AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now());

-- The Complaint Management AI's analysis of a complaint (SYS-FR-30 to 33, 46). Outcomes follow
-- the ride recommendation audit's names. Only a validated analysis carries a recommendation,
-- and the original complaint is never changed by it (SYS-FR-31, 47).
CREATE TABLE IF NOT EXISTS complaint_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'ai_validated', 'fallback_model_error', 'fallback_timeout', 'fallback_invalid',
    'fallback_low_confidence', 'fallback_service_error'
  )),
  summary TEXT CHECK (summary IS NULL OR char_length(summary) BETWEEN 1 AND 2000),
  severity TEXT CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high', 'critical')),
  behavior_tags TEXT[] NOT NULL DEFAULT '{}',
  recommended_action TEXT
    CHECK (recommended_action IS NULL OR recommended_action IN ('none', 'warning', 'suspension')),
  recommended_suspension_days INTEGER
    CHECK (recommended_suspension_days IS NULL OR recommended_suspension_days BETWEEN 1 AND 3650),
  recommended_indefinite BOOLEAN NOT NULL DEFAULT false,
  confidence DOUBLE PRECISION CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT complaint_ai_analyses_validated_complete CHECK (
    outcome <> 'ai_validated'
    OR (summary IS NOT NULL AND severity IS NOT NULL
        AND recommended_action IS NOT NULL AND confidence IS NOT NULL)
  ),
  -- A recommended suspension names a length in days or is indefinite, exactly one of them.
  CONSTRAINT complaint_ai_analyses_suspension_length CHECK (
    CASE WHEN recommended_action = 'suspension'
      THEN recommended_indefinite = (recommended_suspension_days IS NULL)
      ELSE recommended_suspension_days IS NULL AND NOT recommended_indefinite
    END
  )
);

CREATE INDEX IF NOT EXISTS complaint_ai_analyses_complaint_idx
  ON complaint_ai_analyses (complaint_id, created_at DESC);

-- An admin's decision on an AI recommendation (OA-FR-34, 36; SYS-FR-35, 38). One decision per
-- recommendation; rejecting or overriding needs a reason; a rejection never acts; the final
-- action points at the warning or suspension it created.
CREATE TABLE IF NOT EXISTS ai_enforcement_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL UNIQUE REFERENCES complaint_ai_analyses(id) ON DELETE CASCADE,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'overridden')),
  reason TEXT CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 1000),
  final_action TEXT NOT NULL CHECK (final_action IN ('none', 'warning', 'suspension')),
  warning_id UUID REFERENCES rider_warnings(id),
  suspension_id UUID REFERENCES rider_suspensions(id),
  decided_by UUID NOT NULL REFERENCES users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_enforcement_decisions_reason CHECK (decision = 'approved' OR reason IS NOT NULL),
  CONSTRAINT ai_enforcement_decisions_rejection_acts_not
    CHECK (decision <> 'rejected' OR final_action = 'none'),
  CONSTRAINT ai_enforcement_decisions_action_linked CHECK (
    (final_action = 'warning') = (warning_id IS NOT NULL)
    AND (final_action = 'suspension') = (suspension_id IS NOT NULL)
  )
);

-- Audit records never change (SYS-NFR-02), and the history of complaints, warnings,
-- suspensions and AI decisions is kept (SYS-FR-27, 31, 47; SYS-NFR-11).
CREATE OR REPLACE FUNCTION admin_audit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE OR REPLACE FUNCTION complaints_keep_original() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.description IS DISTINCT FROM OLD.description
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.complainant_id IS DISTINCT FROM OLD.complainant_id
     OR NEW.accused_id IS DISTINCT FROM OLD.accused_id
     OR NEW.ride_id IS DISTINCT FROM OLD.ride_id
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'The original complaint cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Warnings, suspensions and AI decisions exist only by an admin's hand (SYS-FR-37): the person
-- who issues, lifts or decides must have the admin role. A suspension may change only by being
-- lifted; warnings and decisions never change.
CREATE OR REPLACE FUNCTION enforcement_by_admin_only() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Checked one table at a time: a record only has its own table's fields.
    IF TG_TABLE_NAME <> 'rider_suspensions' THEN
      RAISE EXCEPTION '% records cannot be changed', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.complaint_id IS DISTINCT FROM OLD.complaint_id
       OR NEW.reason_category IS DISTINCT FROM OLD.reason_category
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
       OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
       OR NEW.is_indefinite IS DISTINCT FROM OLD.is_indefinite
       OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
       OR OLD.lifted_at IS NOT NULL
       OR NEW.lifted_at IS NULL THEN
      RAISE EXCEPTION 'A suspension can change only by being lifted, once'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    actor := NEW.lifted_by;
  ELSIF TG_TABLE_NAME = 'ai_enforcement_decisions' THEN
    actor := NEW.decided_by;
  ELSE
    actor := NEW.issued_by;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = actor AND role = 'admin') THEN
    RAISE EXCEPTION 'Only an operations admin can do this'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_valid') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_valid CHECK (role IN ('student', 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'admin_audit_log_no_change') THEN
    CREATE TRIGGER admin_audit_log_no_change
      BEFORE UPDATE OR DELETE ON admin_audit_log
      FOR EACH ROW EXECUTE FUNCTION admin_audit_log_append_only();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'complaints_original_unchanged') THEN
    CREATE TRIGGER complaints_original_unchanged
      BEFORE UPDATE ON complaints
      FOR EACH ROW EXECUTE FUNCTION complaints_keep_original();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rider_warnings_by_admin') THEN
    CREATE TRIGGER rider_warnings_by_admin
      BEFORE INSERT OR UPDATE ON rider_warnings
      FOR EACH ROW EXECUTE FUNCTION enforcement_by_admin_only();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rider_suspensions_by_admin') THEN
    CREATE TRIGGER rider_suspensions_by_admin
      BEFORE INSERT OR UPDATE ON rider_suspensions
      FOR EACH ROW EXECUTE FUNCTION enforcement_by_admin_only();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ai_enforcement_decisions_by_admin') THEN
    CREATE TRIGGER ai_enforcement_decisions_by_admin
      BEFORE INSERT OR UPDATE ON ai_enforcement_decisions
      FOR EACH ROW EXECUTE FUNCTION enforcement_by_admin_only();
  END IF;
END $$;

-- Notifications about a rider's own account and complaints. This block holds the full list of
-- notification types: add new types here, since it replaces the check whenever one is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND pg_get_constraintdef(oid) LIKE '%complaint_update%'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
      'pool_chat_opened', 'pool_chat_message', 'ride_update',
      'account_warning', 'account_suspended', 'account_reactivated', 'complaint_update'
    ));
  END IF;
END $$;

-- Chat reports become complaints (FR-RD-09.6). Reports already in ride_chat_complaints are
-- copied once (accused: the message's sender; category Other; the report reason as the
-- description), and every reported message is linked to the complaint for its reporter, trip
-- and sender. Reports where either person has no seat on the ride are left where they are.
INSERT INTO complaints (
  legacy_reference, ride_id, complainant_id, accused_id, category, description, source,
  status, action_taken, resolved_at, created_at, updated_at
)
SELECT report.reference, report.ride_id, report.reporter_id, message.sender_id, 'other',
       report.reason, 'chat_report',
       CASE WHEN report.status = 'resolved' THEN 'resolved' ELSE 'submitted' END,
       CASE WHEN report.status = 'resolved' THEN false END,
       report.resolved_at, report.created_at, report.created_at
FROM ride_chat_complaints report
JOIN ride_chat_messages message ON message.id = report.message_id
WHERE report.reporter_id <> message.sender_id
  AND NOT EXISTS (SELECT 1 FROM complaints copied WHERE copied.legacy_reference = report.reference)
  AND EXISTS (
    SELECT 1 FROM riders seat WHERE seat.ride_id = report.ride_id AND seat.user_id = report.reporter_id
  )
  AND EXISTS (
    SELECT 1 FROM riders seat WHERE seat.ride_id = report.ride_id AND seat.user_id = message.sender_id
  )
ON CONFLICT ON CONSTRAINT complaints_once DO NOTHING;

INSERT INTO complaint_chat_messages (complaint_id, message_id, added_at)
SELECT complaint.id, report.message_id, report.created_at
FROM ride_chat_complaints report
JOIN ride_chat_messages message ON message.id = report.message_id
JOIN complaints complaint
  ON complaint.complainant_id = report.reporter_id
 AND complaint.ride_id = report.ride_id
 AND complaint.accused_id = message.sender_id
ON CONFLICT DO NOTHING;

-- Until the chat report flow writes complaints itself (CS455-52), each new row in
-- ride_chat_complaints is mirrored the same way. A failure here only logs a warning, so it can
-- never stop a rider reporting a message.
CREATE OR REPLACE FUNCTION mirror_chat_report_as_complaint() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  sender UUID;
  target UUID;
BEGIN
  SELECT sender_id INTO sender FROM ride_chat_messages WHERE id = NEW.message_id;
  IF sender IS NULL
     OR sender = NEW.reporter_id
     OR NOT EXISTS (SELECT 1 FROM riders WHERE ride_id = NEW.ride_id AND user_id = NEW.reporter_id)
     OR NOT EXISTS (SELECT 1 FROM riders WHERE ride_id = NEW.ride_id AND user_id = sender) THEN
    RETURN NEW;
  END IF;

  INSERT INTO complaints (
    legacy_reference, ride_id, complainant_id, accused_id, category, description, source,
    created_at, updated_at
  )
  VALUES (
    NEW.reference, NEW.ride_id, NEW.reporter_id, sender, 'other', NEW.reason, 'chat_report',
    NEW.created_at, NEW.created_at
  )
  ON CONFLICT ON CONSTRAINT complaints_once DO NOTHING;

  SELECT id INTO target FROM complaints
  WHERE complainant_id = NEW.reporter_id AND ride_id = NEW.ride_id AND accused_id = sender;

  INSERT INTO complaint_chat_messages (complaint_id, message_id)
  VALUES (target, NEW.message_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Chat report % was not copied to complaints: %', NEW.reference, SQLERRM;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ride_chat_complaints_mirror') THEN
    CREATE TRIGGER ride_chat_complaints_mirror
      AFTER INSERT ON ride_chat_complaints
      FOR EACH ROW EXECUTE FUNCTION mirror_chat_report_as_complaint();
  END IF;
END $$;
