-- Migration: Rename tickets.weighment_id to tickets.automatic_weighment_id
ALTER TABLE IF EXISTS tickets RENAME COLUMN weighment_id TO automatic_weighment_id;
ALTER INDEX IF EXISTS idx_tickets_weighment RENAME TO idx_tickets_automatic_weighment;
