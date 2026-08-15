import dotenv from 'dotenv';
dotenv.config();

const mongoDBConnectionURL = process.env.MONGODB_CONNECTION_URL;
const jwtSecret = process.env.JWT_SECRET || 'secret';
const port = Number(process.env.PORT) || 8000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");
const nextjsUrl = process.env.NEXTJS_URL || "";

export { mongoDBConnectionURL, jwtSecret, port, allowedOrigins, nextjsUrl };