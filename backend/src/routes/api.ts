import express, { Request, Response, Router } from 'express';
import prisma from '../db/prisma.js';
import { sendNativeSmsMms } from '../services/twilioService.js';
import { env } from '../config/env.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

const router: Router = express.Router();

router.use(requireAuth);

/**
 * Get all groups for a user
 */
router.get('/groups', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;

  try {
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * Create a new Group Chat (can include both App Users and SMS Users via phone numbers)
 */
router.post('/groups', async (req: Request, res: Response) => {
  const { name, description, smsPhoneNumbers = [] } = req.body;
  const creatorId = (req as AuthenticatedRequest).userId;

  try {
    // Create the group
    const group = await prisma.group.create({
      data: {
        name,
        description,
        // In production, we can dynamically assign a Twilio proxy phone number from our pool here
        twilioNumber: env.TWILIO_DEFAULT_PHONE_NUMBER,
        members: {
          create: [{ userId: creatorId, participantType: 'APP_USER' }],
        },
      },
    });

    // Add SMS users to the group
    for (const phone of smsPhoneNumbers) {
      let smsUser = await prisma.user.findUnique({ where: { phoneNumber: phone } });
      if (!smsUser) {
        smsUser = await prisma.user.create({
          data: {
            phoneNumber: phone,
            name: `SMS User (${phone.slice(-4)})`,
            isAppUser: false,
          },
        });
      }
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: smsUser.id,
          participantType: 'SMS_USER',
        },
      });

      // Send a welcome SMS notifying them they were added to the PulseChat group
      await sendNativeSmsMms({
        to: phone,
        body: `You have been added to the group chat "${name}"! Reply to this number to send messages, photos, and videos to the group natively.`,
      });
    }

    const updatedGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: { members: { include: { user: true } } },
    });

    res.status(201).json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * Get messages for a specific group
 */
router.get('/groups/:groupId/messages', async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const userId = (req as AuthenticatedRequest).userId;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });

  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this group.' });
  }

  try {
    const messages = await prisma.message.findMany({
      where: { groupId },
      include: { sender: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * Send a message to a group (from an App User via REST/Socket)
 */
router.post('/groups/:groupId/messages', async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { content, messageType = 'TEXT', mediaUrl, mediaMimeType } = req.body;
  const senderId = (req as AuthenticatedRequest).userId;

  try {
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: senderId } },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }

    const message = await prisma.message.create({
      data: {
        groupId,
        senderId,
        content,
        messageType,
        mediaUrl,
        mediaMimeType,
      },
      include: { sender: true },
    });

    // Broadcast via Socket.io to connected App Users
    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('new_message', message);
    }

    // Forward to all SMS participants in the group natively!
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: true } } },
    });

    if (group) {
      const smsMembers = group.members.filter((m: { user: { isAppUser: boolean; id: string; phoneNumber: string; name: string | null } }) => !m.user.isAppUser && m.user.id !== senderId);
      for (const member of smsMembers) {
        const prefix = message.sender.name ? `[${message.sender.name}]: ` : '';
        const twilioMessageSid = await sendNativeSmsMms({
          to: member.user.phoneNumber,
          from: group.twilioNumber || undefined,
          body: content ? `${prefix}${content}` : prefix.trim(),
          mediaUrls: mediaUrl ? [mediaUrl] : undefined,
        });

        if (twilioMessageSid) {
          await prisma.messageDelivery.create({
            data: {
              messageId: message.id,
              recipientPhone: member.user.phoneNumber,
              twilioMessageSid,
              status: 'queued',
            },
          });
        }
      }
    }

    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
