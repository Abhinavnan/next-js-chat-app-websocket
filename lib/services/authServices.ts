import jwt from 'jsonwebtoken';
import { Socket } from "socket.io";
import { jwtSecret } from '@/lib/config/config.js';
import { logger } from '@/lib/services/logger.js';
import { getUserDetailsById } from '@/lib/services/userServices.js';

const validateTokenServerSide = async (socket: Socket, next: () => void) => {
    const cookies = socket.data.cookies;
    const authToken = cookies.authToken;
    const sessionId = cookies.sessionId;
    const refreshId = cookies.refreshId;
    const deviceInfo = socket.data.deviceInfo;
    if (!authToken) {
        logger.warn('Missing authToken in cookies', deviceInfo);
        return socket.disconnect(true);
    }
    let userId;
    try {
        const decoded = jwt.verify(authToken, jwtSecret) as any;
        userId = decoded.userId;
    } catch (err) {
        logger.warn('Invalid authToken', { error: err, ...deviceInfo });
        return socket.disconnect(true);
    }
    if (!userId) {
        logger.warn('Invalid session', { ...deviceInfo, sessionId, refreshId });
        return socket.disconnect(true);
    }
    const userData = await getUserDetailsById(userId);
    const userDetails = { ...userData, ...deviceInfo, userId, sessionId };
    socket.data.userDetails = userDetails;
    next();
}

export { validateTokenServerSide };

