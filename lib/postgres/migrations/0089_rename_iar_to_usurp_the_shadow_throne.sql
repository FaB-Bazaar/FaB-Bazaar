-- 0089: IAR's real name was announced — "Usurp the Shadow Throne". The row
-- was registered during spoiler season as the "Íarathael Preview Cards"
-- placeholder (drift handling). The constants snapshot
-- (lib/fab-constants/sets-data.generated.ts) already carries the new name;
-- this keeps the sets table (the source of truth) in step on deploy.
-- Idempotent: WHERE clause only matches the placeholder name.

UPDATE sets
   SET name = 'Usurp the Shadow Throne'
 WHERE code = 'iar'
   AND name = 'Íarathael Preview Cards';
