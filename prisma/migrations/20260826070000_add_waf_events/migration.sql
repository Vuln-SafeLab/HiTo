-- CreateTable
CREATE TABLE `waf_events` (
    `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    `eventId` TEXT NOT NULL,
    `at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `ruleId` TEXT NOT NULL,
    `action` TEXT NOT NULL,
    `ip` TEXT NOT NULL,
    `path` TEXT NOT NULL,
    `method` TEXT NOT NULL,
    `ua` TEXT NOT NULL,
    `sample` TEXT,
    `count` INTEGER NOT NULL DEFAULT 1,
    `acknowledgedAt` DATETIME
);

-- Indexes
CREATE INDEX `waf_events_at_idx` ON `waf_events`(`at`);
CREATE INDEX `waf_events_ruleId_at_idx` ON `waf_events`(`ruleId`, `at`);
CREATE INDEX `waf_events_acknowledgedAt_idx` ON `waf_events`(`acknowledgedAt`);
