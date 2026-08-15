import { Socket } from "socket.io";
import { logger } from "@/lib/services/logger.js";
import { joinChatRoom, sendMessage, updateReceivedMessages, updateSeenMessages, getUnseenMessageCount } from "@/lib/services/chatServices.js";
import { getunseenMessages } from "@/lib/services/chatServices.js";
import { asyncErrorHandler } from "@/lib/services/utilityServices.js";
import { MessageInfo } from "@/lib/types/types.js";

const chatSocket = (io: any) => {
    io.on("connection", (socket: Socket) => {
        logger.info(`user connected to userSocket with id: ${socket.id}`);

        socket.on("disconnect", () => {
            logger.info(`user disconnected to socket with id: ${socket.id}`);
            socket.removeAllListeners();
        });

        socket.on("join-room", asyncErrorHandler(socket, async (index, cb: (chatRoomId: string) => void) => {
            const userId = socket.data.userDetails.userId;
            const chatRoomId = await joinChatRoom(socket, userId, index);
            if (chatRoomId) {
                logger.info(`user with id: ${userId} joined chat room with id: ${chatRoomId}`);
                cb(chatRoomId as string);
            }
        }));

        socket.on("send-message", asyncErrorHandler(socket, async (roomId: string, index: number, message: MessageInfo) => {
            const userId = socket.data.userDetails.userId;
            const messageReport = await sendMessage(socket, roomId, userId, index, message);
            logger.info(`user with id: ${userId} sent message to contact with index: ${index}`, { messageId: messageReport?.id });
        }));

        socket.on("mark-as-received", asyncErrorHandler(socket, async (roomId: string, index: number) => {
            const userId = socket.data.userDetails.userId;
            const updatedMessages = await updateReceivedMessages(socket, roomId, userId, index);
            if (updatedMessages.length > 0) {
                logger.info(`user with id: ${userId} received message from contact with index: ${index}`,
                    { messageIds: updatedMessages.map((m) => m.id) });
            }
        }));

        socket.on("mark-as-seen", asyncErrorHandler(socket, async (roomId: string, index: number) => {
            const userId = socket.data.userDetails.userId;
            const updatedMessages = await updateSeenMessages(socket, roomId, userId, index);
            if (updatedMessages.length > 0) {
                logger.info(`user with id: ${userId} seen message from contact with index: ${index}`,
                    { messageIds: updatedMessages.map((m) => m.id) });
            }
        }));

        socket.on("get-unseen-message-count", asyncErrorHandler(socket, async (index: number, cb: (count: number) => void) => {
            const userId = socket.data.userDetails.userId;
            const count = await getUnseenMessageCount(userId, index);
            // if (count > 0) {
            //     socket.emit('unseen-message-count', index, count);
            //     logger.info(`user with id: ${userId} has ${count} unseen messages from contact with index: ${index}`);
            // }
            if (typeof cb === 'function') {
                cb(count);
            }
        }));

        socket.on("get-unseen-messages", asyncErrorHandler(socket, async (index: number) => {
            const userId = socket.data.userDetails.userId;
            const updatedMessages = await getunseenMessages(socket, userId, index);
            if (updatedMessages.length > 0) {
                logger.info(`user with id: ${userId} has ${updatedMessages.length} unseen messages from contact with index: ${index}`);
            }
        }));
    });
};

export default chatSocket;