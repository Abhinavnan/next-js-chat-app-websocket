import jwt from "jsonwebtoken";
import axios, { Method, AxiosRequestConfig } from "axios";
import { ZodIssue } from "zod";
import { Socket } from "socket.io";
import { logger } from "./logger";
import { jwtSecret, nextjsUrl } from "@/lib/config/config";

const parseZodError = (parsedData: any) => {
    const errors = JSON.parse(parsedData.error.message).map((e: ZodIssue) => e.message).filter(Boolean).join('\n');
    return errors;
}

const normalizeMessages = (messages: Record<string, any>[]) => {
    const normalizedMessages = messages.map((message: Record<string, any>) => {
        const { _id, senderId, receiverId, __v, ...rest } = message;
        return { id: _id.toString(), senderId: senderId.toString(), receiverId: receiverId.toString(), ...rest };
    });
    return normalizedMessages;
}

const sanitiseMessages = (messages: Record<string, any>[], userId: string) => {
    const sanitisedMessages = messages.map((message) => {
        const { receiverId, senderId, userSentTime, ...rest } = message;
        const sanitisedMessage = senderId === userId ? { ...rest, userSentTime } : rest;
        return sanitisedMessage;
    })
    return sanitisedMessages;
};

const asyncErrorHandler = (socket: Socket, fn: (...args: any[]) => Promise<void>) => {
    return async (...args: any[]) => {
        try {
            await fn(...args);
        } catch (err) {
            logger.error(`Socket error [${socket.id}]:`, err);
        }
    };
};

const sendAPICall = async (userId: string, method: Method, path: string, data?: any, timeout = 11000) => {
    const url = nextjsUrl + '/api' + path;
    const authTocken = jwt.sign({ userId }, jwtSecret, { expiresIn: '30m' });
    const refreshId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const cookieHeader = `authToken=${authTocken}; refreshId=${refreshId}; sessionId=${sessionId}`
    const headers = { cookie: cookieHeader };
    let result;
    try {
        let request: AxiosRequestConfig = { url, method, timeout, headers };
        if (method === 'get') {
            request = { ...request, params: data };
        } else if (['patch', 'post', 'put'].includes(method)) {
            request = { ...request, data };
        }
        const response = await axios(request);
        result = response.data;
    } catch (err) {
        let message = 'Something went wrong!\nPlease try again.';
        if (axios.isAxiosError(err)) {
            message = err.response?.data?.message || err.message || message;
        } else if (err instanceof Error) {
            message = err?.message || message;
        }
        logger.error('Error sending API call', { method, path, data, error: message });
    } finally {
        return result;
    }
}

export { parseZodError, normalizeMessages, sanitiseMessages, asyncErrorHandler, sendAPICall };