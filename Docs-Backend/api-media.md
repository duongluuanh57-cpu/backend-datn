# Media

**Rate limits:** Upload 20 req/min, Delete 30 req/min, Batch delete 20 req/min.

## Upload from File (multipart)

```http
POST /api/media/upload-r2
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

file: <binary>
```

Response `201`:
```json
{ "url": "https://r2.example.com/uploads/file.jpg", "key": "uploads/file.jpg", "size": 102400, "mimeType": "image/jpeg" }
```

## Upload from URL

```http
POST /api/media/upload-url
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "url": "https://example.com/image.jpg" }
```

Response `201` — same shape as multipart upload.

## List Media

```http
GET /api/media?page=1&limit=20&mimeType=image/jpeg
Authorization: Bearer <admin-token>
```

Response `200`:
```json
{ "data": [{ "url": "...", "key": "...", "size": 102400, "mimeType": "image/jpeg", "createdAt": "iso" }], "pagination": {} }
```

## Delete by URL

```http
DELETE /api/media/delete
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "url": "https://r2.example.com/uploads/file.jpg" }
```

Response `200` — `{ "message": "File deleted" }`

## Delete Folder (Batch)

```http
DELETE /api/media/delete-folder
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "prefix": "uploads/temp/" }
```

Response `200` — `{ "message": "Deleted 5 files" }`
