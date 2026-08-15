import dayjs from 'dayjs';
import { Router } from 'express';
import { Request, Response, NextFunction } from "express";

const route = Router();
route.get('/', async (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({ message: 'Server is running', timestamp: dayjs().toISOString() })
});

export default route;