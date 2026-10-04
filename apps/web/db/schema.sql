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
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

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
  CONSTRAINT riders_ride_user_unique UNIQUE (ride_id, user_id)
);

CREATE INDEX IF NOT EXISTS riders_ride_idx
  ON riders(ride_id);

-- Initial configurable locations. Stable IDs match the current Create Ride form
-- values so the UI can later read these records directly from the database.
INSERT INTO locations (id, name, detail, type, is_active)
VALUES
  ('hall-1', 'Hall 1', NULL, 'campus', TRUE),
  ('hall-2', 'Hall 2', NULL, 'campus', TRUE),
  ('hall-3', 'Hall 3', NULL, 'campus', TRUE),
  ('hall-4', 'Hall 4', NULL, 'campus', TRUE),
  ('hall-5', 'Hall 5', NULL, 'campus', TRUE),
  ('hall-6', 'Hall 6', NULL, 'campus', TRUE),
  ('hall-7', 'Hall 7', NULL, 'campus', TRUE),
  ('hall-8', 'Hall 8', NULL, 'campus', TRUE),
  ('hall-9', 'Hall 9', NULL, 'campus', TRUE),
  ('hall-10', 'Hall 10', NULL, 'campus', TRUE),
  ('hall-11', 'Hall 11', NULL, 'campus', TRUE),
  ('hall-12', 'Hall 12', NULL, 'campus', TRUE),
  ('hall-13', 'Hall 13', NULL, 'campus', TRUE),
  ('hall-14', 'Hall 14', NULL, 'campus', TRUE),
  ('main-gate', 'Main Gate', NULL, 'campus', TRUE),
  ('kanpur-central', 'Kanpur Central', 'Railway station', 'transport_hub', TRUE),
  ('kanpur-anwarganj', 'Kanpur Anwarganj', 'Railway station', 'transport_hub', TRUE),
  ('bus-stand', 'Bus stand', 'Kanpur', 'transport_hub', TRUE),
  ('metro-station', 'Metro station', 'Kanpur Metro', 'transport_hub', TRUE),
  ('kanpur-airport', 'Kanpur airport', 'Airport', 'transport_hub', TRUE),
  ('lucknow-airport', 'Lucknow airport', 'Airport', 'transport_hub', TRUE)
ON CONFLICT (id) DO NOTHING;


INSERT INTO vehicle_types (id, name, capacity, is_active)
VALUES
  ('car', 'Car', 4, TRUE),
  ('auto', 'Auto', 3, TRUE),
  ('vikram', 'Vikram', 7, TRUE)
ON CONFLICT (id) DO NOTHING;
