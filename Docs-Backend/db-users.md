# Users & User Addresses

## Users (`users`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `username` | String | unique, required |
| `email` | String | unique, required |
| `passwordHash` | String | bcrypt hash |
| `role` | String | `USER` / `ADMIN` / `SUBADMIN` |
| `memberTier` | String | e.g. `silver`, `gold`, `diamond` |
| `totalSpent` | Number | lifetime spend |
| `tenantId` | String | multi-tenant partition |
| `status` | String | `active` / `inactive` / `banned` |
| `twoFactorEnabled` | Boolean | |
| `twoFactorSecret` | String | TOTP secret |
| `fullName` | String | |
| `phoneNumber` | String | |
| `gender` | String | |
| `address` | String | |
| `province` | String | |
| `district` | String | |
| `avatar` | String | media URL |
| `oauthProvider` | String | `google` / `facebook` |
| `oauthId` | String | provider user ID |

**Indexes:**
- `{ username: 1 }` (unique)
- `{ email: 1 }` (unique)
- `{ tenantId: 1 }`
- `{ role: 1 }`
- `{ status: 1 }`

## User Addresses (`user_addresses`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | ObjectId | ref `users` |
| `fullName` | String | |
| `phoneNumber` | String | |
| `province` | String | |
| `district` | String | |
| `ward` | String | |
| `streetAddress` | String | |
| `isDefault` | Boolean | |
| `tenantId` | String | |

**Indexes:**
- `{ userId: 1 }`
- `{ tenantId: 1 }`
