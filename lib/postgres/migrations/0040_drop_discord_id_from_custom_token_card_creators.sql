-- Migration: Drop redundant discord_id from custom_token_card_creators
-- The creator's personal Discord ID is already on users.discord_id for any
-- Discord-auth'd user. Duplicating it on the creator profile invites drift.
-- The discord_invite_url column stays — that represents the creator's
-- community server invite, which is a distinct concept.

ALTER TABLE "custom_token_card_creators" DROP COLUMN "discord_id";
