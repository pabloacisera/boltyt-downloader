import { app } from "electron";
import Database from "better-sqlite3";
import { join } from "path";
import fs from "fs";

class Connection {
    constructor( ) {
        // Obtenemos la ruta estándar de datos de usuario para esta app
        const userDataPath = app.getPath('userData');
        
        // Si la carpeta no existe (raro, pero posible en desarrollo), la creamos
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }

        this.dbPath = join(userDataPath, "downloads.sqlite");
        this.db = null; 
        console.log("Ruta de DB establecida en:", this.dbPath);
    }

    connect( ) {
        this.db = new Database(this.dbPath);
        // ejecutamos el metodo para crear tabla
        this.createTables();
        console.log("Base de datos conectada >->->")
        return this.db;

    }

    createTables( ) {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS downloads(
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                url             TEXT UNIQUE,
                title           TEXT,
                channel         TEXT,
                duration        INTEGER,
                description     TEXT,
                thumbnail       TEXT,
                views           INTEGER,
                file_path       TEXT,
                last_position   INTEGER DEFAULT 0,
                is_active       INTEGER DEFAULT 1,
                downloaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            `);

        // Intento de migración manual para bases de datos existentes
        try {
            this.db.exec("ALTER TABLE downloads ADD COLUMN last_position INTEGER DEFAULT 0");
            console.log("Migración: Columna last_position añadida.");
        } catch (e) {
            // Si el error es porque la columna ya existe, lo ignoramos silenciosamente
            if (!e.message.includes("duplicate column name")) {
                console.warn("Aviso de migración:", e.message);
            }
        }

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings(
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                key             TEXT UNIQUE,
                value           TEXT
            )
        `);
    }

    getDb() {
        if(!this.db) {
            return this.connect();
        }
        return this.db;
    }

    close() {
        if(this.db) {
            this.db.close( );
        }
    }
}

export default new Connection( );