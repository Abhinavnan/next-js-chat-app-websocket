import mongoose from 'mongoose';
import dns from 'dns';
import { mongoDBConnectionURL } from '@/lib/config/config.js';
import { logger } from '@/lib/services/logger.js';

if (!mongoDBConnectionURL) {
    logger.error('MONGODB_CONNECTION_URL is not defined');
    throw new Error('MONGODB_CONNECTION_URL is not defined');
}

// Extend the global type to hold our cached connection
declare global {
    var mongooseCache: {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
    } | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
    cached = global.mongooseCache = { conn: null, promise: null };
}

async function connectToDatabase(): Promise<typeof mongoose> {
    if (cached!.conn) {
        return cached!.conn;
    }
    if (!cached!.promise) {
        logger.info('MongoDB connection dns servers:', dns.getServers());
        cached!.promise = mongoose.connect(mongoDBConnectionURL as string, { bufferCommands: false, serverSelectionTimeoutMS: 5000 })
            .then((mongooseInstance) => {
                logger.info('Connected to MongoDB');
                return mongooseInstance;
            });
    }
    try {
        cached!.conn = await cached!.promise;
    } catch (err) {
        cached = global.mongooseCache = { conn: null, promise: null };
        dns.setServers(['8.8.8.8', '1.1.1.1']); //To solve mongodb connection error
        logger.error('Error connecting to MongoDB', err);
        throw err;
    }
    return cached!.conn;
}

export default connectToDatabase;
