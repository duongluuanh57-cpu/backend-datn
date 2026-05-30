# Authentication & OAuth & 2FA

**Rate limits:** Register/Login: 10 req/min

## Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Str0ng!Pass",
  "name": "John Doe"
}
```

Response `201`:
```json
{ "user": { "id": "uuid", "email": "user@example.com", "name": "John Doe", "role": "USER" }, "tokens": { "accessToken": "jwt...", "refreshToken": "jwt..." } }
```

## Login

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "Str0ng!Pass" }
```

Response `200` — same shape as register.

## Refresh

```http
POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "jwt..." }
```

Response `200` — `{ "accessToken": "jwt...", "refreshToken": "jwt..." }`

## Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
Content-Type: application/json

{ "refreshToken": "jwt..." }
```

Response `200` — `{ "message": "Logged out successfully" }`

## Change Password

```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{ "currentPassword": "old", "newPassword": "newStr0ng!" }
```

Response `200` — `{ "message": "Password changed" }`

## Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

Response `200` — `{ "user": { "id": "uuid", "email": "...", "name": "...", "role": "USER", "avatar": "url", "phone": "..." } }`

## Update Profile

```http
PATCH /api/auth/update-profile
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "New Name", "phone": "+84123456789", "avatar": "url" }
```

Response `200` — updated user object.

## Google OAuth — Redirect

```http
GET /api/auth/google
```

Redirects to Google consent screen. Returns `302`.

## Google OAuth — Callback

```http
GET /api/auth/google/callback?code=<authorization_code>
```

Exchanges code for tokens. Response `200` — user + tokens.

## 2FA — Setup

```http
POST /api/2fa/setup
Authorization: Bearer <token>
```

Response `200` — `{ "secret": "base32...", "qrCode": "data:image/png;base64..." }`

## 2FA — Enable

```http
POST /api/2fa/enable
Authorization: Bearer <token>
Content-Type: application/json

{ "token": "123456" }
```

Response `200` — `{ "message": "2FA enabled", "recoveryCodes": ["code1", ...] }`

## 2FA — Verify

```http
POST /api/2fa/verify
Authorization: Bearer <token>
Content-Type: application/json

{ "token": "123456" }
```

Response `200` — `{ "verified": true }`
