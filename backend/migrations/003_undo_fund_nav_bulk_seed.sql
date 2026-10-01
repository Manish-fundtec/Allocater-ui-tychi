-- Run only if you already ran an older 002 that inserted initial_nav = 10 for every fund.
-- Removes auto-seeded rows so NAV comes only from manual seed or explicit config.
DELETE FROM fund_nav_config;
