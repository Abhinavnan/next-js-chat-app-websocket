import jwt from 'jsonwebtoken';
import { Socket } from "socket.io";
import { jwtSecret } from '@/lib/config/config';
import { logger } from '@/lib/services/logger';
import { getUserSessionDetails, getUserDetailsById } from '@/lib/services/userServices';

const validateTokenServerSide = async (socket: Socket, next: () => void) => {
    const cookies = socket.data.cookies;
    const authToken = cookies.authToken;
    const sessionId = cookies.sessionId;
    const refreshId = cookies.refreshId;
    const deviceInfo = socket.data.deviceInfo;
    if (!(authToken || (sessionId && refreshId))) {
        logger.warn('Missing authToken or sessionId in cookies', deviceInfo);
        return socket.disconnect(true);
    }
    let userId, sessionDetails;
    if (authToken) {
        try {
            const decoded = jwt.verify(authToken, jwtSecret) as any;
            userId = decoded.userId;
        } catch (err) {
            logger.warn('Invalid authToken', { error: err, ...deviceInfo });
            return socket.disconnect(true);
        }
    }
    if (!authToken && sessionId && refreshId) {
        sessionDetails = await getUserSessionDetails(sessionId, refreshId);
        userId = sessionDetails?.userId;
    }
    if (!sessionDetails && !userId) {
        logger.warn('Invalid sessionId', { ...deviceInfo, sessionId, refreshId });
        return socket.disconnect(true);
    }
    const userData = await getUserDetailsById(userId);
    const userDetails = { ...userData, ...deviceInfo, userId, sessionId };
    socket.data.userDetails = userDetails;
    next();
}

export { validateTokenServerSide };

