from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time

router = APIRouter(prefix="/api", tags=["inventory"])

@router.get("/shop/inventory")
def get_shop_inventory(pharmacyId: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can view inventory")
        
    pharmacy = db.query(models.Pharmacy).filter(models.Pharmacy.id == pharmacyId).first()
    if not pharmacy:
        pharmacy = db.query(models.Pharmacy).first()
        if pharmacy:
            pharmacyId = pharmacy.id

    inventory = db.query(models.Inventory).options(
        joinedload(models.Inventory.medicine)
    ).filter(models.Inventory.pharmacyId == pharmacyId).all()

    return {
        "inventory": [
            {
                "id": inv.id,
                "medicineId": inv.medicineId,
                "pharmacyId": inv.pharmacyId,
                "price": inv.price,
                "stock": inv.stock,
                "sold": inv.sold or 0,
                "batchNumber": inv.batchNumber,
                "mrp": inv.mrp,
                "purchasePrice": inv.purchasePrice,
                "expiryDate": inv.expiryDate,
                "supplier": inv.supplier,
                "stockLocation": inv.stockLocation,
                "medicine": {
                    "id": inv.medicine.id,
                    "name": inv.medicine.name,
                    "genericName": inv.medicine.genericName,
                    "category": inv.medicine.category,
                    "manufacturer": inv.medicine.manufacturer
                }
            }
            for inv in inventory
        ]
    }

@router.post("/shop/inventory")
def update_shop_inventory(payload: schemas.InventoryActionPayload, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can update inventory")
        
    action = payload.action
    pharmacy_id = payload.pharmacyId
    
    if action == "add_medicine":
        med_name = payload.medicineName
        category = payload.category
        price = payload.price or 0.0
        stock = payload.stock or 0
            
        if not med_name:
            raise HTTPException(status_code=400, detail="Medicine name is required")

        medicine = db.query(models.Medicine).filter(models.Medicine.name.ilike(f"%{med_name}%")).first()
        if not medicine:
            medicine = models.Medicine(id=generate_cuid(), name=med_name, category=category, createdAt=current_iso_time(), updatedAt=current_iso_time())
            db.add(medicine)
            db.flush()

        # Check if already exists in this pharmacy's inventory
        exists = db.query(models.Inventory).filter(models.Inventory.medicineId == medicine.id, models.Inventory.pharmacyId == pharmacy_id).first()
        if exists:
            exists.stock += stock
            exists.price = price
        else:
            inv = models.Inventory(id=generate_cuid(), medicineId=medicine.id, pharmacyId=pharmacy_id, price=price, stock=stock, createdAt=current_iso_time(), updatedAt=current_iso_time())
            db.add(inv)
        db.commit()
        return {"success": True}

    elif action == "update_stock":
        med_id = payload.medicineId
        if not med_id:
            raise HTTPException(status_code=400, detail="Medicine ID is required")
        inv = db.query(models.Inventory).filter(models.Inventory.medicineId == med_id, models.Inventory.pharmacyId == pharmacy_id).first()
        if inv:
            if payload.price is not None: 
                inv.price = payload.price
            if payload.stock is not None: 
                inv.stock = payload.stock
            db.commit()
        return {"success": True}

    elif action == "delete_medicine":
        med_id = payload.medicineId
        if not med_id:
            raise HTTPException(status_code=400, detail="Medicine ID is required")
        inv = db.query(models.Inventory).filter(models.Inventory.medicineId == med_id, models.Inventory.pharmacyId == pharmacy_id).first()
        if inv:
            db.delete(inv)
            db.commit()
        return {"success": True}

    return {"error": "Invalid action"}

@router.post("/shop/inventory/bulk-upload")
def bulk_upload_inventory(
    payload: schemas.BulkInventoryUploadRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can upload inventory")
        
    pharmacy_id = payload.pharmacyId
    if not pharmacy_id:
        raise HTTPException(status_code=400, detail="Pharmacy ID is required")
        
    pharmacy = db.query(models.Pharmacy).filter(models.Pharmacy.id == pharmacy_id).first()
    if not pharmacy:
        pharmacy = db.query(models.Pharmacy).first()
        if pharmacy:
            pharmacy_id = pharmacy.id

    strategy = payload.conflictStrategy or "update_add"
    added_count = 0
    updated_count = 0
    skipped_count = 0
    failed_count = 0
    errors = []
    
    # Pre-cache existing medicines and inventory
    existing_meds = {m.name.strip().lower(): m for m in db.query(models.Medicine).all()}
    existing_inv = {inv.medicineId: inv for inv in db.query(models.Inventory).filter(models.Inventory.pharmacyId == pharmacy_id).all()}
    
    for idx, item in enumerate(payload.items):
        try:
            name = (item.name or "").strip()
            if not name:
                failed_count += 1
                errors.append(f"Row {idx+1}: Missing medicine name")
                continue
                
            key = name.lower()
            medicine = existing_meds.get(key)
            
            if not medicine:
                med_id = generate_cuid()
                medicine = models.Medicine(
                    id=med_id,
                    name=name,
                    genericName=item.genericName,
                    category=item.category or "General",
                    manufacturer=item.manufacturer,
                    description=item.description or f"Quality {item.category or 'General'} medication.",
                    image="/medicine/placeholder.jpg",
                    createdAt=current_iso_time(),
                    updatedAt=current_iso_time()
                )
                db.add(medicine)
                existing_meds[key] = medicine
            else:
                if item.genericName and not medicine.genericName:
                    medicine.genericName = item.genericName
                if item.manufacturer and not medicine.manufacturer:
                    medicine.manufacturer = item.manufacturer
            
            inv = existing_inv.get(medicine.id)
            if inv:
                if strategy == "skip":
                    skipped_count += 1
                    continue
                elif strategy == "update_add":
                    inv.stock = (inv.stock or 0) + (int(item.stock) if item.stock is not None else 0)
                else: # replace
                    inv.stock = int(item.stock) if item.stock is not None else 0

                if item.price is not None and item.price >= 0:
                    inv.price = float(item.price)
                if item.mrp is not None and item.mrp >= 0:
                    inv.mrp = float(item.mrp)
                if item.purchasePrice is not None and item.purchasePrice >= 0:
                    inv.purchasePrice = float(item.purchasePrice)
                if item.batchNumber:
                    inv.batchNumber = item.batchNumber
                if item.expiryDate:
                    inv.expiryDate = item.expiryDate
                if item.supplier:
                    inv.supplier = item.supplier
                if item.stockLocation:
                    inv.stockLocation = item.stockLocation
                inv.updatedAt = current_iso_time()
                updated_count += 1
            else:
                selling_price = float(item.price) if item.price is not None else (float(item.mrp) if item.mrp is not None else 0.0)
                mrp_val = float(item.mrp) if item.mrp is not None else selling_price
                purchase_val = float(item.purchasePrice) if item.purchasePrice is not None else None
                new_inv = models.Inventory(
                    id=generate_cuid(),
                    medicineId=medicine.id,
                    pharmacyId=pharmacy_id,
                    price=selling_price,
                    mrp=mrp_val,
                    purchasePrice=purchase_val,
                    stock=int(item.stock) if item.stock is not None else 0,
                    batchNumber=item.batchNumber,
                    expiryDate=item.expiryDate,
                    supplier=item.supplier,
                    stockLocation=item.stockLocation,
                    sold=0,
                    createdAt=current_iso_time(),
                    updatedAt=current_iso_time()
                )
                db.add(new_inv)
                existing_inv[medicine.id] = new_inv
                added_count += 1
        except Exception as item_err:
            failed_count += 1
            errors.append(f"Row {idx+1} ({item.name}): {str(item_err)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save inventory: {str(e)}")
        
    return {
        "success": True,
        "totalProcessed": len(payload.items),
        "added": added_count,
        "updated": updated_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "errors": errors
    }

@router.get("/inventory/{medicineId}")

def get_inventory_by_medicine(medicineId: str, db: Session = Depends(get_db)):
    inventory = db.query(models.Inventory).options(
        joinedload(models.Inventory.pharmacy)
    ).filter(models.Inventory.medicineId == medicineId).all()

    return {
        "inventory": [
            {
                "id": inv.id,
                "medicineId": inv.medicineId,
                "pharmacyId": inv.pharmacyId,
                "price": inv.price,
                "stock": inv.stock,
                "pharmacy": {
                    "id": inv.pharmacy.id,
                    "name": inv.pharmacy.name,
                    "location": inv.pharmacy.location,
                    "latitude": inv.pharmacy.latitude,
                    "longitude": inv.pharmacy.longitude,
                    "rating": inv.pharmacy.rating,
                    "distance": inv.pharmacy.distance,
                    "phone": inv.pharmacy.phone,
                    "openingTime": inv.pharmacy.openingTime,
                    "closingTime": inv.pharmacy.closingTime,
                    "isAvailable": inv.pharmacy.isAvailable
                }
            }
            for inv in inventory
        ]
    }

@router.get("/search")
def search_medicines(q: str = Query(""), db: Session = Depends(get_db)):
    if not q:
        medicines = db.query(models.Medicine).limit(50).all()
    else:
        medicines = db.query(models.Medicine).filter(
            or_(
                models.Medicine.name.ilike(f"%{q}%"),
                models.Medicine.category.ilike(f"%{q}%"),
                models.Medicine.indications.ilike(f"%{q}%")
            )
        ).limit(50).all()

    results = []
    for m in medicines:
        inv_list = db.query(models.Inventory).filter(
            models.Inventory.medicineId == m.id,
            models.Inventory.stock > 0
        ).all()
        min_price = min((i.price for i in inv_list), default=None)
        results.append({
            "id": m.id,
            "name": m.name,
            "description": m.description,
            "category": m.category,
            "indications": m.indications,
            "image": m.image,
            "inventory": [{"price": i.price, "stock": i.stock} for i in inv_list],
            "storeCount": len(inv_list),
            "startingPrice": min_price
        })

    return {"results": results}
