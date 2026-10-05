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
  CONSTRAINT riders_ride_user_unique UNIQUE (ride_id, user_id)
);

-- When the person got their seat: when the owner created the ride, or when a rider's
-- request was accepted. It orders the fare split (Table T-2: owner first, then riders
-- in the order they were accepted), so a riders row must be inserted on acceptance.
-- Added after the table, so existing databases get it too.
ALTER TABLE riders ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT now();

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
