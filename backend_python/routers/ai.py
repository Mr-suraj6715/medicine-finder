from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time

router = APIRouter(tags=["ai"])

# ══════════════════════════════════════════════════════════════════════════════
# SAFE AI MEDICAL GUIDANCE SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

RED_FLAG_KEYWORDS = [
    "difficulty breathing","can't breathe","cannot breathe","shortness of breath",
    "chest pain","severe chest","heart attack","cardiac",
    "unconscious","fainted","collapse","loss of consciousness",
    "severe allergic","anaphylaxis","swollen throat","throat swelling",
    "very high fever","fever above 104","fever above 40","104 degree","40 degree",
    "seizure","convulsion","fits",
    "blood in vomit","vomiting blood","blood in stool","black stool",
    "severe abdominal pain","excruciating pain",
    "confusion","disoriented","not responsive",
    "stroke","facial drooping","arm weakness","slurred speech",
    "severe injury","head injury","fracture",
    "overdose","poisoning","swallowed something",
    "suicidal","self harm",
    "meningitis","stiff neck with fever",
    "severe dehydration","no urine","not urinating",
    "rapidly worsening","severe vomiting","can't keep anything down",
]

SYMPTOM_KNOWLEDGE = {
    "fever": {
        "label": "Mild Fever / Viral Symptoms",
        "description": "Mild fever is commonly associated with viral infections like the common cold or flu. Usually resolves in 3–5 days with rest and fluids.",
        "otc_keywords": ["paracetamol","dolo","calpol","ibuprofen","antipyretic"],
        "categories": ["Antipyretics","Analgesics"],
        "advice": "Stay hydrated, rest, and monitor temperature. Paracetamol reduces fever if uncomfortable.",
        "warning": "If fever persists >3 days, exceeds 39°C, or comes with rash/stiff neck, see a doctor.",
        "escalate_after_days": 3,
    },
    "headache": {
        "label": "Mild Headache",
        "description": "Mild headaches are caused by tension, dehydration, or stress. Most resolve with rest.",
        "otc_keywords": ["paracetamol","ibuprofen","aspirin","analgesic","dolo"],
        "categories": ["Analgesics"],
        "advice": "Rest in a quiet room, stay hydrated, and use a mild pain reliever.",
        "warning": "Seek immediate care for sudden severe headache, headache with fever and stiff neck, or post-injury headache.",
        "escalate_after_days": 2,
    },
    "cold": {
        "label": "Common Cold",
        "description": "Mild viral respiratory infection causing runny nose, sneezing, nasal congestion, mild sore throat, and low-grade fever.",
        "otc_keywords": ["cetirizine","loratadine","antihistamine","decongestant","cold","flu"],
        "categories": ["Respiratory","Analgesics","Antipyretics"],
        "advice": "Rest, drink warm fluids, and use saline nasal spray. Antihistamines relieve sneezing.",
        "warning": "See a doctor if symptoms worsen after 10 days or if you develop high fever or ear pain.",
        "escalate_after_days": 10,
    },
    "cough": {
        "label": "Cough (Dry or Productive)",
        "description": "Cough clears the airways. Dry cough is often throat irritation; productive cough may indicate a mild respiratory infection.",
        "otc_keywords": ["cough","bromhexine","expectorant","antitussive","respiratory"],
        "categories": ["Respiratory"],
        "advice": "Stay hydrated, use honey-lemon tea, avoid smoke. OTC cough syrups can help.",
        "warning": "See a doctor if cough lasts >3 weeks, has blood, chest pain, or breathing difficulty.",
        "escalate_after_days": 14,
    },
    "sore throat": {
        "label": "Sore Throat / Throat Irritation",
        "description": "Usually caused by viral infections or irritation. Most sore throats resolve in a few days.",
        "otc_keywords": ["throat","lozenges","antiseptic","gargle","analgesic"],
        "categories": ["Respiratory","Analgesics"],
        "advice": "Gargle with warm salt water, use throat lozenges, stay hydrated.",
        "warning": "Seek care for severe swallowing difficulty, high fever, or white patches on tonsils.",
        "escalate_after_days": 7,
    },
    "nasal congestion": {
        "label": "Nasal Congestion",
        "description": "Blocked nose usually from cold, allergies, or sinusitis.",
        "otc_keywords": ["nasal","decongestant","saline","antihistamine","cetirizine"],
        "categories": ["Respiratory"],
        "advice": "Use saline nasal spray. Decongestant sprays: max 3 consecutive days only.",
        "warning": "See doctor if congestion lasts >2 weeks or is accompanied by severe facial pain.",
        "escalate_after_days": 10,
    },
    "body ache": {
        "label": "Mild Body Ache / Muscle Pain",
        "description": "Body aches accompanying flu or overexertion.",
        "otc_keywords": ["paracetamol","ibuprofen","diclofenac","muscle","analgesic"],
        "categories": ["Analgesics"],
        "advice": "Rest, stay warm, and use mild pain relievers with food.",
        "warning": "Seek care for severe pain, muscle weakness, or pain after injury.",
        "escalate_after_days": 5,
    },
    "acidity": {
        "label": "Acidity / Heartburn / Indigestion",
        "description": "Caused by stomach acid reflux or indigestion after eating.",
        "otc_keywords": ["antacid","omeprazole","pantoprazole","gastrointestinal","digestive","acidity"],
        "categories": ["Gastrointestinal"],
        "advice": "Eat smaller meals, avoid spicy foods, don't lie down after eating. Antacids for quick relief.",
        "warning": "See a doctor for frequent heartburn, difficulty swallowing, or black stools.",
        "escalate_after_days": 7,
    },
    "allergy": {
        "label": "Mild Seasonal Allergy",
        "description": "Hay fever causing runny nose, sneezing, itchy eyes from pollen or environmental triggers.",
        "otc_keywords": ["cetirizine","loratadine","fexofenadine","antihistamine","allergy"],
        "categories": ["Respiratory"],
        "advice": "Avoid allergens, keep windows closed during high-pollen days, use antihistamines.",
        "warning": "Seek IMMEDIATE care for difficulty breathing, swelling of throat — may be anaphylaxis.",
        "escalate_after_days": 14,
    },
    "diarrhea": {
        "label": "Mild Diarrhea",
        "description": "Usually from food intolerance or minor infection. Resolves in 1–2 days with fluids.",
        "otc_keywords": ["ors","oral rehydration","loperamide","probiotics","electrolyte","gastrointestinal"],
        "categories": ["Gastrointestinal"],
        "advice": "Stay hydrated with ORS. Avoid dairy and fatty foods. BRAT diet recommended.",
        "warning": "Seek care for bloody diarrhea, severe dehydration signs, or diarrhea >2 days.",
        "escalate_after_days": 2,
    },
    "skin rash": {
        "label": "Minor Skin Rash / Irritation",
        "description": "Minor rashes from allergies, contact irritants, or dry skin.",
        "otc_keywords": ["calamine","hydrocortisone","antihistamine","cetirizine","dermatology"],
        "categories": ["Dermatology"],
        "advice": "Apply calamine lotion. Avoid scratching. Use fragrance-free soap.",
        "warning": "Seek IMMEDIATE care for rash with fever or breathing difficulty.",
        "escalate_after_days": 7,
    },
}

SAFETY_QUESTIONS = {
    "age": "How old is the patient? (Enter age in years)",
    "allergies": "Do you have any known drug allergies? (e.g., penicillin, aspirin, or 'none')",
    "pregnancy": "Are you pregnant or breastfeeding? (yes/no)",
    "conditions": "Do you have existing medical conditions? (e.g., diabetes, kidney issues, or 'none')",
}

PRESCRIPTION_KEYWORDS = [
    "amoxicillin","azithromycin","ciprofloxacin","metronidazole","doxycycline",
    "tramadol","codeine","morphine","prednisone","warfarin","insulin","metformin",
    "sertraline","fluoxetine","diazepam","alprazolam","clonazepam","antipsychotic",
]

def detect_red_flags(text: str) -> list:
    t = text.lower()
    return [f for f in RED_FLAG_KEYWORDS if f in t]

def identify_symptoms(text: str) -> list:
    t = text.lower()
    kw_map = {
        "fever":            ["fever","temperature","hot","pyrexia","chills","shivering"],
        "headache":         ["headache","head ache","head pain","migraine"],
        "cold":             ["cold","runny nose","sneezing","flu","viral","nasal discharge"],
        "cough":            ["cough","coughing","dry cough","productive cough"],
        "sore throat":      ["sore throat","throat pain","throat ache","swallowing pain"],
        "nasal congestion": ["nasal congestion","blocked nose","stuffy nose","congestion"],
        "body ache":        ["body ache","muscle pain","muscle ache","body pain","ache"],
        "acidity":          ["acidity","heartburn","indigestion","acid reflux","burning stomach","gas","bloating"],
        "allergy":          ["allergy","allergic","itchy eyes","hay fever","seasonal allergy"],
        "diarrhea":         ["diarrhea","loose motion","loose stool","watery stool"],
        "skin rash":        ["rash","itching","skin irritation","hives","urticaria"],
    }
    matched = []
    for cond, keywords in kw_map.items():
        if any(kw in t for kw in keywords):
            matched.append(cond)
    return matched

def is_prescription_med(name: str) -> bool:
    n = name.lower()
    return any(kw in n for kw in PRESCRIPTION_KEYWORDS)


@router.post("/api/ai-consultant")
def ai_consultant(req: schemas.AIConsultantRequest, db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(auth.get_optional_current_user)):
    symptoms_text = req.symptoms.strip()
    safety_info = req.safetyInfo or {}
    age = safety_info.get("age")
    allergies = safety_info.get("allergies", "")
    pregnancy = bool(safety_info.get("pregnancy", False))
    user_email = current_user.email if current_user else req.userEmail

    # 1. Red-flag detection
    red_flags = detect_red_flags(symptoms_text)
    if red_flags:
        return {
            "status": "RED_FLAG",
            "redFlags": red_flags[:3],
            "message": "⚠️ Your symptoms include warning signs that may require URGENT MEDICAL ATTENTION.",
            "advice": "Please do not attempt to self-treat these symptoms. Seek emergency care immediately.",
            "urgentAction": "Call emergency services (112) or visit the nearest emergency room NOW.",
            "showPharmacist": False,
            "showDoctor": True,
            "suggestedProducts": [],
            "conditions": [],
        }

    # 2. Safety info check
    missing = []
    if age is None: missing.append("age")
    if not allergies: missing.append("allergies")
    if missing:
        return {
            "status": "NEEDS_SAFETY_INFO",
            "missingFields": missing,
            "questions": {k: SAFETY_QUESTIONS[k] for k in missing},
            "message": "Before providing guidance, we need a few safety details.",
        }

    try: age_int = int(age)
    except: age_int = 25
    child_mode = age_int < 12
    elderly_mode = age_int >= 65

    # 3. Identify symptoms
    matched_conditions = identify_symptoms(symptoms_text)
    if not matched_conditions:
        return {
            "status": "NO_MATCH",
            "message": "I couldn't identify specific common symptoms from your description.",
            "advice": "Please describe symptoms more clearly (e.g., 'I have a fever and runny nose'). For complex symptoms, consult a doctor.",
            "showPharmacist": True,
            "showDoctor": True,
            "suggestedProducts": [],
            "conditions": [],
        }

    # 4. Build condition + inventory results
    condition_results = []
    all_products = []
    seen_ids = set()

    for cond_key in matched_conditions:
        cond = SYMPTOM_KNOWLEDGE.get(cond_key)
        if not cond:
            continue

        # Find OTC medicines from inventory
        cat_meds = db.query(models.Medicine).filter(
            models.Medicine.category.in_(cond["categories"])
        ).limit(20).all()

        name_meds = []
        for kw in cond["otc_keywords"][:3]:
            nm = db.query(models.Medicine).filter(
                models.Medicine.name.ilike(f"%{kw}%")
            ).limit(8).all()
            name_meds.extend(nm)

        candidates = {m.id: m for m in cat_meds + name_meds}
        products = []

        for med in candidates.values():
            if is_prescription_med(med.name): continue
            if len(products) >= 4: break

            inv_items = db.query(models.Inventory).options(
                joinedload(models.Inventory.pharmacy)
            ).filter(
                models.Inventory.medicineId == med.id,
                models.Inventory.stock > 0
            ).order_by(models.Inventory.price).limit(3).all()

            if not inv_items or med.id in seen_ids:
                continue
            seen_ids.add(med.id)

            # Safety warnings
            warns = []
            if allergies.lower() != "none":
                for allergen in ["aspirin","ibuprofen","penicillin"]:
                    if allergen in allergies.lower() and allergen in med.name.lower():
                        warns.append(f"⚠️ Possible allergen match: {allergen}. DO NOT use without pharmacist advice.")
            if pregnancy:
                for pk in ["ibuprofen","aspirin","codeine","naproxen"]:
                    if pk in med.name.lower():
                        warns.append(f"⚠️ {med.name} is NOT recommended during pregnancy. Consult your doctor.")
            if child_mode:
                for ck in ["aspirin","ibuprofen"]:
                    if ck in med.name.lower():
                        warns.append(f"⚠️ Not recommended for children under 12 without doctor advice.")

            pharmacies_avail = []
            for inv in inv_items:
                if inv.pharmacy:
                    pharmacies_avail.append({
                        "pharmacyName": inv.pharmacy.name,
                        "location": inv.pharmacy.location,
                        "price": round(inv.price, 2),
                        "stock": inv.stock,
                        "distance": inv.pharmacy.distance,
                        "rating": inv.pharmacy.rating,
                    })

            products.append({
                "medicineId": med.id,
                "name": med.name,
                "category": med.category,
                "otcStatus": "OTC",
                "indicatedFor": cond["label"],
                "generalUse": f"Used for relief of {cond['label'].lower()} symptoms.",
                "startingPrice": round(inv_items[0].price, 2),
                "availableIn": len(pharmacies_avail),
                "pharmacies": pharmacies_avail,
                "warnings": warns,
            })

        condition_results.append({
            "conditionKey": cond_key,
            "conditionLabel": cond["label"],
            "description": cond["description"],
            "selfCareAdvice": cond["advice"],
            "warning": cond["warning"],
            "escalateAfterDays": cond["escalate_after_days"],
            "productsFound": len(products),
        })
        all_products.extend(products)

    # 5. Log to health history
    if user_email:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if user:
            log = models.HealthLog(
                id=generate_cuid(), userId=user.id,
                symptoms=symptoms_text,
                prescription=", ".join([p["name"] for p in all_products[:5]]) or "General guidance only",
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(log); db.commit()

    extra_notes = []
    if child_mode: extra_notes.append("⚠️ Child under 12: Always confirm suitability with a pharmacist or doctor before giving any medicine.")
    if elderly_mode: extra_notes.append("ℹ️ Patients over 65 may need adjusted dosing. Consult your pharmacist.")
    if pregnancy: extra_notes.append("⚠️ Pregnant/breastfeeding: Always consult your doctor before taking any medicine.")

    return {
        "status": "OK",
        "symptomsReceived": symptoms_text,
        "conditionsIdentified": [c["conditionLabel"] for c in condition_results],
        "conditions": condition_results,
        "suggestedProducts": all_products[:10],
        "disclaimer": "ℹ️ This is general guidance only. Symptoms alone cannot confirm a diagnosis. Always read the product label. Consult a pharmacist or doctor if unsure.",
        "extraNotes": extra_notes,
        "showPharmacist": True,
        "showDoctor": len(matched_conditions) > 2 or child_mode or elderly_mode or pregnancy,
    }


@router.get("/api/ai-prescribe")
def get_ai_prescribe(email: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "user" and email.lower().strip() != current_user.email.lower().strip():
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(models.User).filter(models.User.email == email.lower().strip()).first()
    if not user:
        return {"healthLogs": []}
    logs = db.query(models.HealthLog).filter(models.HealthLog.userId == user.id).order_by(desc(models.HealthLog.createdAt)).all()
    return {"healthLogs": [{"id": l.id, "symptoms": l.symptoms, "prescription": l.prescription, "createdAt": l.createdAt} for l in logs]}


@router.post("/api/ai-prescribe")
def ai_prescribe(req: schemas.AIPrescribeRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Logs a prescription session for the authenticated user's health history.
    Accepts a validated Pydantic model instead of a raw dict for input safety.
    """
    email = req.userEmail or current_user.email
    if current_user.role == "user" and email.lower().strip() != current_user.email.lower().strip():
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(models.User).filter(models.User.email == email.lower().strip()).first()
    if user:
        db.add(models.HealthLog(
            id=generate_cuid(), userId=user.id,
            symptoms=req.prescriptionText or "General",
            prescription="General guidance only",
            createdAt=current_iso_time()
        ))
        db.commit()
    return {"extractedMedicines": [], "instructions": "Consult your pharmacist for correct dosage.", "success": True}


@router.get("/api/loyalty")
def get_loyalty(email: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Only the user themselves (or shop owners) can query loyalty points
    if current_user.role == "user" and email.lower().strip() != current_user.email.lower().strip():
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(models.User).filter(models.User.email == email.lower().strip()).first()
    return {"points": user.loyaltyPoints if user else 0}
