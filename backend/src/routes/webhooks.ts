import express, { Request, Response, Router } from 'express';
import prisma from '../db/prisma.js';
import { sendNativeSmsMms } from '../services/twilioService.js';

const router: Router = express.Router();

/**
 * Twilio Webhook Endpoint for Incoming SMS/MMS messages
 * When a regular phone user sends a text or picture/video to our Twilio number, Twilio POSTs here.
 */
router.post('/twilio/incoming', async (req: Request, res: Response) => {
  try {
    const {
      From: senderPhone, // e.g., +1234567890
      To: twilioNumber,  // e.g., our group's proxy phone number
      Body: bodyText,
      NumMedia,
      MediaUrl0,
      MediaContentType0,
    } = req.body;

    console.log(`[Twilio Webhook] Received message from ${senderPhone} to ${twilioNumber}`);

    // 1. Find or create the SMS user in our database
    let user = await prisma.user.findUnique({
      where: { phoneNumber: senderPhone },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber: senderPhone,
          name: `SMS User (${senderPhone.slice(-4)})`,
          isAppUser: false,
        },
      });
    }

    // 2. Identify the Group chat associated with this Twilio proxy number
    const group = await prisma.group.findFirst({
      where: { twilioNumber: twilioNumber },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!group) {
      console.warn(`[Twilio Webhook] No group found assigned to Twilio number ${twilioNumber}`);
      // Respond to Twilio with TwiML acknowledging receipt
      res.type('text/xml').send('<Response></Response>');
      return;
    }

    // 3. Determine message type and media url
    let messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' = 'TEXT';
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;

    if (parseInt(NumMedia || '0', 10) > 0 && MediaUrl0) {
      mediaUrl = MediaUrl0;
      mediaMimeType = MediaContentType0 || 'image/jpeg';
      if (mediaMimeType!.startsWith('video/')) {
        messageType = 'VIDEO';
      } else if (mediaMimeType!.startsWith('audio/')) {
        messageType = 'AUDIO';
      } else {
        messageType = 'IMAGE';
      }
    }

    // 4. Save the incoming message to the Group Chat in database
    const newMessage = await prisma.message.create({
      data: {
        groupId: group.id,
        senderId: user.id,
        content: bodyText || null,
        messageType,
        mediaUrl,
        mediaMimeType,
      },
      include: {
        sender: true,
      },
    });

    // 5. Broadcast real-time message via Socket.io to all App Users in the group
    const io = req.app.get('io');
    if (io) {
      io.to(group.id).emit('new_message', newMessage);
    }

    // 6. Forward this message as native SMS/MMS to all other SMS users in the group!
    const otherSmsMembers = group.members.filter(
      (m: { user: { isAppUser: boolean; id: string; phoneNumber: string; name: string | null } }) => !m.user.isAppUser && m.user.id !== user!.id
    );

    for (const member of otherSmsMembers) {
      const prefixName = user.name ? `[${user.name}]: ` : '';
      await sendNativeSmsMms({
        to: member.user.phoneNumber,
        from: twilioNumber,
        body: bodyText ? `${prefixName}${bodyText}` : prefixName.trim(),
        mediaUrls: mediaUrl ? [mediaUrl] : undefined,
      });
    }

    // Return empty TwiML response to Twilio
    res.type('text/xml').send('<Response></Response>');
  } catch (error) {
    console.error('[Twilio Webhook Error]:', error);
    res.status(500).send('Webhook processing failed');
  }
});

export default router;
