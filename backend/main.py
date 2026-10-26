from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from database import engine, get_db
from models import Base, Sale
from routers.predict import router as predict_router
from routers.analytics import router as analytics_router
from routers.delivery import router as delivery_router, _to_delivery_response
from routers.reports import router as reports_router


from schemas import (
    ProductCreate,
    ProductResponse,
    SaleCreate,
    SaleResponse,
    SaleItemResponse
)

from crud import (
    get_products,
    get_product_by_barcode,
    get_product_by_id,
    create_product,
    update_product,
    delete_product,
    create_sale,
    get_sales,
    get_sale_by_id
)


app = FastAPI(title="ShopFlow API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
app.include_router(predict_router)
app.include_router(analytics_router)
app.include_router(delivery_router)
app.include_router(reports_router)


# =========================
# BASIC
# =========================

@app.get("/")
def home():
    return {
        "message": "Welcome to ShopFlow API 🚀"
    }


@app.get("/test")
def test():
    return {
        "status": "Backend Working Successfully"
    }


# =========================
# PRODUCT APIs
# =========================

@app.get("/products")
def all_products(db: Session = Depends(get_db)):
    return get_products(db)


@app.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED
)
def add_product(
    product: ProductCreate,
    db: Session = Depends(get_db)
):
    existing = get_product_by_barcode(db, product.barcode)

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with barcode '{product.barcode}' already exists."
        )

    return create_product(db, product)


@app.get(
    "/products/barcode/{barcode}",
    response_model=ProductResponse
)
def get_product_by_barcode_route(
    barcode: str,
    db: Session = Depends(get_db)
):
    product = get_product_by_barcode(db, barcode)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No product found with barcode '{barcode}'."
        )

    return product


@app.get(
    "/products/{product_id}",
    response_model=ProductResponse
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = get_product_by_id(db, product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No product found with id {product_id}."
        )

    return product


@app.put(
    "/products/{product_id}",
    response_model=ProductResponse
)
def edit_product(
    product_id: int,
    product: ProductCreate,
    db: Session = Depends(get_db)
):
    existing_product = get_product_by_id(db, product_id)

    if not existing_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No product found with id {product_id}."
        )

    barcode_owner = get_product_by_barcode(db, product.barcode)

    if barcode_owner and barcode_owner.product_id != product_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Barcode '{product.barcode}' is already used by another product."
        )

    return update_product(db, product_id, product)


@app.delete("/products/{product_id}")
def remove_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    deleted = delete_product(db, product_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No product found with id {product_id}."
        )

    return {
        "message": f"Product '{deleted.product_name}' (id {product_id}) deleted successfully."
    }


# =========================
# BILLING - CREATE SALE
# =========================

@app.post(
    "/sales",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED
)
def make_sale(
    sale: SaleCreate,
    db: Session = Depends(get_db)
):
    # Step 1: Validate every item before writing anything
    validated_items = []

    for item in sale.items:
        product = get_product_by_id(db, item.product_id)

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with id {item.product_id} does not exist."
            )

        if product.stock < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for '{product.product_name}'. "
                    f"Available: {product.stock}, requested: {item.quantity}."
                )
            )

        validated_items.append((product, item.quantity))

    # Step 2: Create sale as one transaction
    try:
        db_sale = create_sale(
            db,
            payment_method=sale.payment_method,
            validated_items=validated_items,
            order_type=sale.order_type,
            delivery_info=sale.delivery_info
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create sale. Transaction rolled back, no stock was changed."
        )

    # Step 3: Build response
    return _to_sale_response(db_sale)


# =========================
# BILLING - SALES HISTORY
# =========================

def _to_sale_item_response(si) -> SaleItemResponse:
    product_name = (
        si.product.product_name
        if si.product
        else ("Archived Item" if si.product_id is None else f"Product #{si.product_id}")
    )
    return SaleItemResponse(
        sale_item_id=si.sale_item_id,
        product_id=si.product_id,
        product_name=product_name,
        quantity=si.quantity,
        unit_price=si.unit_price,
        subtotal=si.subtotal
    )


def _to_sale_response(db_sale: Sale) -> SaleResponse:
    delivery_res = None
    if db_sale.delivery:
        delivery_res = _to_delivery_response(db_sale.delivery)

    return SaleResponse(
        sale_id=db_sale.sale_id,
        user_id=db_sale.user_id,
        total_amount=db_sale.total_amount,
        payment_method=db_sale.payment_method,
        payment_status=db_sale.payment_status or "PAID",
        order_type=db_sale.order_type or "IN_STORE",
        sale_date=db_sale.sale_date,
        delivery=delivery_res,
        items=[
            _to_sale_item_response(si)
            for si in db_sale.sale_items
        ]
    )


@app.get(
    "/sales",
    response_model=list[SaleResponse]
)
def all_sales(db: Session = Depends(get_db)):
    sales = get_sales(db)

    return [
        _to_sale_response(s)
        for s in sales
    ]


@app.get(
    "/sales/{sale_id}",
    response_model=SaleResponse
)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db)
):
    sale = get_sale_by_id(db, sale_id)

    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No sale found with id {sale_id}."
        )

    return _to_sale_response(sale)  