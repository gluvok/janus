# Factory Data API Guide (`/api/data`)

Secure external integration endpoints for factories and third-party systems to retrieve unprocessed data and acknowledge processed records.

- **Weighments API**: `/api/data/weighments`
- **Entries API**: `/api/data/entries`

---

## Headers

| Header         | Required | Description        |
| :------------- | :------- | :----------------- |
| `x-api-key`    | **Yes**  | Factory API key    |
| `Content-Type` | For POST | `application/json` |

---

## 1. Weighments API (`/api/data/weighments`)

### Fetch Unprocessed Weighments (GET)

```bash
curl -X GET "http://localhost:3000/api/data/weighments" \
  -H "x-api-key: YOUR_FACTORY_API_KEY"
```

#### GET Response (`200 OK`)

```json
{
  "data": [
    {
      "id": 101,
      "vehicle_number": "KA01AB1234",
      "gross_weight": 15000,
      "tare_weight": 5000,
      "net_weight": 10000,
      "images": ["in_cam1.jpg", "out_cam1.jpg"],
      "in_entry_id": 11,
      "in_entry_time": "2026-10-26T09:30:00.000Z",
      "out_entry_id": 12,
      "out_entry_time": "2026-10-26T10:45:00.000Z",
      "in_center_id": 1,
      "in_center_name": "Weighbridge North",
      "out_center_id": 1,
      "out_center_name": "Weighbridge North"
    }
  ],
  "count": 1
}
```

### Acknowledge Processed Weighment (POST)

```bash
curl -X POST "http://localhost:3000/api/data/weighments" \
  -H "x-api-key: YOUR_FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": 101}'
```

#### POST Response (`200 OK`)

```json
{
  "success": true,
  "acknowledged_id": 101,
  "message": "Weighment acknowledged successfully"
}
```

---

## 2. Entries API (`/api/data/entries`)

### Fetch Unprocessed Entries (GET)

```bash
curl -X GET "http://localhost:3000/api/data/entries" \
  -H "x-api-key: YOUR_FACTORY_API_KEY"
```

#### GET Response (`200 OK`)

```json
{
  "data": [
    {
      "id": 501,
      "vehicle_number": "KA05MM9999",
      "weight": 12500,
      "status": "approved",
      "images": ["cam1.jpg", "cam2.jpg"],
      "center_id": 2,
      "created_at": "2026-11-01T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Acknowledge Processed Entry (POST)

```bash
curl -X POST "http://localhost:3000/api/data/entries" \
  -H "x-api-key: YOUR_FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": 501}'
```

#### POST Response (`200 OK`)

```json
{
  "success": true,
  "acknowledged_id": 501,
  "message": "Entry acknowledged successfully"
}
```

---

## Cross-Origin Resource Sharing (CORS)

All `/api/data/:path*` endpoints fully support CORS for browser integrations and dashboards.

- **Allowed Origin**: `*`
- **Allowed Methods**: `GET, POST, OPTIONS`
- **Allowed Headers**: `Content-Type, x-api-key`
- **Preflight**: Send an `OPTIONS` request; returns `200 OK` with CORS headers.

### Browser `fetch` Example

```javascript
// Fetch unprocessed entries
const response = await fetch("https://gluvok.vercel.app/api/data/entries", {
  method: "GET",
  headers: {
    "x-api-key": "YOUR_FACTORY_API_KEY",
  },
});
const result = await response.json();
console.log(result.data);

// Acknowledge a processed entry
await fetch("https://gluvok.vercel.app/api/data/entries", {
  method: "POST",
  headers: {
    "x-api-key": "YOUR_FACTORY_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ id: 501 }),
});
```

---

## Status Codes

| Code  | Meaning               | Reason                                              |
| :---- | :-------------------- | :-------------------------------------------------- |
| `200` | OK                    | Successful retrieval or acknowledgment              |
| `400` | Bad Request           | Missing or invalid JSON body / ID                   |
| `401` | Unauthorized          | Missing or invalid `x-api-key`                      |
| `404` | Not Found             | Record does not exist or belongs to another factory |
| `500` | Internal Server Error | Database failure                                    |
