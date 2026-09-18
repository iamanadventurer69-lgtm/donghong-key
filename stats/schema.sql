-- 一台设备一行：里程碑用 MAX() 幂等叠加，重复上报不会把数字算大
CREATE TABLE IF NOT EXISTS devices (
  device TEXT PRIMARY KEY,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  start INTEGER NOT NULL DEFAULT 0,
  learn INTEGER NOT NULL DEFAULT 0,
  test INTEGER NOT NULL DEFAULT 0,
  games INTEGER NOT NULL DEFAULT 0,
  finish INTEGER NOT NULL DEFAULT 0,
  finish_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_devices_first ON devices(first_at);
CREATE INDEX IF NOT EXISTS idx_devices_finish ON devices(finish_at);
