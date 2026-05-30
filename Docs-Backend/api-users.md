# Users & Addresses

All endpoints require admin authentication unless noted.

## List Users

```http
GET /api/users?page=1&limit=20&search=&role=USER|ADMIN
Authorization: Bearer <admin-token>
```

Response `200`:
```json
{ "data": [{ "id": "uuid", "email": "user@example.com", "name": "John", "role": "USER", "isActive": true, "createdAt": "iso" }], "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 } }
```

## Update User

```http
PATCH /api/users/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "name": "Updated", "isActive": false }
```

Response `200` — updated user.

## Update User Role

```http
PATCH /api/users/:id/role
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "role": "ADMIN" }
```

Response `200` — `{ "message": "Role updated" }`

## Delete User

```http
DELETE /api/users/:id
Authorization: Bearer <admin-token>
```

Response `200` — `{ "message": "User deleted" }`

---

# User Addresses

## List Addresses

```http
GET /api/user-addresses
Authorization: Bearer <token>
```

Response `200`:
```json
{ "data": [{ "id": "uuid", "fullName": "John Doe", "phone": "84123456789", "address": "123 Main St", "city": "HCMC", "isDefault": true }] }
```

## Create Address

```http
POST /api/user-addresses
Authorization: Bearer <token>
Content-Type: application/json

{ "fullName": "John Doe", "phone": "84123456789", "address": "123 Main St", "city": "HCMC", "isDefault": false }
```

Response `201` — created address.

## Update Address

```http
PATCH /api/user-addresses/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "isDefault": true }
```

Response `200` — updated address.

## Delete Address

```http
DELETE /api/user-addresses/:id
Authorization: Bearer <token>
```

Response `200` — `{ "message": "Address deleted" }`

## Set Default

```http
PATCH /api/user-addresses/:id/set-default
Authorization: Bearer <token>
```

Response `200` — `{ "message": "Default address set" }`
