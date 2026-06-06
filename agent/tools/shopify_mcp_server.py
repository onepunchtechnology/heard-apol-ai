#!/usr/bin/env python3
"""Shopify Admin MCP server — exposes order lookup as a tool for the DrafterAgent.

Credentials are injected via environment variables by the parent process:
  SHOPIFY_SHOP_DOMAIN   e.g. ohayopop.myshopify.com
  SHOPIFY_ACCESS_TOKEN  Shopify Admin API access token (custom app)
"""
import json
import os

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("shopify-admin")

SHOPIFY_API_VERSION = "2026-01"


@mcp.tool()
async def fetch_order_context(reviewer_name: str) -> str:
    """Look up the most recent Shopify order matching a reviewer's name.

    Call this before drafting a reply whenever needs_order_context is true.

    Args:
        reviewer_name: The name of the customer who left the review.

    Returns:
        JSON string with order details (order_name, financial_status,
        fulfillment_status, line_items, created_at), or a message if no
        matching order is found.
    """
    shop_domain = os.environ.get("SHOPIFY_SHOP_DOMAIN", "")
    access_token = os.environ.get("SHOPIFY_ACCESS_TOKEN", "")

    if not shop_domain or not access_token:
        return json.dumps({"result": "Shopify credentials not configured — skipping order lookup."})

    url = f"https://{shop_domain}/admin/api/{SHOPIFY_API_VERSION}/orders.json"
    params = {
        "status": "any",
        "limit": 5,
        "fields": "id,name,email,customer,line_items,financial_status,fulfillment_status,created_at",
    }
    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params, headers=headers)
        if resp.status_code != 200:
            return json.dumps({"result": f"Shopify API returned {resp.status_code} — no order context available."})
        orders = resp.json().get("orders", [])

    name_lower = reviewer_name.lower().strip()
    for order in orders:
        customer = order.get("customer") or {}
        full_name = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip().lower()
        if name_lower and (name_lower in full_name or full_name in name_lower):
            return json.dumps({
                "order_name": order.get("name"),
                "financial_status": order.get("financial_status"),
                "fulfillment_status": order.get("fulfillment_status"),
                "line_items": [
                    {"title": item.get("title"), "quantity": item.get("quantity")}
                    for item in order.get("line_items", [])
                ],
                "created_at": order.get("created_at"),
            })

    return json.dumps({"result": f"No order found for reviewer '{reviewer_name}'."})


if __name__ == "__main__":
    mcp.run()
