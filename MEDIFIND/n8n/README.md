# MediFind — n8n Automation & Orchestration Layer

This directory contains pre-configured workflow templates for integrating **n8n** with **MediFind — Hyperlocal Emergency Medicine Delivery & Pharmacy Management Platform**.

---

## 🏛️ Architecture & Principles

- **Single Source of Truth:** MediFind's FastAPI backend and Supabase PostgreSQL database remain the sole authority for business logic, inventory, orders, rider dispatch, and authentication.
- **Asynchronous & Non-Blocking:** All webhook calls from MediFind to n8n are dispatched via background threads (`fire-and-forget`). If n8n is down or slow, the core MediFind API response times and reliability are **never** impacted.
- **Simulated Dev Mode:** When `N8N_ENABLED=false`, webhook events are safely logged to the console without sending external network requests.

```
MediFind FastAPI Backend ──(Async POST)──▶ n8n Webhook ──▶ [Format / Route]
       ▲                                                          │
       │                                                          ▼
  [Database]                                         [Notifications / Email / CRM]
```

---

## ⚡ Quick Start

### 1. Run n8n Locally

#### Option A: Using Docker (Recommended)
```bash
docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
```

#### Option B: Using npm / npx
```bash
npx n8n
```
*n8n will be accessible at: `http://localhost:5678`*

---

### 2. Configure MediFind Backend Environment

Open `backend_python/.env` and update the following variables:

```env
# Enable n8n integration (set to true when your n8n instance is running)
N8N_ENABLED="true"

# Base URL of your n8n webhook listener
N8N_WEBHOOK_BASE_URL="http://localhost:5678/webhook"

# Optional secret key for securing webhooks (matched in n8n Webhook node headers)
N8N_API_KEY="your-secure-secret-token"
```

> **Note:** If testing locally and n8n is not running, keep `N8N_ENABLED="false"`. MediFind will print simulation logs like:
> `[N8N_SIMULATION] Event: order.created | Payload: {...}`

---

## 📦 Available Workflow Templates

Import these JSON files directly into n8n (**Workflows ➔ Import from File**):

| Workflow Template | Webhook Path | Trigger Event | Description |
|---|---|---|---|
| [`workflow_order_created.json`](./workflow_order_created.json) | `/medifind/order/created` | Customer places order | Formats order summary, flags emergency priority, prepares push/email |
| [`workflow_order_status_changed.json`](./workflow_order_status_changed.json) | `/medifind/order/status_changed` | Order status updates | Tracks status lifecycle (`PROCESSING`, `PICKED_UP`, `DELIVERED`), status emojis |
| [`workflow_low_stock_alert.json`](./workflow_low_stock_alert.json) | `/medifind/low_stock/alert` | Medicine stock $\le 5$ | High-priority alert to pharmacy owners for re-stocking |
| [`workflow_user_registered.json`](./workflow_user_registered.json) | `/medifind/user/registered` | New user signup | Routes onboarding sequence by role (Customer, Shop Owner, Rider) |
| [`workflow_rider_assigned.json`](./workflow_rider_assigned.json) | `/medifind/rider/assigned` | Rider accepts order | Prepares ETA alert for customer & pickup instructions for rider |
| [`workflow_rider_delivered.json`](./workflow_rider_delivered.json) | `/medifind/rider/delivered` | Delivery completed | Triggers loyalty reward calculation, receipt trigger & review prompt |

---

## 🛡️ Webhook Security

Every webhook request sent from MediFind includes:
- **Header:** `X-MediFind-Secret: <N8N_API_KEY>`
- **Header:** `Content-Type: application/json`
- **Standard Payload Wrapper:**
```json
{
  "event": "order.created",
  "timestamp": "2026-09-18T10:45:00.000000+00:00",
  "source": "medifind-backend",
  "data": { ... }
}
```

In n8n, you can optionally configure the Webhook node with **Authentication: Header Auth** and verify `X-MediFind-Secret`.

---

## 🧪 Testing Webhooks

You can trigger a test payload from your terminal to verify an n8n webhook:

```bash
curl -X POST http://localhost:5678/webhook/medifind/order/created \
  -H "Content-Type: application/json" \
  -H "X-MediFind-Secret: your-secure-secret-token" \
  -d '{
    "event": "order.created",
    "timestamp": "2026-09-18T12:00:00Z",
    "source": "medifind-backend",
    "data": {
      "orderId": "test-order-101",
      "trackingNumber": "MF-TEST-001",
      "userEmail": "customer@example.com",
      "userName": "Test User",
      "totalAmount": 249.50,
      "isEmergency": true,
      "paymentMethod": "COD",
      "deliveryAddress": "123 Health Street, City",
      "items": [{"name": "Paracetamol 500mg", "quantity": 2, "price": 40.0}]
    }
  }'
```
