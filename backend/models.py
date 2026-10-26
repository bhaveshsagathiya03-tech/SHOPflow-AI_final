from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String, unique=True)
    product_name = Column(String)
    category = Column(String)
    buying_price = Column(Numeric)
    selling_price = Column(Numeric)
    stock = Column(Integer)
    min_stock = Column(Integer)
    created_at = Column(TIMESTAMP)

    sale_items = relationship("SaleItem", back_populates="product")


class Sale(Base):
    __tablename__ = "sales"

    sale_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)  # nullable until auth is implemented
    total_amount = Column(Numeric)
    payment_method = Column(String)  # CASH, UPI, CARD, COD, POD_UPI
    payment_status = Column(String, default="PAID")  # PAID, UNPAID, PENDING
    order_type = Column(String, default="IN_STORE")  # IN_STORE or DELIVERY
    sale_date = Column(TIMESTAMP)

    sale_items = relationship("SaleItem", back_populates="sale")
    delivery = relationship("Delivery", back_populates="sale", uselist=False)


class SaleItem(Base):
    __tablename__ = "sale_items"

    sale_item_id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"))
    product_id = Column(Integer, ForeignKey("products.product_id"))
    quantity = Column(Integer)
    unit_price = Column(Numeric)
    subtotal = Column(Numeric)

    sale = relationship("Sale", back_populates="sale_items")
    product = relationship("Product", back_populates="sale_items")


class Delivery(Base):
    __tablename__ = "deliveries"

    delivery_id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"), unique=True, index=True)
    tracking_number = Column(String, unique=True, index=True)  # e.g. "SF-DEL-1014"

    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    delivery_address = Column(Text, nullable=False)
    delivery_notes = Column(Text, nullable=True)

    # Lifecycle: PENDING -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED (or FAILED, CANCELLED)
    delivery_status = Column(String, default="PENDING", index=True)

    # Payment: COD or POD_UPI
    payment_method = Column(String, nullable=False)  # "COD" or "POD_UPI"
    payment_status = Column(String, default="UNPAID", index=True)  # "UNPAID", "PAID", "FAILED"

    amount_due = Column(Numeric, nullable=False)
    amount_collected = Column(Numeric, default=0)
    payment_collected_at = Column(TIMESTAMP, nullable=True)
    payment_reference = Column(String, nullable=True)  # UPI UTR or Cash slip ref
    collected_by = Column(String, nullable=True)  # Staff name e.g. "Lucky"

    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)
    delivered_at = Column(TIMESTAMP, nullable=True)

    sale = relationship("Sale", back_populates="delivery")
    events = relationship(
        "DeliveryEvent",
        back_populates="delivery",
        cascade="all, delete-orphan",
        order_by="DeliveryEvent.timestamp.asc()"
    )


class DeliveryEvent(Base):
    __tablename__ = "delivery_events"

    event_id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.delivery_id"), index=True)
    status = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    timestamp = Column(TIMESTAMP)
    updated_by = Column(String, default="Staff")

    delivery = relationship("Delivery", back_populates="events")