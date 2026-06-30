/**
 * Barrel file — re-exports all auth sub-controllers for backward compatibility.
 * Import { AuthSessionController } from '../controllers/auth/authSessionController.ts'
 * Import { AuthProfileController } from '../controllers/auth/authProfileController.ts'
 */

export { AuthSessionController } from './auth/authSessionController.ts';
export { AuthProfileController } from './auth/authProfileController.ts';

/**
 * @deprecated Import individual controllers instead:
 *   - AuthSessionController for: register, login, refresh, logout
 *   - AuthProfileController for: changePassword, updateProfile, getMe
 *
 * This class is kept for backward compatibility but will be removed in a future release.
 */
import { AuthSessionController } from './auth/authSessionController.ts';
import { AuthProfileController } from './auth/authProfileController.ts';

export class AuthController {
  // Session methods
  static register = AuthSessionController.register;
  static login = AuthSessionController.login;
  static refresh = AuthSessionController.refresh;
  static logout = AuthSessionController.logout;
  static setAdminSession = AuthSessionController.setAdminSession;

  // Profile methods
  static changePassword = AuthProfileController.changePassword;
  static updateProfile = AuthProfileController.updateProfile;
  static getMe = AuthProfileController.getMe;
}