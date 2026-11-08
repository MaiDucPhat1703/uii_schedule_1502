-- Run once in a NEW Supabase project. No existing tables are dropped.
BEGIN;
CREATE SCHEMA uii;
REVOKE ALL ON SCHEMA uii FROM PUBLIC, anon, authenticated;
SET LOCAL search_path TO uii, pg_temp;
CREATE TABLE admin_users (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE spatial_layouts (
	id text PRIMARY KEY NOT NULL,
	owner_id text NOT NULL,
	name text NOT NULL,
	data text NOT NULL,
	revision integer DEFAULT 1 NOT NULL,
	updated_at text NOT NULL
);

CREATE TABLE seat_bookings (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	seat_id text NOT NULL,
	seat_label text NOT NULL,
	day text NOT NULL,
	start_slot double precision NOT NULL,
	end_slot double precision NOT NULL,
	display_name text NOT NULL,
	organization text NOT NULL,
	status text NOT NULL,
	created_at text NOT NULL
);

CREATE TABLE seat_claims (
	key text PRIMARY KEY NOT NULL,
	booking_id text NOT NULL,
	seat_id text NOT NULL,
	day text NOT NULL,
	slot integer NOT NULL
);

CREATE TABLE spatial_spaces (
	id text PRIMARY KEY NOT NULL,
	owner_id text NOT NULL,
	name text NOT NULL,
	data text NOT NULL,
	revision integer DEFAULT 1 NOT NULL,
	updated_at text NOT NULL
);





CREATE TABLE booking_settings (
	id text PRIMARY KEY NOT NULL,
	data text NOT NULL,
	revision integer DEFAULT 1 NOT NULL
);

CREATE TABLE meeting_rooms (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	campus text NOT NULL,
	capacity integer DEFAULT 0 NOT NULL,
	accepting integer DEFAULT 1 NOT NULL,
	revision integer DEFAULT 1 NOT NULL
);

ALTER TABLE seat_bookings ADD email text DEFAULT '' NOT NULL;
ALTER TABLE seat_bookings ADD phone text DEFAULT '' NOT NULL;
ALTER TABLE seat_bookings ADD leader text DEFAULT '' NOT NULL;
ALTER TABLE seat_bookings ADD subject text DEFAULT '' NOT NULL;
ALTER TABLE seat_bookings ADD description text DEFAULT '' NOT NULL;
ALTER TABLE seat_bookings ADD group_type text DEFAULT '' NOT NULL;
ALTER TABLE seat_bookings ADD attendees integer DEFAULT 1 NOT NULL;
ALTER TABLE seat_bookings ADD resource_type text DEFAULT 'seat' NOT NULL;
ALTER TABLE seat_bookings ADD campus text DEFAULT '' NOT NULL;
ALTER TABLE seat_bookings ADD start_minute integer;
ALTER TABLE seat_bookings ADD end_minute integer;
ALTER TABLE seat_bookings ADD admin_note text DEFAULT '' NOT NULL;
ALTER TABLE seat_bookings ADD seat_ids text;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA uii FROM PUBLIC, anon, authenticated;
COMMIT;
