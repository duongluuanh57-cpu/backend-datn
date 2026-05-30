/**
 * Barrel file — re-exports all email sub-services for backward compatibility.
 */
export { EmailTransport } from './email/emailTransport.ts';
export { EmailTemplates } from './email/emailTemplates.ts';

import { EmailTransport } from './email/emailTransport.ts';
import { EmailTemplates } from './email/emailTemplates.ts';

export class EmailService {
  static sendEmail = EmailTransport.send;
  static sendWelcomeEmail = EmailTemplates.sendWelcomeEmail;
}