# Data API cURL Guide (`/api/data`)

Endpoint for third-party systems and factories to retrieve flattened weighment records.

---

## Headers

| Header           | Required | Description                                                                           |
| :--------------- | :------- | :------------------------------------------------------------------------------------ |
| `x-api-key`      | **Yes**  | Factory API key                                                                       |
| `x-processed-id` | No       | ID of the last processed weighment (records ID and excludes all processed weighments) |

---

## cURL Commands

### 1. Fetch Unprocessed Weighments

```bash
curl -X GET "http://localhost:3000/api/data" \
  -H "x-api-key: YOUR_FACTORY_API_KEY"
```

### 2. Acknowledge Processed ID (e.g. ID #10)

```bash
curl -X GET "http://localhost:3000/api/data" \
  -H "x-api-key: YOUR_FACTORY_API_KEY" \
  -H "x-processed-id: 10"
```

---

## Response (`200 OK`)

```json
{
  "data": [
    {
      "id": 101,
      "vehicle_number": "KA-01-AB-1234",
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
  "count": 1,
  "acknowledged_processed_id": 10
}
```

---

## Status Codes

| Code  | Meaning               | Reason                         |
| :---- | :-------------------- | :----------------------------- |
| `200` | OK                    | Successful request             |
| `401` | Unauthorized          | Missing or invalid `x-api-key` |
| `500` | Internal Server Error | Database failure               |
