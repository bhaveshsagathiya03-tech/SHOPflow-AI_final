from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from database import get_db
from models import Delivery, SaleItem
from schemas import (
    DeliveryResponse,
    DeliveryStatusUpdate,
    CollectPaymentRequest,
    DeliveryEventResponse,
    SaleItemResponse
)
from crud import (
    get_deliveries,
    get_delivery_by_id,
    get_delivery_by_tracking,
    update_delivery_status,
    collect_delivery_payment
)

router = APIRouter(
    prefix="/deliveries",
    tags=["Deliveries & POD"]
)


def _to_delivery_response(d: Delivery) -> DeliveryResponse:
    # Serialize items from the linked sale if present
    items = []
    if d.sale and d.sale.sale_items:
        for si in d.sale.sale_items:
            product_name = (
                si.product.product_name
                if si.product
                else ("Archived Item" if si.product_id is None else f"Product #{si.product_id}")
            )
            items.append(
                SaleItemResponse(
                    sale_item_id=si.sale_item_id,
                    product_id=si.product_id,
                    product_name=product_name,
                    quantity=si.quantity,
                    unit_price=si.unit_price,
                    subtotal=si.subtotal
                )
            )

    events = [
        DeliveryEventResponse(
            event_id=ev.event_id,
            status=ev.status,
            note=ev.note,
            timestamp=ev.timestamp,
            updated_by=ev.updated_by
        )
        for ev in d.events
    ]

    return DeliveryResponse(
        delivery_id=d.delivery_id,
        sale_id=d.sale_id,
        tracking_number=d.tracking_number,
        customer_name=d.customer_name,
        customer_phone=d.customer_phone,
        delivery_address=d.delivery_address,
        delivery_notes=d.delivery_notes,
        delivery_status=d.delivery_status,
        payment_method=d.payment_method,
        payment_status=d.payment_status,
        amount_due=d.amount_due,
        amount_collected=d.amount_collected or 0,
        payment_collected_at=d.payment_collected_at,
        payment_reference=d.payment_reference,
        collected_by=d.collected_by,
        created_at=d.created_at,
        updated_at=d.updated_at,
        delivered_at=d.delivered_at,
        events=events,
        items=items
    )


@router.get("", response_model=List[DeliveryResponse])
@router.get("/", response_model=List[DeliveryResponse])
def list_deliveries_route(
    status: Optional[str] = Query(None, description="Filter by status: PENDING, PREPARING, OUT_FOR_DELIVERY, DELIVERED, FAILED, CANCELLED"),
    payment_status: Optional[str] = Query(None, description="Filter by payment status: UNPAID, PAID"),
    search: Optional[str] = Query(None, description="Search tracking number, customer name, phone, or address"),
    db: Session = Depends(get_db)
):
    deliveries = get_deliveries(db, status=status, payment_status=payment_status, search=search)
    return [_to_delivery_response(d) for d in deliveries]


@router.get("/track/{identifier}", response_model=DeliveryResponse)
def track_delivery_route(
    identifier: str,
    db: Session = Depends(get_db)
):
    delivery = get_delivery_by_tracking(db, identifier)
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No delivery found matching tracking number or ID '{identifier}'."
        )
    return _to_delivery_response(delivery)


@router.get("/{delivery_id}", response_model=DeliveryResponse)
def get_delivery_route(
    delivery_id: int,
    db: Session = Depends(get_db)
):
    delivery = get_delivery_by_id(db, delivery_id)
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No delivery found with ID #{delivery_id}."
        )
    return _to_delivery_response(delivery)


@router.put("/{delivery_id}/status", response_model=DeliveryResponse)
def update_status_route(
    delivery_id: int,
    payload: DeliveryStatusUpdate,
    db: Session = Depends(get_db)
):
    try:
        updated = update_delivery_status(
            db,
            delivery_id=delivery_id,
            new_status=payload.status,
            note=payload.note,
            staff_name=payload.staff_name or "Staff"
        )
        return _to_delivery_response(updated)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{delivery_id}/collect-payment", response_model=DeliveryResponse)
def collect_payment_route(
    delivery_id: int,
    payload: CollectPaymentRequest,
    db: Session = Depends(get_db)
):
    try:
        updated = collect_delivery_payment(
            db,
            delivery_id=delivery_id,
            payment_method=payload.payment_method,
            amount=float(payload.amount),
            payment_reference=payload.payment_reference,
            staff_name=payload.staff_name or "Staff",
            notes=payload.notes
        )
        return _to_delivery_response(updated)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
