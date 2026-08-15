import nodeCache from 'node-cache';

const cache = new nodeCache({ stdTTL: 3600, checkperiod: 120 });

const getCache = (key: string) => cache.get(key);
const setCache = (key: string, value: any, ttl: number = 1800) => cache.set(key, value, ttl);
const deleteCache = (key: string) => cache.del(key);

export { getCache, setCache, deleteCache };