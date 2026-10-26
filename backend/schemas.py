from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import datetime
from typing import Optional, List


class ProductBase(BaseModel):
    barcode: str = Field(..., min_length=1, max_length=50)
    product_name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=50)
    buying_price: Decimal = Field(..., gt=0)
    selling_price: Decimal = Field(..., gt=0)
    stock: int = Field(..., ge=0)
    min_stock: int = Field(..., ge=0)


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    product_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================
# BILLING & SALES SCHEMAS
# ==========================

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class DeliveryInfoCreate(BaseModel):
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_phone: str = Field(..., min_length=7, max_length=20)
    delivery_address: str = Field(..., min_length=5)
    delivery_notes: Optional[str] = None
    payment_method: str = Field("COD", description="COD (Cash on Delivery) or POD_UPI (UPI on Delivery)")


class SaleCreate(BaseModel):
    payment_method: str = Field(..., min_length=1, max_length=50)
    order_type: str = Field("IN_STORE", description="IN_STORE or DELIVERY")
    delivery_info: Optional[DeliveryInfoCreate] = None
    items: list[SaleItemCreate] = Field(..., min_length=1)


class SaleItemResponse(BaseModel):
    sale_item_id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)


# ==========================
# DELIVERY SCHEMAS
# ==========================

class DeliveryEventResponse(BaseModel):
    event_id: int
    status: str
    note: Optional[str] = None
    timestamp: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DeliveryResponse(BaseModel):
    delivery_id: int
    sale_id: int
    tracking_number: str
    customer_name: str
    customer_phone: str
    delivery_address: str
    delivery_notes: Optional[str] = None
    delivery_status: str
    payment_method: str
    payment_status: str
    amount_due: Decimal
    amount_collected: Decimal = Decimal(0)
    payment_collected_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    collected_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    events: List[DeliveryEventResponse] = []
    items: Optional[List[SaleItemResponse]] = None

    model_config = ConfigDict(from_attributes=True)


class DeliveryStatusUpdate(BaseModel):
    status: str = Field(..., description="PENDING, PREPARING, OUT_FOR_DELIVERY, DELIVERED, FAILED, CANCELLED")
    note: Optional[str] = None
    staff_name: Optional[str] = "Staff"


class CollectPaymentRequest(BaseModel):
    payment_method: str = Field(..., description="CASH or UPI")
    amount: Decimal = Field(..., gt=0)
    payment_reference: Optional[str] = None
    staff_name: Optional[str] = "Staff"
    notes: Optional[str] = None


class SaleResponse(BaseModel):
    sale_id: int
    user_id: Optional[int] = None
    total_amount: Decimal
    payment_method: str
    payment_status: Optional[str] = "PAID"
    order_type: Optional[str] = "IN_STORE"
    sale_date: Optional[datetime] = None
    delivery: Optional[DeliveryResponse] = None
    items: list[SaleItemResponse]

    model_config = ConfigDict(from_attributes=True)