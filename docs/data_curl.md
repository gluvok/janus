# Data API cURL Guide (`/api/data`)

Endpoint for third-party systems and factories to retrieve flattened weighment records and acknowledge processed IDs.

---

## Headers

| Header         | Required | Description        |
| :------------- | :------- | :----------------- |
| `x-api-key`    | **Yes**  | Factory API key    |
| `Content-Type` | For POST | `application/json` |

---

## cURL Commands

### 1. Fetch Unprocessed Weighments (GET)

```bash
curl -X GET "http://localhost:3000/api/data" \
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

---

### 2. Acknowledge Processed Weighment (POST)

```bash
curl -X POST "http://localhost:3000/api/data" \
  -H "x-api-key: YOUR_FACTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"weighment_id": 101}'
```

_(Note: `{ "id": 101 }` is also accepted as an alias)_

#### POST Response (`200 OK`)

```json
{
  "success": true,
  "acknowledged_id": 101,
  "message": "Weighment acknowledged successfully"
}
```

---

## Cross-Origin Resource Sharing (CORS)

`/api/data` fully supports CORS for external browser integrations and dashboards.

- **Allowed Origin**: `*`
- **Allowed Methods**: `GET, POST, OPTIONS`
- **Allowed Headers**: `Content-Type, x-api-key`
- **Preflight**: Send an `OPTIONS` request; returns `200 OK` with CORS headers.

### Browser `fetch` Example

```javascript
// Fetch unprocessed weighments
const response = await fetch("https://gluvok.vercel.app/api/data", {
  method: "GET",
  headers: {
    "x-api-key": "YOUR_FACTORY_API_KEY",
  },
});
const result = await response.json();
console.log(result.data);

// Acknowledge a processed weighment
await fetch("https://gluvok.vercel.app/api/data", {
  method: "POST",
  headers: {
    "x-api-key": "YOUR_FACTORY_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ weighment_id: 101 }),
});
```

---

## Cross-Origin Resource Sharing (CORS)

`/api/data` fully supports CORS for external browser integrations and dashboards.

- **Allowed Origin**: `*`
- **Allowed Methods**: `GET, POST, OPTIONS`
- **Allowed Headers**: `Content-Type, x-api-key`
- **Preflight**: Send an `OPTIONS` request; returns `200 OK` with CORS headers.

### Browser `fetch` Example

```javascript
// Fetch unprocessed weighments
const response = await fetch("https://gluvok.vercel.app/api/data", {
  method: "GET",
  headers: {
    "x-api-key": "YOUR_FACTORY_API_KEY",
  },
});
const result = await response.json();
console.log(result.data);

// Acknowledge a processed weighment
await fetch("https://gluvok.vercel.app/api/data", {
  method: "POST",
  headers: {
    "x-api-key": "YOUR_FACTORY_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ weighment_id: 101 }),
});
```

---

## Status Codes

| Code  | Meaning               | Reason                                                 |
| :---- | :-------------------- | :----------------------------------------------------- |
| `200` | OK                    | Successful retrieval or acknowledgment                 |
| `400` | Bad Request           | Missing or invalid JSON body / weighment ID            |
| `401` | Unauthorized          | Missing or invalid `x-api-key`                         |
| `404` | Not Found             | Weighment does not exist or belongs to another factory |
| `500` | Internal Server Error | Database failure                                       |
