import { logger } from "@/lib/services/logger";

const mainSocket = (io: any) => {
    io.on('connection', async (socket: any) => {
        const userDetails = socket.data.userDetails;
        logger.info(`user connected to socket with id: ${socket.id}`, userDetails);

        socket.on('disconnect', () => {
            logger.info(`user disconnected to socket with id: ${socket.id}`);
        });
    });
};

export default mainSocket;