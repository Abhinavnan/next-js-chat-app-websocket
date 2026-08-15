import connectToDatabase from "@/lib/database/mongoose.js";
import { getCache, setCache, deleteCache } from "@/lib/services/cacheServices.js";
import { User } from "@/lib/models/databaseModels.js";
import { logger } from "@/lib/services/logger.js";

const getUserContacts = async (userId: string) => {
    let contacts, contactDetails;
    contactDetails = getCache(`user-contacts-${userId}`) as Record<string, any>;
    if (contactDetails) {
        return contactDetails;
    }
    try {
        await connectToDatabase();
        const user = await User.findById(userId).populate('contacts', '-password -verified -contacts').lean();
        contacts = user ? user.contacts : [];
    } catch (err) {
        logger.error('Error getting user contacts from database', err);
    }
    const contactList = (contacts || []).map((contact: Record<string, any>, index: number) => {
        const { _id, __v, ...rest } = contact;
        return { index, id: _id.toString(), ...rest };
    });
    const contactIdIndexMap = new Map<string, number>(contactList.map(({ id, index }) => [id, index]));
    const contactsLength = contactList.length;
    contactDetails = { contactList, contactIdIndexMap, contactsLength };
    setCache(`user-contacts-${userId}`, contactDetails, 3600);
    return contactDetails;
}

const getReceiverDetailsByIndex = async (userId: string, receiverIndex: number) => {
    const { contactList } = await getUserContacts(userId);
    const receiver = contactList[receiverIndex];
    return receiver;
}

export { getUserContacts, getReceiverDetailsByIndex };
