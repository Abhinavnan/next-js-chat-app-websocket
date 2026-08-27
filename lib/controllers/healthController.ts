import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Request, Response, NextFunction } from "express";
import connectToDatabase from "@/lib/database/mongoose.js";
import HttpError from "@/lib/models/httpError.js";
import { logger } from "@/lib/services/logger.js";
import { User } from "@/lib/models/databaseModels.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const checkHealth = async (req: Request, res: Response, next: NextFunction) => {
    const timestamp = dayjs().toISOString();
    const indianTimestamp = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD hh:mm:ss A');
    res.status(200).json({ message: 'Server is running', timestamp, indianTimestamp });
};

const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    let details = {};
    try {
        await connectToDatabase();
        const [verifiedUserCount, onlineUserCount] = await Promise.all([
            User.countDocuments({ verified: true }), User.countDocuments({ status: 'online' })
        ]);
        details = { verifiedUserCount, onlineUserCount };
    } catch (err) {
        logger.error('Error in getting analytics', err);
        throw new HttpError('Error in getting analytics', 500);
    }
    res.status(200).json(details);
};

export { checkHealth, getAnalytics };