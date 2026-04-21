import conn from "../database/Connection.js";

class DownloadRepository {

    constructor() {
        this.db = conn.getDb();
    }

    // all vids
    findAll(page = 1, limit = 10) {

        const offset = (page - 1) * limit;

        const stmt = this.db.prepare(`
            SELECT * FROM downloads
            WHERE is_active = 1 
            ORDER BY downloaded_at DESC
            LIMIT ? OFFSET ?
        `);

        const data = stmt.all(limit, offset);

        const total = this.db.prepare(`
                SELECT COUNT(*) as count FROM downloads
            `).get().count;

        return {
            data,
            pagination: {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total
            }
        }
    }

    // DownloadRepository.js

    findByUrl(url) {
        // CORRECCIÓN: Usar AND en lugar de && y un solo WHERE
        const stmt = this.db.prepare('SELECT * FROM downloads WHERE url = ? AND is_active = 1');
        return stmt.get(url);
    }

    searchByTitle(searchTerm) {
        // CORRECCIÓN: El WHERE va antes del ORDER BY
        const stmt = this.db.prepare(`
        SELECT * FROM downloads 
        WHERE title LIKE ? AND is_active = 1 
        ORDER BY downloaded_at DESC
    `);
        return stmt.all(`%${searchTerm}%`);
    }

    // Asegúrate de que saveVideo también incluya la columna si quieres
    saveVideo(data) {
        const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO downloads(title, url, description, channel, duration, thumbnail, file_path, views, is_active)
        VALUES(?,?,?,?,?,?,?,?,1)
    `);

        return stmt.run(
            data.title, data.url, data.description, data.channel, data.duration, data.thumbnail, data.file_path, data.views
        );
    }

    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM downloads WHERE id = ?');
        return stmt.get(id);
    }

    deleteVideo(id) {
        return this.db.prepare('UPDATE downloads SET is_active = 0 WHERE id = ?').run(id);
    }

    updatePosition(id, seconds) {
        const stmt = this.db.prepare('UPDATE downloads SET last_position = ? WHERE id = ?');
        return stmt.run(Math.floor(seconds), id);
    }

    resetDatabase() {
        return this.db.prepare('UPDATE downloads SET is_active = 0').run();
    }
}

export const downloadRepository = new DownloadRepository();

/**
 * OFFSET=(paˊgina−1)×lıˊmite
 *  Página	Límite	Offset (Saltar)	Resultado
 *   1	10	0	Registros del 1 al 10
 *   2	10	10	Registros del 11 al 20
 *   3	10	20	Registros del 21 al 30
 */