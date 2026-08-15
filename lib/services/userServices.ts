import zod from "zod";
import dayjs from "dayjs";
import { Socket } from "socket.io";
import connectToDatabase from "@/lib/database/mongoose.js";
import { getCache, setCache, deleteCache } from "@/lib/services/cacheServices.js";
import { User, UserSession } from "@/lib/models/databaseModels.js";
import { logger } from "@/lib/services/logger.js";
import { UserDetails, StatusInfo } from "@/lib/types/types.js";
import { parseZodError } from "./utilityServices.js";
import { getAllChatRooms, checkChatRoom } from "./chatServices.js";
import { getReceiverDetailsByIndex } from "./contactServices.js";

const userStatusSchema = zod.object({
    status: zod.enum(['away', 'online', 'offline'], { message: 'Invalid status' }),
    lastSeenTime: zod.string().datetime({ message: "Invalid ISO 8601 date format" })
});

const getUserDetailsByEmail = async (email: string) => {
    let user = null;
    try {
        await connectToDatabase();
        const result = await User.findOne({ email }, '-contacts').lean();
        const { _id, __v, ...rest } = result || {};
        user = _id ? { id: _id.toString(), ...rest } : null;
    } catch (err) {
        logger.error('Error getting user details by email', err);
        return null;
    }
    return user;
}

const getUserDetailsById = async (id: string) => {
    let user;
    user = getCache(`user-${id}`) as UserDetails;
    if (user) {
        return user;
    }
    try {
        await connectToDatabase();
        const result = await User.findById(id, '-password -contacts').lean();
        const { _id, __v, ...rest } = result || {};
        user = _id ? { id: _id.toString(), ...rest } : null;
    } catch (err) {
        logger.error('Error getting user details by id', err);
    }
    if (user) {
        setCache(`user-${id}`, user);
    }
    return user;
}

const checkSessionValidity = (sessionDetails: Record<string, any>, refreshId: string) => {
    if (!sessionDetails) {
        return 'invalid';
    }
    const isSessionExpired = dayjs(sessionDetails.expiresTime).isBefore(dayjs());
    if (sessionDetails.refreshId === refreshId && !isSessionExpired) {
        return 'active';
    }
    if (isSessionExpired && sessionDetails.refreshId === refreshId) {
        return 'expired';
    }
    return 'invalid';
}

const getUserSessionDetails = async (sessionId: string, refreshId: string) => {
    let sessionDetails: Record<string, any> | null = null;
    sessionDetails = getCache(`user-session-${sessionId}`) || {};
    let sessionValidity = checkSessionValidity(sessionDetails, refreshId);
    if (sessionValidity === 'active') {
        return sessionDetails;
    }
    if (sessionValidity === 'expired') {
        deleteCache(`user-session-${sessionId}`);
        return null;
    }
    try {
        await connectToDatabase();
        const result = await UserSession.findById(sessionId);
        sessionDetails = result ? result.toObject({ getters: true }) : null;
        sessionDetails = { ...sessionDetails, userId: sessionDetails?.userId.toString(), _id: sessionDetails?._id.toString() };
    } catch (err) {
        logger.error('Error getting user session details', err);
        return null;
    }
    if (!sessionDetails) {
        return null;
    }
    sessionValidity = checkSessionValidity(sessionDetails, refreshId);
    if (sessionValidity === 'active') {
        setCache(`user-session-${sessionId}`, sessionDetails);
    }
    return sessionDetails;
};

const updateUserStatus = async (userId: string, data: StatusInfo) => {
    const parsedInfo = userStatusSchema.safeParse(data);
    if (!parsedInfo.success) {
        logger.error('Error updating user status', { error: parseZodError(parsedInfo) });
        return null;
    }
    let user = await getUserDetailsById(userId) as UserDetails;
    const { status, lastSeenTime } = parsedInfo.data;
    const isStatusExpired = (dayjs(user.lastSeenTime || 0).valueOf() + 300000) < dayjs(lastSeenTime).valueOf(); // 5 minutes
    if (user.status === status || !isStatusExpired) {
        user = { ...user, status, lastSeenTime };
        setCache(`user-${userId}`, user, 3600);
        return user;
    }
    const newStatus = { status, lastSeenTime: status === 'online' ? lastSeenTime : user.lastSeenTime }
    try {
        await connectToDatabase();
        const result = await User.findByIdAndUpdate(userId, { $set: newStatus }, { runValidators: true, returnDocument: 'after' })
            .select('-password -contacts').lean();
        const { _id, __v, ...rest } = result || {};
        user = _id ? { id: _id.toString(), ...rest } as UserDetails : user;
    } catch (err) {
        logger.error('Error updating user status', err);
    }
    if (user) {
        setCache(`user-${userId}`, user, 3600);
    }
    return user;
}

const handleUpdateUserStatus = async (socket: Socket, userId: string, data: StatusInfo) => {
    const updatedStatus = await updateUserStatus(userId, data) as UserDetails;
    if (!updatedStatus) {
        return null;
    }
    const { status, lastSeenTime, email } = updatedStatus;
    const chatRooms = await getAllChatRooms(userId);
    if (chatRooms.length > 0) {
        socket.to(chatRooms).emit('get-user-status', email, { status, lastSeenTime });
        socket.join(chatRooms);
    }
    return { status, lastSeenTime };
}

const handleCheckUserStatus = async (socket: Socket, userId: string, index: number) => {
    const receiver = await getReceiverDetailsByIndex(userId, index);
    if (!receiver) {
        logger.warn('Receiver not found', { userId, index });
        return null;
    }
    const receiverId = receiver.id;
    const { lastSeenTime, status } = await getUserDetailsById(receiverId) as UserDetails;
    const isStatusExpired = (dayjs(lastSeenTime || 0).valueOf() + 300000) < dayjs().valueOf();
    const upatedLastSeenTime = dayjs(lastSeenTime || 0).toISOString();
    let newStatus = { status, lastSeenTime: upatedLastSeenTime } as StatusInfo;
    if (isStatusExpired && status !== 'offline') {
        newStatus.status = 'offline';
        await handleUpdateUserStatus(socket, receiverId, newStatus);
    }
    const chatRoomId = await checkChatRoom(socket, 'roomId', userId, receiverId);
    if (chatRoomId) {
        socket.join(chatRoomId as string);
    }
    if (chatRoomId && isStatusExpired) {
        socket.to(chatRoomId as string).emit('ping-user');
    }
    return newStatus;
}

export { getUserDetailsByEmail, getUserDetailsById, getUserSessionDetails, handleUpdateUserStatus, handleCheckUserStatus };