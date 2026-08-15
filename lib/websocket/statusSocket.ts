import { Socket } from "socket.io";
import { logger } from "@/lib/services/logger.js";
import { asyncErrorHandler } from "@/lib/services/utilityServices.js";
import { handleUpdateUserStatus, handleCheckUserStatus } from "@/lib/services/userServices.js";
import { StatusInfo } from "@/lib/types/types.js";

const statusSocket = (io: any) => {
    io.on("connection", (socket: Socket) => {
        logger.info(`user connected to userSocket with id: ${socket.id}`);

        socket.on("disconnect", () => {
            logger.info(`user disconnected to socket with id: ${socket.id}`);
            socket.removeAllListeners();
        });

        socket.on("update-user-status", asyncErrorHandler(socket, async (statusInfo: StatusInfo) => {
            const userId = socket.data.userDetails.userId;
            const updatedStatus = await handleUpdateUserStatus(socket, userId, statusInfo);
            if (updatedStatus) {
                logger.info(`user with id: ${userId} updated`, updatedStatus);
            }
        }));

        socket.on("check-user-status", asyncErrorHandler(socket, async (index: number, cb: (statusInfo: StatusInfo) => void) => {
            const userId = socket.data.userDetails.userId;
            const statusInfo = await handleCheckUserStatus(socket, userId, index);
            if (typeof cb === 'function' && statusInfo) {
                cb(statusInfo);
            }
        }));
    });
};

export default statusSocket;