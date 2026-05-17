import { z } from 'zod';

// Schema cho 2FA
export const Setup2FASchema = z.object({});

export const Verify2FASchema = z.object({
  token: z.string().length(6, 'Mã OTP phải đúng 6 số'),
  userId: z.string().min(1),
});

export const Enable2FASchema = z.object({
  token: z.string().length(6, 'Mã OTP phải đúng 6 số'),
  userId: z.string().min(1),
});

// Schema cho AI
export const AIPromptSchema = z.object({
  prompt: z.string().min(1, 'Câu hỏi không được để trống').max(2000),
});

export const AIGenerateNameSchema = z.object({
  name: z.string().min(1, 'Tên không được để trống').max(200),
});

export type Verify2FAInput = z.infer<typeof Verify2FASchema>;
export type Enable2FAInput = z.infer<typeof Enable2FASchema>;
export type AIPromptInput = z.infer<typeof AIPromptSchema>;
export type AIGenerateNameInput = z.infer<typeof AIGenerateNameSchema>;
