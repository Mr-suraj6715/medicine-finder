"""
n8n Webhook Integration Service for MediFind
=============================================
Fires asynchronous webhook events to n8n for automation, notifications,
scheduled workflows, and AI orchestration.

All calls are fire-and-forget — they never block or crash the core API.

Environment Variables:
  N8N_WEBHOOK_BASE_URL    Base URL of your n8n instance webhook endpoint
                          e.g. http://localhost:5678/webhook
  N8N_API_KEY             Optional secret key sent as X-MediFind-Secret header
                          for webhook authentication in n8n
  N8N_ENABLED             Set to "true" to enable (default: disabled in dev)

Event Types Fired:
  order.created           When a new order is placed
  order.status_changed    When an order status changes (CONFIRMED → DELIVERED etc.)
  user.registered         When a new user signs up
  rider.assigned          When a rider accepts or is assigned to an order
  rider.delivered         When a delivery is marked complete
  low_stock.alert         When inventory drops below threshold
"""

import os
import json
import threading
import urllib.request
from datetime import datetime, timezone
from typing import Optional, Any, Dict


def _is_enabled() -> bool:
    """Check if n8n webhook integration is enabled."""
    return os.getenv("N8N_ENABLED", "false").lower() == "true"


def _get_base_url() -> str:
    return os.getenv("N8N_WEBHOOK_BASE_URL", "").rstrip("/")


def _get_secret() -> str:
    return os.getenv("N8N_API_KEY", "")


def _fire_webhook(event_type: str, payload: Dict[str, Any]) -> None:
    """
    Internal: dispatch a webhook to n8n in a background thread.
    Never raises — all errors are silently logged.
    """
    if not _is_enabled():
        # In dev mode, just log the event to console
        print(f"[N8N_SIMULATION] Event: {event_type} | Payload: {json.dumps(payload, default=str)[:200]}...")
        return

    base_url = _get_base_url()
    if not base_url:
        print(f"[N8N_SERVICE] N8N_WEBHOOK_BASE_URL not configured. Skipping event: {event_type}")
        return

    # n8n webhook URL structure: {base}/medifind/{event_type}
    # e.g. http://localhost:5678/webhook/medifind/order.created
    event_path = event_type.replace(".", "/")
    url = f"{base_url}/medifind/{event_path}"

    full_payload = {
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "medifind-backend",
        "data": payload
    }

    body = json.dumps(full_payload, default=str).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MediFind-Backend/1.0",
    }

    secret = _get_secret()
    if secret:
        headers["X-MediFind-Secret"] = secret

    def _send():
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=8) as resp:
                status = resp.status
                if status in (200, 201, 202, 204):
                    print(f"[N8N_SERVICE] ✓ Fired event '{event_type}' → {url} [{status}]")
                else:
                    print(f"[N8N_SERVICE] ⚠ Unexpected status {status} for event '{event_type}'")
        except Exception as e:
            print(f"[N8N_SERVICE] ✗ Failed to fire event '{event_type}': {e}")

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()


# ─────────────────────────────────────────────────────────
#  Public Event Emitters
# ─────────────────────────────────────────────────────────

def emit_order_created(
    order_id: str,
    tracking_number: str,
    user_email: str,
    user_name: Optional[str],
    total_amount: float,
    is_emergency: bool,
    payment_method: str,
    delivery_address: Optional[str],
    items: list,
) -> None:
    """Fired when a new order is placed by a customer."""
    _fire_webhook("order.created", {
        "orderId": order_id,
        "trackingNumber": tracking_number,
        "userEmail": user_email,
        "userName": user_name or "Customer",
        "totalAmount": total_amount,
        "isEmergency": is_emergency,
        "paymentMethod": payment_method,
        "deliveryAddress": delivery_address,
        "itemCount": len(items),
        "items": [
            {
                "name": i.get("name", "Medicine"),
                "quantity": i.get("quantity", 1),
                "price": i.get("price", 0.0)
            }
            for i in items
        ]
    })


def emit_order_status_changed(
    order_id: str,
    tracking_number: Optional[str],
    previous_status: str,
    new_status: str,
    user_email: Optional[str] = None,
    user_name: Optional[str] = None,
    rider_email: Optional[str] = None,
    rider_name: Optional[str] = None,
    pharmacy_name: Optional[str] = None,
    delivery_address: Optional[str] = None,
) -> None:
    """Fired whenever an order status changes."""
    _fire_webhook("order.status_changed", {
        "orderId": order_id,
        "trackingNumber": tracking_number or order_id,
        "previousStatus": previous_status,
        "newStatus": new_status,
        "userEmail": user_email,
        "userName": user_name,
        "riderEmail": rider_email,
        "riderName": rider_name,
        "pharmacyName": pharmacy_name,
        "deliveryAddress": delivery_address,
    })


def emit_user_registered(
    user_id: str,
    email: str,
    name: Optional[str],
    role: str,
) -> None:
    """Fired immediately after a new user registers."""
    _fire_webhook("user.registered", {
        "userId": user_id,
        "email": email,
        "name": name or "New User",
        "role": role,
        "roleDisplay": {
            "user": "Customer",
            "shop_owner": "Medical Shop Owner",
            "rider": "Delivery Rider"
        }.get(role, role),
    })


def emit_rider_assigned(
    order_id: str,
    tracking_number: Optional[str],
    rider_id: str,
    rider_email: str,
    rider_name: Optional[str],
    user_email: Optional[str],
    user_name: Optional[str],
    pharmacy_name: Optional[str],
    delivery_address: Optional[str],
) -> None:
    """Fired when a rider accepts/is assigned to an order."""
    _fire_webhook("rider.assigned", {
        "orderId": order_id,
        "trackingNumber": tracking_number or order_id,
        "riderId": rider_id,
        "riderEmail": rider_email,
        "riderName": rider_name or "Rider",
        "userEmail": user_email,
        "userName": user_name,
        "pharmacyName": pharmacy_name,
        "deliveryAddress": delivery_address,
    })


def emit_rider_delivered(
    order_id: str,
    tracking_number: Optional[str],
    rider_id: str,
    rider_name: Optional[str],
    user_email: Optional[str],
    user_name: Optional[str],
    total_amount: Optional[float],
    loyalty_earned: Optional[int],
) -> None:
    """Fired when an order is successfully delivered."""
    _fire_webhook("rider.delivered", {
        "orderId": order_id,
        "trackingNumber": tracking_number or order_id,
        "riderId": rider_id,
        "riderName": rider_name or "Rider",
        "userEmail": user_email,
        "userName": user_name,
        "totalAmount": total_amount,
        "loyaltyEarned": loyalty_earned,
    })


def emit_low_stock_alert(
    inventory_id: str,
    medicine_name: str,
    pharmacy_name: str,
    pharmacy_id: str,
    current_stock: int,
    threshold: int = 5,
) -> None:
    """Fired when a medicine's stock falls below the threshold."""
    _fire_webhook("low_stock.alert", {
        "inventoryId": inventory_id,
        "medicineName": medicine_name,
        "pharmacyName": pharmacy_name,
        "pharmacyId": pharmacy_id,
        "currentStock": current_stock,
        "threshold": threshold,
        "urgency": "critical" if current_stock == 0 else "low" if current_stock <= 2 else "warning",
    })
