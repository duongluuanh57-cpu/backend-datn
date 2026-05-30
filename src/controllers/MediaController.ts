/**
 * Barrel file — re-exports all media sub-controllers for backward compatibility.
 * Import { MediaUploadController } from './media/mediaUploadController.ts'
 * Import { MediaDeleteController } from './media/mediaDeleteController.ts'
 */
export { MediaUploadController } from './media/mediaUploadController.ts';
export { MediaDeleteController } from './media/mediaDeleteController.ts';

import { MediaUploadController } from './media/mediaUploadController.ts';
import { MediaDeleteController } from './media/mediaDeleteController.ts';

export class MediaController {
  static uploadR2 = MediaUploadController.uploadR2;
  static uploadUrl = MediaUploadController.uploadUrl;
  static deleteR2Image = MediaDeleteController.deleteR2Image;
  static deleteR2Folder = MediaDeleteController.deleteR2Folder;
}