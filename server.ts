import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mainSocket from "@/lib/websocket/mainSocket";
import chatSocket from "@/lib/websocket/chatSocket";
import statusSocket from "@/lib/websocket/statusSocket";
import socketMiddleware from "@/lib/middleware/socketMiddleware";
import HttpError from "@/lib/models/httpError";
import contactRouter from "@/lib/routes/contactRoutes";
import healthRouter from "@/lib/routes/healthRoutes";
import { Server } from "socket.io";
import { logger } from "@/lib/services/logger";
import { validateTokenServerSide } from "@/lib/services/authServices";
import { port, allowedOrigins } from "@/lib/config/config";

const app = express();
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "500kb" }));

app.use('/api/contact', contactRouter);
app.use('/api/health', healthRouter);

app.use((req, res, next) => {
    const error = new HttpError('Could not find this route.', 404);
    throw error;
});

app.use(async (error: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
        return next(error);
    }
    res.status(error.code || 500);
    res.json({ message: error.message || 'An unknown error occurred!' });
});

const server = app.listen(port, () => {
    logger.info(`next-js-chat-app-websocket listening on port ${port}`);
});

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});
const chatIo = io.of('/chat');
const statusIo = io.of('/status');
const namespaces = [io, chatIo, statusIo];
namespaces.forEach((namespace) => {
    namespace.use(socketMiddleware);
    namespace.use(validateTokenServerSide);
})

mainSocket(io);
chatSocket(chatIo);
statusSocket(statusIo);



