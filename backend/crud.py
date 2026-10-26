from sqlalchemy.orm import Session
from sqlalchemy import or_
from models import Product, Sale, SaleItem, Delivery, DeliveryEvent
from schemas import ProductCreate, DeliveryInfoCreate
from datetime import datetime, timezone
from typing import Optional


# ==========================
# PRODUCT CRUD
# ==========================

def get_products(db: Session):
    return db.query(Product).all()


def get_product_by_barcode(db: Session, barcode: str):
    return db.query(Product).filter(Product.barcode == barcode).first()


def get_product_by_id(db: Session, product_id: int):
    return db.query(Product).filter(Product.product_id == product_id).first()


def create_product(db: Session, product: ProductCreate):
    db_product = Product(
        barcode=product.barcode,
        product_name=product.product_name,
        category=product.category,
        buying_price=product.buying_price,
        selling_price=product.selling_price,
        stock=product.stock,
        min_stock=product.min_stock,
        created_at=datetime.now(timezone.utc)
    )

    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    return db_product


def update_product(db: Session, product_id: int, product_data: ProductCreate):
    db_product = get_product_by_id(db, product_id)

    if not db_product:
        return None

    db_product.barcode = product_data.barcode
    db_product.product_name = product_data.product_name
    db_product.category = product_data.category
    db_product.buying_price = product_data.buying_price
    db_product.selling_price = product_data.selling_price
    db_product.stock = product_data.stock
    db_product.min_stock = product_data.min_stock

    db.commit()
    db.refresh(db_product)

    return db_product


def delete_product(db: Session, product_id: int):
    db_product = get_product_by_id(db, product_id)

    if not db_product:
        return None

    db.delete(db_product)
    db.commit()

    return db_product


# ==========================
# SALES & BILLING CRUD
# ==========================

def create_sale(
    db: Session,
    payment_method: str,
    validated_items: list[tuple[Product, int]],
    order_type: str = "IN_STORE",
    delivery_info: Optional[DeliveryInfoCreate] = None
):
    """
    Creates a sale and (if order_type == 'DELIVERY') sets up the Delivery record
    and status events atomically in one database transaction.
    """
    is_delivery = order_type == "DELIVERY"
    initial_payment_status = "UNPAID" if is_delivery else "PAID"

    db_sale = Sale(
        user_id=None,
        total_amount=0,  # calculated below
        payment_method=delivery_info.payment_method if is_delivery and delivery_info else payment_method,
        payment_status=initial_payment_status,
        order_type=order_type,
        sale_date=datetime.now(timezone.utc)
    )
    db.add(db_sale)
    db.flush()

    total_amount = 0

    for product, quantity in validated_items:
        if product.stock < quantity:
            raise ValueError(f"Insufficient stock for '{product.product_name}' during transaction.")

        unit_price = product.selling_price
        subtotal = unit_price * quantity
        total_amount += subtotal

        db_sale_item = SaleItem(
            sale_id=db_sale.sale_id,
            product_id=product.product_id,
            quantity=quantity,
            unit_price=unit_price,
            subtotal=subtotal
        )
        db.add(db_sale_item)
        product.stock -= quantity

    db_sale.total_amount = total_amount

    # If delivery order, create delivery record linked to sale
    if is_delivery and delivery_info:
        tracking_number = f"SF-DEL-{1000 + db_sale.sale_id}"
        now = datetime.now(timezone.utc)

        db_delivery = Delivery(
            sale_id=db_sale.sale_id,
            tracking_number=tracking_number,
            customer_name=delivery_info.customer_name,
            customer_phone=delivery_info.customer_phone,
            delivery_address=delivery_info.delivery_address,
            delivery_notes=delivery_info.delivery_notes,
            delivery_status="PENDING",
            payment_method=delivery_info.payment_method,
            payment_status="UNPAID",
            amount_due=total_amount,
            amount_collected=0,
            created_at=now,
            updated_at=now
        )
        db.add(db_delivery)
        db.flush()

        # Log initial event
        init_event = DeliveryEvent(
            delivery_id=db_delivery.delivery_id,
            status="PENDING",
            note=f"Order created ({delivery_info.payment_method}). Payment of ₹{total_amount:.2f} due upon delivery.",
            timestamp=now,
            updated_by="Store Terminal"
        )
        db.add(init_event)

    db.commit()
    db.refresh(db_sale)
    return db_sale


def get_sales(db: Session):
    return db.query(Sale).order_by(Sale.sale_date.desc()).all()


def get_sale_by_id(db: Session, sale_id: int):
    return db.query(Sale).filter(Sale.sale_id == sale_id).first()


# ==========================
# DELIVERY & POD CRUD
# ==========================

# Valid state machine transitions
ALLOWED_TRANSITIONS = {
    "PENDING": ["PREPARING", "CANCELLED"],
    "PREPARING": ["OUT_FOR_DELIVERY", "CANCELLED"],
    "OUT_FOR_DELIVERY": ["DELIVERED", "FAILED"],
    "FAILED": ["OUT_FOR_DELIVERY", "CANCELLED"],
    "DELIVERED": [],  # Terminal delivery state
    "CANCELLED": []   # Terminal cancelled state
}


def get_deliveries(
    db: Session,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    search: Optional[str] = None
):
    query = db.query(Delivery)

    if status and status != "all":
        query = query.filter(Delivery.delivery_status == status.upper())

    if payment_status and payment_status != "all":
        query = query.filter(Delivery.payment_status == payment_status.upper())

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Delivery.tracking_number.ilike(s),
                Delivery.customer_name.ilike(s),
                Delivery.customer_phone.ilike(s),
                Delivery.delivery_address.ilike(s)
            )
        )

    return query.order_by(Delivery.created_at.desc()).all()


def get_delivery_by_id(db: Session, delivery_id: int):
    return db.query(Delivery).filter(Delivery.delivery_id == delivery_id).first()


def get_delivery_by_tracking(db: Session, identifier: str):
    """
    Looks up delivery by tracking number (e.g. 'SF-DEL-1014') or numeric ID
    """
    clean_id = identifier.strip()
    delivery = db.query(Delivery).filter(Delivery.tracking_number == clean_id).first()

    if not delivery and clean_id.isdigit():
        delivery = db.query(Delivery).filter(Delivery.delivery_id == int(clean_id)).first()

    if not delivery and clean_id.startswith("DEL-") and clean_id[4:].isdigit():
        delivery = db.query(Delivery).filter(Delivery.delivery_id == int(clean_id[4:])).first()

    return delivery


def update_delivery_status(
    db: Session,
    delivery_id: int,
    new_status: str,
    note: Optional[str] = None,
    staff_name: str = "Staff"
):
    delivery = get_delivery_by_id(db, delivery_id)
    if not delivery:
        raise ValueError(f"Delivery with ID #{delivery_id} does not exist.")

    current_status = delivery.delivery_status.upper()
    target_status = new_status.upper()

    if target_status == current_status:
        return delivery

    allowed = ALLOWED_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        raise ValueError(
            f"Invalid transition from '{current_status}' to '{target_status}'. "
            f"Allowed next states: {allowed if allowed else 'None (terminal state)'}"
        )

    now = datetime.now(timezone.utc)
    delivery.delivery_status = target_status
    delivery.updated_at = now

    if target_status == "DELIVERED":
        delivery.delivered_at = now
        event_note = note or "Package safely delivered to customer."
    elif target_status == "CANCELLED":
        # Restore stock if cancelled before delivery
        if current_status != "DELIVERED" and delivery.sale:
            for item in delivery.sale.sale_items:
                if item.product:
                    item.product.stock += item.quantity
        event_note = note or "Order cancelled. Inventory stock restored."
    elif target_status == "FAILED":
        event_note = note or "Delivery attempt failed (customer unavailable / address issue)."
    elif target_status == "OUT_FOR_DELIVERY":
        event_note = note or "Dispatched with courier. Out for delivery."
    elif target_status == "PREPARING":
        event_note = note or "Order packaged and staged for pickup."
    else:
        event_note = note or f"Status updated to {target_status}."

    event = DeliveryEvent(
        delivery_id=delivery.delivery_id,
        status=target_status,
        note=event_note,
        timestamp=now,
        updated_by=staff_name
    )
    db.add(event)

    db.commit()
    db.refresh(delivery)
    return delivery


def collect_delivery_payment(
    db: Session,
    delivery_id: int,
    payment_method: str,
    amount: float,
    payment_reference: Optional[str] = None,
    staff_name: str = "Staff",
    notes: Optional[str] = None
):
    delivery = get_delivery_by_id(db, delivery_id)
    if not delivery:
        raise ValueError(f"Delivery with ID #{delivery_id} does not exist.")

    if delivery.payment_status == "PAID":
        raise ValueError("Payment has already been collected and verified for this delivery.")

    if float(amount) < float(delivery.amount_due):
        raise ValueError(f"Collected amount (₹{amount:.2f}) is less than total amount due (₹{delivery.amount_due:.2f}).")

    now = datetime.now(timezone.utc)
    method_normalized = payment_method.upper()

    delivery.payment_status = "PAID"
    delivery.payment_method = method_normalized
    delivery.amount_collected = amount
    delivery.payment_collected_at = now
    delivery.payment_reference = payment_reference
    delivery.collected_by = staff_name
    delivery.updated_at = now

    # Also update linked sale record
    if delivery.sale:
        delivery.sale.payment_status = "PAID"
        delivery.sale.payment_method = method_normalized

    ref_str = f" [Ref/UTR: {payment_reference}]" if payment_reference else ""
    event_note = notes or f"Payment of ₹{amount:.2f} collected via {method_normalized} by {staff_name}.{ref_str}"

    event = DeliveryEvent(
        delivery_id=delivery.delivery_id,
        status="PAYMENT_COLLECTED",
        note=event_note,
        timestamp=now,
        updated_by=staff_name
    )
    db.add(event)

    db.commit()
    db.refresh(delivery)
    return delivery