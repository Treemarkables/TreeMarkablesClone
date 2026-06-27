-- Per-business speech-to-quote vocabulary (trade-gen).
-- The Whisper transcription bias + transcript-cleanup prompt hardcoded NZ tree
-- species + arborist operations, so a non-tree tenant's walkthroughs were biased
-- toward tree terms. Move the vocab to a per-business field and seed Treemarkables
-- with its exact current list so its transcription is byte-for-byte unchanged.
-- Blank for everyone else → a generic field-service bias (they add their own).
-- Idempotent. Also applied at boot (server/index.ts).

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS trade_vocabulary TEXT DEFAULT '';

UPDATE business_settings
   SET trade_vocabulary = 'New Zealand tree services walkthrough. Species: pohutukawa, manuka, kanuka, kauri, totara, rimu, kahikatea, miro, tawa, rewarewa, kowhai, ribbonwood, pittosporum, cabbage tree, ti kouka, gleditsia, magnolia, oak, pine, eucalyptus, gum tree, macrocarpa, leyland cypress, willow, poplar, silver birch, plum. Operations: prune, lift, crown reduction, deadwood, remove, fell, dismantle, stump grind, mulch, chip, firewood lengths, cleanup.'
 WHERE business_name = 'Treemarkables'
   AND (trade_vocabulary IS NULL OR trade_vocabulary = '');
