import conn from "../database/Connection.js";

class SettingsRepository {
    constructor() {
        this.db = conn.getDb();
    }

    get(key) {
        const stmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
        const row = stmt.get(key);
        return row ? row.value : null;
    }

    set(key, value) {
        const stmt = this.db.prepare(`
            INSERT INTO settings (key, value) 
            VALUES (?, ?) 
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        return stmt.run(key, value);
    }
}

export const settingsRepository = new SettingsRepository();
