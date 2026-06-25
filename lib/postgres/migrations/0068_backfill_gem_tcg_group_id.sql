-- 0068: backfill printings.tcg_group_id for the GEM packs.
--
-- Data migration companion to 0067. The pack each GEM printing belongs to is
-- derived from tcgcsv (collector_number -> TCGplayer group id; every GEM
-- number resolves to exactly one pack). The mapping is materialized here as
-- static UPDATEs so prod is populated on deploy without manual psql or a
-- network call during migration. Future packs: re-run
-- scripts/backfill-gem-tcg-groups.ts and add the next data migration.

-- GEM Pack 1 (32 collector numbers)
UPDATE printings SET tcg_group_id = 24176, updated_at = now()
 WHERE set = 'gem' AND tcg_group_id IS NULL AND collector_number IN ('GEM001', 'GEM002', 'GEM003', 'GEM004', 'GEM005', 'GEM006', 'GEM007', 'GEM008', 'GEM009', 'GEM010', 'GEM011', 'GEM012', 'GEM013', 'GEM014', 'GEM015', 'GEM016', 'GEM017', 'GEM018', 'GEM019', 'GEM020', 'GEM021', 'GEM022', 'GEM023', 'GEM024', 'GEM025', 'GEM026', 'GEM027', 'GEM028', 'GEM029', 'GEM030', 'GEM031', 'GEM032');

-- GEM Pack 2 (36 collector numbers)
UPDATE printings SET tcg_group_id = 24334, updated_at = now()
 WHERE set = 'gem' AND tcg_group_id IS NULL AND collector_number IN ('GEM033', 'GEM034', 'GEM035', 'GEM036', 'GEM037', 'GEM038', 'GEM039', 'GEM040', 'GEM041', 'GEM042', 'GEM043', 'GEM044', 'GEM045', 'GEM046', 'GEM047', 'GEM048', 'GEM049', 'GEM050', 'GEM051', 'GEM052', 'GEM053', 'GEM054', 'GEM055', 'GEM056', 'GEM057', 'GEM058', 'GEM059', 'GEM060', 'GEM061', 'GEM062', 'GEM063', 'GEM064', 'GEM065', 'GEM066', 'GEM067', 'GEM068');

-- GEM Pack 3 (36 collector numbers)
UPDATE printings SET tcg_group_id = 24446, updated_at = now()
 WHERE set = 'gem' AND tcg_group_id IS NULL AND collector_number IN ('GEM069', 'GEM070', 'GEM071', 'GEM072', 'GEM073', 'GEM074', 'GEM075', 'GEM076', 'GEM077', 'GEM078', 'GEM079', 'GEM080', 'GEM081', 'GEM082', 'GEM083', 'GEM084', 'GEM085', 'GEM086', 'GEM087', 'GEM088', 'GEM089', 'GEM090', 'GEM091', 'GEM092', 'GEM093', 'GEM094', 'GEM095', 'GEM096', 'GEM097', 'GEM098', 'GEM099', 'GEM100', 'GEM101', 'GEM102', 'GEM103', 'GEM104');

-- GEM Pack 4 (36 collector numbers)
UPDATE printings SET tcg_group_id = 24620, updated_at = now()
 WHERE set = 'gem' AND tcg_group_id IS NULL AND collector_number IN ('GEM105', 'GEM106', 'GEM107', 'GEM108', 'GEM109', 'GEM110', 'GEM111', 'GEM112', 'GEM113', 'GEM114', 'GEM115', 'GEM116', 'GEM117', 'GEM118', 'GEM119', 'GEM120', 'GEM121', 'GEM122', 'GEM123', 'GEM124', 'GEM125', 'GEM126', 'GEM127', 'GEM128', 'GEM129', 'GEM130', 'GEM131', 'GEM132', 'GEM133', 'GEM134', 'GEM135', 'GEM136', 'GEM137', 'GEM138', 'GEM139', 'GEM140');

-- GEM Pack 5 (43 collector numbers)
UPDATE printings SET tcg_group_id = 24720, updated_at = now()
 WHERE set = 'gem' AND tcg_group_id IS NULL AND collector_number IN ('GEM141', 'GEM142', 'GEM143', 'GEM144', 'GEM145', 'GEM146', 'GEM147', 'GEM148', 'GEM149', 'GEM150', 'GEM151', 'GEM152', 'GEM153', 'GEM154', 'GEM155', 'GEM156', 'GEM157', 'GEM158', 'GEM159', 'GEM160', 'GEM161', 'GEM162', 'GEM163', 'GEM164', 'GEM165', 'GEM166', 'GEM167', 'GEM168', 'GEM169', 'GEM170', 'GEM171', 'GEM172', 'GEM173', 'GEM174', 'GEM175', 'GEM176', 'GEM177', 'GEM178', 'GEM179', 'GEM180', 'GEM181', 'GEM182', 'GEM183');

