// IndexedDB wrapper for analytics storage
// Async, scalable, future-ready for cloud sync

const DB_NAME = 'nopause_analytics';
const DB_VERSION = 1;

const STORES = {
    events: 'events',
    sessionMetrics: 'session_metrics',
    dailyRollups: 'daily_rollups',
    weeklyRollups: 'weekly_rollups',
};

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORES.events)) {
                const store = db.createObjectStore(STORES.events, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('event', 'event', { unique: false });
                store.createIndex('sessionId', 'sessionId', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.sessionMetrics)) {
                const store = db.createObjectStore(STORES.sessionMetrics, { keyPath: 'sessionId' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('mode', 'mode', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.dailyRollups)) {
                db.createObjectStore(STORES.dailyRollups, { keyPath: 'date' });
            }

            if (!db.objectStoreNames.contains(STORES.weeklyRollups)) {
                db.createObjectStore(STORES.weeklyRollups, { keyPath: 'weekStart' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            console.warn('IndexedDB open failed, analytics will be limited:', request.error);
            reject(request.error);
        };
    });

    return dbPromise;
}

export const analyticsStore = {
    async write(storeName, data) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                store.put(data);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn(`analyticsStore.write(${storeName}) failed:`, e);
        }
    },

    async get(storeName, key) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('analyticsStore.get failed:', e);
            return null;
        }
    },

    async getAll(storeName) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('analyticsStore.getAll failed:', e);
            return [];
        }
    },

    async getByIndex(storeName, indexName, value) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const index = tx.objectStore(storeName).index(indexName);
                const req = index.getAll(value);
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('analyticsStore.getByIndex failed:', e);
            return [];
        }
    },

    async deleteOlderThan(storeName, indexName, cutoff) {
        try {
            const db = await openDB();
            const tx = db.transaction(storeName, 'readwrite');
            const index = tx.objectStore(storeName).index(indexName);
            const range = IDBKeyRange.upperBound(cutoff);

            return new Promise((resolve, reject) => {
                const req = index.openCursor(range);
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('analyticsStore.deleteOlderThan failed:', e);
        }
    },

    async count(storeName) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).count();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            return 0;
        }
    },

    // ═══════════════════════════════════════════
    // Cloud Sync Interface (pluggable adapter)
    // ═══════════════════════════════════════════

    _syncAdapter: null,

    // Plug in a cloud sync adapter. Adapter must implement:
    //   async push(storeName, records) → void
    //   async pull(storeName, since) → records[]
    setSyncAdapter(adapter) {
        this._syncAdapter = adapter;
    },

    // Get all records with _syncStatus === 'local'
    async getUnsynced(storeName) {
        try {
            const all = await this.getAll(storeName);
            return all.filter(r => r._syncStatus === 'local');
        } catch (e) {
            return [];
        }
    },

    // Mark records as synced
    async markSynced(storeName, ids) {
        try {
            const db = await openDB();
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            for (const id of ids) {
                const req = store.get(id);
                await new Promise((resolve, reject) => {
                    req.onsuccess = () => {
                        const record = req.result;
                        if (record) {
                            record._syncStatus = 'synced';
                            store.put(record);
                        }
                        resolve();
                    };
                    req.onerror = () => reject(req.error);
                });
            }

            await new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('markSynced failed:', e);
        }
    },

    // Push unsynced records to cloud via adapter
    // No-op if no adapter is set (local-only mode)
    async sync() {
        if (!this._syncAdapter) return { synced: 0, status: 'no_adapter' };

        let totalSynced = 0;
        const syncableStores = [
            STORES.sessionMetrics,
            STORES.dailyRollups,
            STORES.weeklyRollups,
        ];

        for (const storeName of syncableStores) {
            try {
                const unsynced = await this.getUnsynced(storeName);
                if (unsynced.length === 0) continue;

                await this._syncAdapter.push(storeName, unsynced);

                // Determine the key field for each store
                const keyField = storeName === STORES.sessionMetrics ? 'sessionId'
                    : storeName === STORES.dailyRollups ? 'date'
                        : 'weekStart';
                const ids = unsynced.map(r => r[keyField]);
                await this.markSynced(storeName, ids);
                totalSynced += unsynced.length;
            } catch (e) {
                console.warn(`Sync failed for ${storeName}:`, e);
            }
        }

        return { synced: totalSynced, status: 'ok' };
    },

    STORES,
};
