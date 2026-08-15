import { Request, Response, NextFunction } from "express";
import { deleteCache } from "@/lib/services/cacheServices.js";

const updateUserContacts = async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.cookies.userDetails;
    deleteCache(`user-contacts-${userId}`);
    res.status(200).json({ message: 'Contacts updated successfully!' });
};

export { updateUserContacts };