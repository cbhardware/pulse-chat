import twilio from 'twilio';
import dotenv from 'dotenv';
import { env } from '../config/env.js';

dotenv.config();

const accountSid = env.TWILIO_ACCOUNT_SID;
const authToken = env.TWILIO_AUTH_TOKEN;

// Initialize Twilio client if credentials exist, otherwise create a mock for development
export const twilioClient = accountSid && accountSid.startsWith('AC')
  ? twilio(accountSid, authToken)
  : null;

export const TWILIO_DEFAULT_NUMBER = env.TWILIO_DEFAULT_PHONE_NUMBER;

/**
 * Send an SMS or native MMS (with attached picture/video without links) to a recipient.
 * When sending MMS, Twilio fetches the image/video from mediaUrl and transmits it directly via carrier MMS!
 */
export async function sendNativeSmsMms(options: {
  to: string;
  from?: string;
  body?: string;
  mediaUrls?: string[];
}): Promise<string | null> {
  const { to, from = TWILIO_DEFAULT_NUMBER, body, mediaUrls } = options;

  if (!twilioClient) {
    console.warn(`[Twilio Mock] Sending to ${to} from ${from} | Body: "${body || ''}" | Media: ${JSON.stringify(mediaUrls || [])}`);
    return `mock_message_sid_${Date.now()}`;
  }

  try {
    const message = await twilioClient.messages.create({
      to,
      from,
      body: body || undefined,
      mediaUrl: mediaUrls && mediaUrls.length > 0 ? mediaUrls : undefined,
    });
    console.log(`[Twilio] Sent MMS/SMS to ${to} (SID: ${message.sid})`);
    return message.sid;
  } catch (error) {
    console.error(`[Twilio Error] Failed to send SMS/MMS to ${to}:`, error);
    throw error;
  }
}
