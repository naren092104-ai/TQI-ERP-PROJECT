-- Store multiple targeted panchayat/village locations on an academic session day.
ALTER TABLE sessions
  ADD COLUMN target_locations_json JSON NULL AFTER village_id;
