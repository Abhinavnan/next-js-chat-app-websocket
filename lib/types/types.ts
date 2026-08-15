
interface Contact {
  id: string;
  index: number;
  name: string;
  email: string;
  about?: string;
  profilePicture: string;
}

interface UserDetails {
  id?: string;
  userId?: string;
  name: string;
  email: string;
  profilePicture: string;
  about?: string;
  verified?: boolean;
  password?: string;
  status?: string;
  lastSeenTime?: string;
  contacts?: Contact[];
}

interface MessageInfo {
  id: string;
  refrenceId?: string;
  message: string;
  receiverIndex: number;
  userSentTime?: string;
  receiveTime?: string;
  sentTime?: string;
  seenTime?: string;
  error?: string;
}

interface StatusInfo {
  status: string;
  lastSeenTime: string;
}

export type { Contact, UserDetails, MessageInfo, StatusInfo };