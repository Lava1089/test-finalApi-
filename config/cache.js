// Simple in-memory cache implementation
class Cache {
    constructor() {
        this.store = new Map();
    }

    async getOrSet(fetchFunction, key, duration = 3600) {
        const now = Date.now();
        const cached = this.store.get(key);

        if (cached && now < cached.expires) {
            return cached.value;
        }

        const value = await fetchFunction();
        this.store.set(key, {
            value,
            expires: now + (duration * 1000)
        });

        // Clean up expired items
        this.cleanup();

        return value;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, value] of this.store.entries()) {
            if (now >= value.expires) {
                this.store.delete(key);
            }
        }
    }

    clear() {
        this.store.clear();
    }
}

const cache = new Cache();

module.exports = {
    cache
};