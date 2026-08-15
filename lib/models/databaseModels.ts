import { model, Schema } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, minlength: 3, maxlength: 40 },
  email: { type: String, required: true, unique: true, minlength: 3, maxlength: 40 },
  profilePicture: { type: String },
  about: { type: String, minlength: 20, maxlength: 150 },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false, required: true },
  contacts: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String },
  lastSeenTime: { type: Date, default: () => new Date().toISOString() }
});

userSchema.path('contacts').validate({
  validator: function (arr: Schema.Types.ObjectId[]) {
    const unique = new Set(arr.map(String));
    return unique.size === arr.length;
  },
  message: 'Duplicate contact IDs are not allowed.',
});

userSchema.index({ email: 1, name: 1, verified: 1 }, { unique: true });

const chatSchema = new Schema({
  message: { type: String, required: true, maxlength: 5000 },
  userSentTime: { type: Date, required: true },
  sentTime: { type: Date, default: () => new Date().toISOString(), required: true },
  seenTime: { type: Date },
  receivedTime: { type: Date },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

const userSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  refreshId: { type: String, required: true, minlength: 36, maxlength: 36 },
  deviceName: { type: String, required: true },
  ipAddress: { type: String, required: true },
  loginTime: { type: Date, default: () => new Date().toISOString(), required: true },
  refreshTime: { type: Date, default: () => new Date().toISOString(), required: true },
  expiresTime: { type: Date, required: true }
});

userSessionSchema.index({ userId: 1 });
userSessionSchema.index({ expiresTime: 1 }, { expireAfterSeconds: 0 }); // expire after expiresTime over

const chatRoomSchema = new Schema({
  user1Id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  user2Id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: () => new Date().toISOString(), required: true }
});


chatRoomSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
chatRoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // expire after 1 hour

const User = model('User', userSchema);
const Chat = model('Chat', chatSchema);
const ChatRoom = model('ChatRoom', chatRoomSchema);
const UserSession = model('UserSession', userSessionSchema);

export { User, Chat, UserSession, ChatRoom };
