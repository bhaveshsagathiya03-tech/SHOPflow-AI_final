from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional
from datetime import datetime, timedelta, date

from database import get_db
from models import Sale, SaleItem, Product, Delivery

router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)


@router.get("/summary")
def reports_summary(
    period: Optional[str] = Query("30d", description="Time period: 7d, 30d, 90d, 365d, all"),
    db: Session = Depends(get_db)
):
    """
    Comprehensive report summary: revenue, profit, orders, delivery, payment
    breakdown, top products, category sales, daily revenue trend.
    """
    # Compute date cutoff
    cutoff_date = None
    if period != "all":
        days_map = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}
        days = days_map.get(period, 30)
        cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Base sales query
    sales_q = db.query(Sale)
    if cutoff_date:
        sales_q = sales_q.filter(Sale.sale_date >= cutoff_date)

    all_sales = sales_q.all()

    total_sales_count = len(all_sales)
    total_revenue = sum(float(s.total_amount or 0) for s in all_sales)
    in_store_count = sum(1 for s in all_sales if (s.order_type or "IN_STORE") == "IN_STORE")
    delivery_count = sum(1 for s in all_sales if (s.order_type or "IN_STORE") == "DELIVERY")

    # Payment method breakdown
    payment_methods = {}
    for s in all_sales:
        pm = s.payment_method or "UNKNOWN"
        payment_methods[pm] = payment_methods.get(pm, 0) + float(s.total_amount or 0)

    payment_method_breakdown = [
        {"method": k, "revenue": round(v, 2)}
        for k, v in sorted(payment_methods.items(), key=lambda x: -x[1])
    ]

    # Gross profit (revenue minus cost)
    items_q = (
        db.query(SaleItem, Product)
        .join(Product, SaleItem.product_id == Product.product_id)
    )
    if cutoff_date:
        items_q = items_q.join(Sale, SaleItem.sale_id == Sale.sale_id).filter(
            Sale.sale_date >= cutoff_date
        )

    gross_profit = 0.0
    total_units_sold = 0
    for si, prod in items_q.all():
        revenue = float(si.subtotal or 0)
        cost = float(prod.buying_price or 0) * int(si.quantity or 0)
        gross_profit += revenue - cost
        total_units_sold += int(si.quantity or 0)

    # Top products by revenue
    top_products_q = (
        db.query(
            Product.product_name,
            Product.category,
            func.sum(SaleItem.quantity).label("qty_sold"),
            func.sum(SaleItem.subtotal).label("revenue"),
        )
        .join(SaleItem, Product.product_id == SaleItem.product_id)
        .join(Sale, SaleItem.sale_id == Sale.sale_id)
    )
    if cutoff_date:
        top_products_q = top_products_q.filter(Sale.sale_date >= cutoff_date)

    top_products_q = (
        top_products_q
        .group_by(Product.product_id, Product.product_name, Product.category)
        .order_by(func.sum(SaleItem.subtotal).desc())
        .limit(10)
        .all()
    )

    top_products = [
        {
            "product_name": r.product_name,
            "category": r.category,
            "qty_sold": int(r.qty_sold or 0),
            "revenue": round(float(r.revenue or 0), 2),
        }
        for r in top_products_q
    ]

    # Category breakdown
    cat_q = (
        db.query(
            Product.category,
            func.sum(SaleItem.quantity).label("qty_sold"),
            func.sum(SaleItem.subtotal).label("revenue"),
        )
        .join(SaleItem, Product.product_id == SaleItem.product_id)
        .join(Sale, SaleItem.sale_id == Sale.sale_id)
    )
    if cutoff_date:
        cat_q = cat_q.filter(Sale.sale_date >= cutoff_date)

    cat_q = (
        cat_q
        .group_by(Product.category)
        .order_by(func.sum(SaleItem.subtotal).desc())
        .all()
    )

    category_breakdown = [
        {
            "category": r.category or "Uncategorized",
            "qty_sold": int(r.qty_sold or 0),
            "revenue": round(float(r.revenue or 0), 2),
        }
        for r in cat_q
    ]

    # Daily revenue trend
    daily_q = (
        db.query(
            func.date(Sale.sale_date).label("day"),
            func.sum(Sale.total_amount).label("revenue"),
            func.count(Sale.sale_id).label("orders"),
        )
        .group_by(func.date(Sale.sale_date))
        .order_by(func.date(Sale.sale_date))
    )
    if cutoff_date:
        daily_q = daily_q.filter(Sale.sale_date >= cutoff_date)

    daily_trend = [
        {
            "date": str(r.day),
            "revenue": round(float(r.revenue or 0), 2),
            "orders": int(r.orders or 0),
        }
        for r in daily_q.all()
    ]

    # Delivery stats
    del_q = db.query(Delivery)
    if cutoff_date:
        del_q = del_q.filter(Delivery.created_at >= cutoff_date)
    deliveries = del_q.all()

    delivery_stats = {
        "total": len(deliveries),
        "pending": sum(1 for d in deliveries if d.delivery_status == "PENDING"),
        "out_for_delivery": sum(1 for d in deliveries if d.delivery_status == "OUT_FOR_DELIVERY"),
        "delivered": sum(1 for d in deliveries if d.delivery_status == "DELIVERED"),
        "failed": sum(1 for d in deliveries if d.delivery_status == "FAILED"),
        "cancelled": sum(1 for d in deliveries if d.delivery_status == "CANCELLED"),
        "pod_collected": round(sum(
            float(d.amount_collected or 0)
            for d in deliveries if d.payment_status == "PAID"
        ), 2),
        "pod_outstanding": round(sum(
            float(d.amount_due or 0)
            for d in deliveries if d.payment_status == "UNPAID" and d.delivery_status == "DELIVERED"
        ), 2),
    }

    # Low-stock product alerts
    low_stock = (
        db.query(Product)
        .filter(Product.stock <= Product.min_stock)
        .order_by(Product.stock.asc())
        .limit(10)
        .all()
    )
    low_stock_items = [
        {
            "product_id": p.product_id,
            "product_name": p.product_name,
            "category": p.category,
            "stock": p.stock,
            "min_stock": p.min_stock,
            "barcode": p.barcode,
        }
        for p in low_stock
    ]

    return {
        "period": period,
        "total_sales_count": total_sales_count,
        "total_revenue": round(total_revenue, 2),
        "gross_profit": round(gross_profit, 2),
        "total_units_sold": total_units_sold,
        "in_store_count": in_store_count,
        "delivery_count": delivery_count,
        "payment_method_breakdown": payment_method_breakdown,
        "top_products": top_products,
        "category_breakdown": category_breakdown,
        "daily_trend": daily_trend,
        "delivery_stats": delivery_stats,
        "low_stock_alerts": low_stock_items,
    }
