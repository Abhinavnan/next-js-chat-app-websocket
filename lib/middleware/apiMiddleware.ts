import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import requestIp from "request-ip";
import { UAParser } from "ua-parser-js"
import HttpError from "@/lib/models/httpError.js";
import { logger } from "@/lib/services/logger.js";
import { jwtSecret } from "@/lib/config/config.js";
import { getUserDetailsById } from "@/lib/services/userServices.js";

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const { authToken, sessionId, refreshId } = req.cookies;
    const userAgent = UAParser(req.headers['user-agent']);
    const ipAddressRow = requestIp.getClientIp(req) || '';
    const ipAddress = ipAddressRow === '::1' ? '127.0.0.1' : ipAddressRow.replace(/^::ffff:/, '');
    const { browser, os, device } = userAgent;
    const deviceName = [browser.name, browser.version, os.name, os.version, device.vendor, device.model].join(' ');
    const deviceInfo = { ipAddress, deviceName };

    if (!authToken) {
        throw new HttpError('Missing authToken in cookies.', 401);
    }
    let userId;
    if (authToken) {
        try {
            const decoded = jwt.verify(authToken, jwtSecret) as any;
            userId = decoded.userId;
        } catch (err) {
            logger.warn('Invalid authToken', { error: err, ...deviceInfo, sessionId, refreshId });
            throw new HttpError('Invalid authToken.', 401);
        }
    }
    const userData = await getUserDetailsById(userId) || {};
    const userDetails = { ...userData, ...deviceInfo, userId, sessionId };
    req.cookies = { ...req.cookies, deviceInfo, deviceName, userAgent, ipAddress, userDetails };
    next();
};

export { authMiddleware };