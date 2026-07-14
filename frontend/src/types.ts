export type AuthUser = {
  id: string;
  phoneNumber: string;
  name: string | null;
  isAppUser: boolean;
  avatarUrl?: string | null;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type GroupUser = {
  id: string;
  phoneNumber: string;
  name: string | null;
  isAppUser: boolean;
};

export type GroupMember = {
  id: string;
  participantType: 'APP_USER' | 'SMS_USER';
  user: GroupUser;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  twilioNumber: string | null;
  members: GroupMember[];
};

export type Message = {
  id: string;
  groupId: string;
  senderId: string;
  content: string | null;
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  mediaUrl: string | null;
  mediaMimeType: string | null;
  createdAt: string;
  sender: GroupUser;
};
