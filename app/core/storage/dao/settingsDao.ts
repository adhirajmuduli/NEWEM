import Database from 'better-sqlite3';

export type SettingValue = unknown;

export function getSetting<T = SettingValue>(db: Database.Database, key: string, defaultValue?: T): T | undefined {
  const row = db.prepare(`SELECT value_json FROM settings WHERE key=?`).get(key) as { value_json: string } | undefined;
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return defaultValue;
  }
}

export function setSetting(db: Database.Database, key: string, value: SettingValue) {
  const json = JSON.stringify(value);
  db.prepare(
    `INSERT INTO settings(key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`
  ).run(key, json);
}

export interface LayoutSetting {
  panels: Array<{ id: string; x: number; y: number; w: number; h: number }>;
}

export type ThemeMode = 'light' | 'dark';

export function getShowSeen(db: Database.Database) {
  return Boolean(getSetting<boolean>(db, 'show_seen_news', false));
}

export function setShowSeen(db: Database.Database, show: boolean) {
  setSetting(db, 'show_seen_news', !!show);
}

export function getThemeMode(db: Database.Database): ThemeMode {
  return (getSetting<string>(db, 'theme_mode', 'light') as ThemeMode) ?? 'light';
}

export function setThemeMode(db: Database.Database, mode: ThemeMode) {
  setSetting(db, 'theme_mode', mode);
}

export function getLayout(db: Database.Database) {
  return getSetting<LayoutSetting>(db, 'layout', { panels: [] });
}

export function setLayout(db: Database.Database, layout: LayoutSetting) {
  setSetting(db, 'layout', layout);
}

export {};
