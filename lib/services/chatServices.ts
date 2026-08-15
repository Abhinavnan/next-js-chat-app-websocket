import zod from "zod";
import { Socket } from "socket.io";
import { ChatRoom } from "@/lib/models/databaseModels";
import connectToDatabase from "@/lib/database/mongoose";
import { getReceiverDetailsByIndex, getUserContacts } from "@/lib/services/contactServices";
import { getCache, setCache, deleteCache } from "@/lib/services/cacheServices";
import { logger } from "@/lib/services/logger";
import { MessageInfo } from "@/lib/types/types";
import { parseZodError, normalizeMessages, sanitiseMessages, sendAPICall } from "./utilityServices";
import { getUserDetailsById } from "./userServices";
import { Chat } from "@/lib/models/databaseModels";

const messageSchema = zod.object({
    refrenceId: zod.string().uuid('Invalid refrenceId'),
    message: zod.string().min(1, 'Message is required').max(5000, 'Message is too long').trim(),
    userSentTime: zod.string().datetime({ message: "Invalid ISO 8601 date format" }),
})

const getChatRoomUserIds = (userId: string, receiverId: string) => {
    if (userId < receiverId) return [userId, receiverId];
    return [receiverId, userId];
}

const getChatRoom = async (userId: string, receiverId: string) => {
    const [user1Id, user2Id] = getChatRoomUserIds(userId, receiverId);
    let chatRoomId = getCache(`chat-room-${user1Id}-${user2Id}`) as String;
    if (chatRoomId) {
        return chatRoomId;
    }
    try {
        await connectToDatabase();
        const result = await ChatRoom.findOne({ user1Id, user2Id }).lean();
        chatRoomId = result ? result._id.toString() : '';
    } catch (err) {
        logger.error('Error getting chat room', err);
    }
    if (chatRoomId) {
        setCache(`chat-room-${user1Id}-${user2Id}`, chatRoomId, 3600);
    }
    return chatRoomId;
}

const createChatRoom = async (userId: string, receiverId: string) => {
    const [user1Id, user2Id] = getChatRoomUserIds(userId, receiverId);
    let chatRoomId;
    try {
        await connectToDatabase();
        const chatRoom = await ChatRoom.create({ user1Id, user2Id });
        chatRoom.toObject({ getters: true });
        chatRoomId = chatRoom.id;
        setCache(`chat-room-${user1Id}-${user2Id}`, chatRoomId, 3600);
        deleteCache(`user-chat-rooms-${userId}`);
        deleteCache(`user-chat-rooms-${receiverId}`);
    } catch (err) {
        logger.error('Error creating chat room', err);
    }
    return chatRoomId;
}

const joinChatRoom = async (socket: Socket, userId: string, index: number) => {
    const receiver = await getReceiverDetailsByIndex(userId, index);
    if (!receiver) {
        logger.warn('Receiver not found', { userId, index });
        return null;
    };
    const existingRoom = await getChatRoom(userId, receiver.id);
    if (existingRoom) {
        socket.join(existingRoom as string);
        return existingRoom;
    }
    const chatRoomId = await createChatRoom(userId, receiver.id);
    if (chatRoomId) {
        socket.join(chatRoomId);

    }
    return chatRoomId;
}

const checkChatRoom = async (socket: Socket, roomId: string, userId: string, receiverId: string) => {
    const existingRoomId = await getChatRoom(userId, receiverId);
    if (existingRoomId === roomId) {
        return roomId;
    }
    if (existingRoomId && existingRoomId !== roomId) {
        socket.emit('update-room', existingRoomId);
        return existingRoomId;
    }
    const newRoomId = await createChatRoom(userId, receiverId);
    if (newRoomId) {
        socket.emit('update-room', newRoomId);
        socket.to(roomId).emit('update-room', newRoomId);
    }
    return newRoomId;
}

const getUnseenMessageCount = async (userId: string, index: number) => {
    const sender = await getReceiverDetailsByIndex(userId, index);
    if (!sender) {
        logger.warn('Sender not found', { userId, index });
        return 0;
    }
    const senderId = sender.id;
    let count = getCache(`unsceen-message-count-${userId}-${senderId}`) as number;
    if (count > -1) {
        return count;
    }
    try {
        await connectToDatabase();
        count = await Chat.countDocuments({ receiverId: userId, senderId, seenTime: { $exists: false } });
    } catch (err) {
        logger.error('Error getting unseen message count', err);
    }
    if (count > -1) {
        setCache(`unsceen-message-count-${userId}-${senderId}`, count, 1800);
    }
    return count;
}

const getunseenMessages = async (socket: Socket, userId: string, index: number) => {
    const receiver = await getReceiverDetailsByIndex(userId, index);
    if (!receiver) {
        logger.warn('Receiver not found', { userId, index });
        return [];
    };
    const unsceenCount = await getUnseenMessageCount(userId, index);
    if (unsceenCount === 0) {
        return [];
    }
    const receiverId = receiver.id;
    try {
        await connectToDatabase();
        const result = await Chat.find({ senderId: receiverId, receiverId: userId, seenTime: { $exists: false } })
            .sort({ _id: -1 }).lean();
        const unseenMessages = result ? normalizeMessages(result) : [];
        const userMessages = sanitiseMessages(unseenMessages, userId);
        socket.emit('update-messages', userMessages);
        return userMessages;
    } catch (err) {
        logger.error('Error getting unseen messages', err);
    }
    return [];
}

const sendMessageError = (socket: Socket, messageDetails: MessageInfo, error: string) => {
    messageDetails.error = error;
    socket.emit('error-message', messageDetails);
}

const updateUnseenMessageCount = async (socket: Socket, roomId: string, userId: string, receiverId: string) => {
    const { contactIdIndexMap } = await getUserContacts(receiverId);
    let senderIndex = contactIdIndexMap.get(userId);
    if (senderIndex === undefined) {
        const { email } = await getUserDetailsById(userId) || {};
        const { index } = await sendAPICall(receiverId, 'patch', '/contact/add', { email }) || {};
        senderIndex = index;
    }
    if (senderIndex === undefined) {
        logger.warn('Sender index not found', { receiverId, senderId: userId });
        return;
    } else {
        deleteCache(`user-contacts-${receiverId}`);
    }
    let count = getCache(`unsceen-message-count-${receiverId}-${userId}`) as number;
    if (count > -1) {
        count++;
        setCache(`unsceen-message-count-${receiverId}-${userId}`, count, 1800);
    } else {
        count = await getUnseenMessageCount(receiverId, senderIndex);
    }
    socket.to(roomId).emit('unseen-message-count', senderIndex, count);
}

const confirmReceiverRoom = async (socket: Socket, roomId: string, userId: string, index: number) => {
    const receiver = await getReceiverDetailsByIndex(userId, index);
    if (!receiver) {
        logger.warn('Receiver not found', { userId, index });
        deleteCache(`user-contacts-${userId}`);
        return null;
    };
    const receiverId = receiver.id;
    let updatedRoom = await checkChatRoom(socket, roomId, userId, receiverId);
    if (!updatedRoom) {
        return null;
    }
    return { updatedRoom, receiverId };
}


const sendMessage = async (socket: Socket, roomId: string, userId: string, index: number, messageDetails: MessageInfo) => {
    const roomDetails = await confirmReceiverRoom(socket, roomId, userId, index);
    if (!roomDetails) {
        sendMessageError(socket, messageDetails, 'Unable to send message\nPlease try again later.');
        return null;
    }
    const { updatedRoom, receiverId } = roomDetails;
    const parsedInput = messageSchema.safeParse(messageDetails);
    if (!parsedInput.success) {
        sendMessageError(socket, messageDetails, parseZodError(parsedInput.error));
        return null;
    }
    const normalizedMessageDetails = parsedInput.data as MessageInfo;
    let messageReport;
    try {
        await connectToDatabase();
        const result = await Chat.create({ ...normalizedMessageDetails, senderId: userId, receiverId });
        const { _id, sentTime, message } = result.toObject({ getters: true });
        messageReport = { id: _id.toString(), sentTime, message };
        socket.to(updatedRoom as string).emit('receive-message', messageReport);
        messageReport = { ...normalizedMessageDetails, ...messageReport }
        socket.emit('update-messages', [messageReport]);
        await updateUnseenMessageCount(socket, updatedRoom as string, userId, receiverId);
    } catch (err) {
        logger.error('Error inserting message to database', err);
        sendMessageError(socket, messageDetails, 'Unable to send message\nPlease try again later.');
    }
    return messageReport;
}

const updateReadReceipts = (socket: Socket, userId: string, senderId: string, updatedRoom: string, updatedMessages: Record<string, any>[]) => {
    const senderMessages = sanitiseMessages(updatedMessages, senderId);
    const userMessages = sanitiseMessages(updatedMessages, userId);
    socket.to(updatedRoom as string).emit('update-messages', senderMessages);
    socket.emit('update-messages', userMessages);
    if (updatedMessages[0].seenTime) {
        deleteCache(`unsceen-message-count-${userId}-${senderId}`);
    }
}

const updateReceivedMessages = async (socket: Socket, roomId: string, userId: string, index: number) => {
    const receivedTime = new Date().toISOString();
    const roomDetails = await confirmReceiverRoom(socket, roomId, userId, index);
    if (!roomDetails) {
        return [];
    }
    const { updatedRoom, receiverId: senderId } = roomDetails;
    let updatedMessages: Record<string, any>[] = [];
    try {
        await connectToDatabase();
        const unreceivedMessages = await Chat.find({ receiverId: userId, senderId, receivedTime: { $exists: false } }).lean();
        if (!unreceivedMessages.length) {
            return updatedMessages;
        }
        const ids = unreceivedMessages.map((m) => m._id);
        await Chat.updateMany({ _id: { $in: ids } }, { $set: { receivedTime } }, { runValidators: true });
        updatedMessages = normalizeMessages(unreceivedMessages.map((m) => ({ ...m, receivedTime })));
        updateReadReceipts(socket, userId, senderId, updatedRoom as string, updatedMessages);
    } catch (err) {
        logger.error('Error updating message received time to database', err);
    }
    return updatedMessages;
}

const updateSeenMessages = async (socket: Socket, roomId: string, userId: string, index: number) => {
    const utcTime = new Date().toISOString();
    const roomDetails = await confirmReceiverRoom(socket, roomId, userId, index);
    if (!roomDetails) {
        return [];
    }
    const { updatedRoom, receiverId: senderId } = roomDetails;
    let updatedMessages: Record<string, any>[] = [];
    try {
        await connectToDatabase();
        const unsceenMessages = await Chat.find({ receiverId: userId, senderId, seenTime: { $exists: false } }).lean();
        if (!unsceenMessages.length) {
            return updatedMessages;
        }
        const ids = unsceenMessages.map((m) => m._id);
        await Chat.updateMany({ _id: { $in: ids } }, { $set: { seenTime: utcTime } }, { runValidators: true });
        await Chat.updateMany({ _id: { $in: ids }, receivedTime: { $exists: false } },
            { $set: { receivedTime: utcTime } }, { runValidators: true });
        updatedMessages = normalizeMessages(unsceenMessages.map((m) => ({ receivedTime: utcTime, ...m, seenTime: utcTime })));
        updateReadReceipts(socket, userId, senderId, updatedRoom as string, updatedMessages);
    } catch (err) {
        logger.error('Error updating message seen time to database', err);
    }
    return updatedMessages;
}

const getAllChatRooms = async (userId: string) => {
    let contactRooms;
    contactRooms = getCache(`user-chat-rooms-${userId}`) as string[];
    if (contactRooms) {
        return contactRooms;
    }
    try {
        await connectToDatabase();
        const result = await ChatRoom.find({ $or: [{ user1Id: userId }, { user2Id: userId }] }, { _id: 1 }).lean();
        contactRooms = result ? result.map((room) => room._id.toString()) : [];
    } catch (err) {
        logger.error('Error getting contact rooms from database', err);
    }
    if (contactRooms.length > 0) {
        setCache(`user-chat-rooms-${userId}`, contactRooms, 3600);
    }
    return contactRooms;
}

export {
    joinChatRoom, sendMessage, updateReceivedMessages, updateSeenMessages, getUnseenMessageCount, getunseenMessages, getAllChatRooms,
    checkChatRoom
};