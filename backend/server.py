from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import base64
from io import BytesIO
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType, ImageContent
import re
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key')
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Common allergens database
COMMON_ALLERGENS = {
    "peanuts": {"keywords": ["peanut", "groundnut", "arachis"], "severity": "high"},
    "tree_nuts": {"keywords": ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut"], "severity": "high"},
    "dairy": {"keywords": ["milk", "cheese", "butter", "cream", "yogurt", "whey", "casein", "lactose"], "severity": "medium"},
    "eggs": {"keywords": ["egg", "albumin", "mayonnaise"], "severity": "medium"},
    "soy": {"keywords": ["soy", "soya", "tofu", "edamame", "tempeh"], "severity": "medium"},
    "wheat": {"keywords": ["wheat", "flour", "gluten", "semolina", "durum"], "severity": "medium"},
    "fish": {"keywords": ["fish", "salmon", "tuna", "cod", "anchovy"], "severity": "high"},
    "shellfish": {"keywords": ["shrimp", "crab", "lobster", "prawn", "clam", "oyster", "mussel"], "severity": "high"},
    "sesame": {"keywords": ["sesame", "tahini"], "severity": "medium"},
    "mustard": {"keywords": ["mustard"], "severity": "low"},
    "celery": {"keywords": ["celery", "celeriac"], "severity": "low"},
    "sulfites": {"keywords": ["sulfite", "sulphite", "sodium metabisulfite"], "severity": "medium"}
}

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AllergyProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    allergens: List[str] = []
    custom_allergens: List[str] = []
    severity_levels: Dict[str, str] = {}  # allergen: mild/moderate/severe
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AllergyProfileUpdate(BaseModel):
    allergens: List[str]
    custom_allergens: Optional[List[str]] = []
    severity_levels: Optional[Dict[str, str]] = {}

class ScannedProduct(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_name: str
    ingredients: List[str]
    allergens_detected: List[str]
    severity: str  # safe, mild, moderate, severe
    safe: bool
    scan_type: str  # image or manual
    notes: Optional[str] = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ManualScanRequest(BaseModel):
    product_name: str
    ingredients: str  # comma-separated or text

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def analyze_ingredients_with_ai(image_base64: str, user_allergens: List[str]) -> Dict:
    """Use Gemini to extract ingredients from food label image"""
    try:
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are an expert at reading food labels and extracting ingredient lists. Extract all ingredients from the image and return them as a clear list."
        ).with_model("gemini", "gemini-2.0-flash")

        image_content = ImageContent(image_base64=image_base64)
        
        message = UserMessage(
            text="Please analyze this food product label/image and extract: 1) Product name (if visible) 2) Complete list of ingredients. Return in format: PRODUCT: [name]\nINGREDIENTS: [comma-separated list]",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(message)
        return {"success": True, "analysis": response}
    except Exception as e:
        logging.error(f"AI analysis error: {str(e)}")
        return {"success": False, "error": str(e)}

def detect_allergens(ingredients: List[str], user_allergens: List[str], custom_allergens: List[str] = []) -> Dict:
    """Detect allergens in ingredient list"""
    detected = []
    severity_map = {}
    
    # Check against user's allergens
    for allergen in user_allergens:
        if allergen in COMMON_ALLERGENS:
            keywords = COMMON_ALLERGENS[allergen]["keywords"]
            for ingredient in ingredients:
                ingredient_lower = ingredient.lower()
                if any(keyword in ingredient_lower for keyword in keywords):
                    detected.append(allergen)
                    severity_map[allergen] = COMMON_ALLERGENS[allergen]["severity"]
                    break
    
    # Check custom allergens
    for custom in custom_allergens:
        custom_lower = custom.lower()
        for ingredient in ingredients:
            if custom_lower in ingredient.lower():
                detected.append(custom)
                severity_map[custom] = "medium"
                break
    
    # Determine overall severity
    if not detected:
        overall_severity = "safe"
        safe = True
    else:
        severities = list(severity_map.values())
        if "high" in severities:
            overall_severity = "severe"
        elif "medium" in severities:
            overall_severity = "moderate"
        else:
            overall_severity = "mild"
        safe = False
    
    return {
        "detected": detected,
        "severity": overall_severity,
        "safe": safe,
        "details": severity_map
    }

def parse_ingredients_text(text: str) -> List[str]:
    """Parse ingredients from text"""
    # Split by comma, semicolon, or newline
    ingredients = re.split(r'[,;\n]+', text)
    # Clean and filter
    return [ing.strip() for ing in ingredients if ing.strip()]

# Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        name=user_data.name
    )
    
    user_doc = user.model_dump()
    user_doc['password'] = hash_password(user_data.password)
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    # Create default allergy profile
    profile = AllergyProfile(user_id=user.id)
    profile_doc = profile.model_dump()
    profile_doc['updated_at'] = profile_doc['updated_at'].isoformat()
    await db.allergy_profiles.insert_one(profile_doc)
    
    token = create_access_token({"sub": user.id})
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email})
    if not user_doc or not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user_doc['id']})
    return {
        "token": token,
        "user": {"id": user_doc['id'], "email": user_doc['email'], "name": user_doc['name']}
    }

@api_router.get("/profile")
async def get_profile(user_id: str = Depends(get_current_user)):
    profile = await db.allergy_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        # Create default profile
        profile = AllergyProfile(user_id=user_id)
        profile_doc = profile.model_dump()
        profile_doc['updated_at'] = profile_doc['updated_at'].isoformat()
        await db.allergy_profiles.insert_one(profile_doc)
        return profile.model_dump()
    return profile

@api_router.put("/profile")
async def update_profile(profile_data: AllergyProfileUpdate, user_id: str = Depends(get_current_user)):
    profile_doc = profile_data.model_dump()
    profile_doc['user_id'] = user_id
    profile_doc['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.allergy_profiles.update_one(
        {"user_id": user_id},
        {"$set": profile_doc},
        upsert=True
    )
    
    return {"message": "Profile updated successfully", "profile": profile_doc}

@api_router.post("/scan/image")
async def scan_image(
    image: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    try:
        # Read and encode image
        contents = await image.read()
        img = Image.open(BytesIO(contents))
        
        # Convert to base64
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode()
        
        # Get user's allergy profile
        profile = await db.allergy_profiles.find_one({"user_id": user_id})
        if not profile:
            raise HTTPException(status_code=404, detail="Allergy profile not found")
        
        # Analyze with AI
        ai_result = await analyze_ingredients_with_ai(img_base64, profile.get('allergens', []))
        
        if not ai_result.get('success'):
            raise HTTPException(status_code=500, detail="Failed to analyze image")
        
        analysis_text = ai_result['analysis']
        
        # Parse product name and ingredients from AI response
        product_name = "Unknown Product"
        ingredients_text = analysis_text
        
        if "PRODUCT:" in analysis_text:
            parts = analysis_text.split("INGREDIENTS:")
            product_line = parts[0].replace("PRODUCT:", "").strip()
            product_name = product_line if product_line else "Unknown Product"
            if len(parts) > 1:
                ingredients_text = parts[1]
        
        ingredients = parse_ingredients_text(ingredients_text)
        
        # Detect allergens
        detection = detect_allergens(
            ingredients,
            profile.get('allergens', []),
            profile.get('custom_allergens', [])
        )
        
        # Save scan result
        scan = ScannedProduct(
            user_id=user_id,
            product_name=product_name,
            ingredients=ingredients,
            allergens_detected=detection['detected'],
            severity=detection['severity'],
            safe=detection['safe'],
            scan_type="image",
            notes=f"AI Analysis: {analysis_text[:200]}"
        )
        
        scan_doc = scan.model_dump()
        scan_doc['timestamp'] = scan_doc['timestamp'].isoformat()
        await db.scanned_products.insert_one(scan_doc)
        
        return {
            "scan_id": scan.id,
            "product_name": product_name,
            "ingredients": ingredients,
            "allergens_detected": detection['detected'],
            "severity": detection['severity'],
            "safe": detection['safe'],
            "details": detection['details']
        }
    
    except Exception as e:
        logging.error(f"Scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@api_router.post("/scan/manual")
async def scan_manual(
    scan_data: ManualScanRequest,
    user_id: str = Depends(get_current_user)
):
    try:
        # Get user's allergy profile
        profile = await db.allergy_profiles.find_one({"user_id": user_id})
        if not profile:
            raise HTTPException(status_code=404, detail="Allergy profile not found")
        
        # Parse ingredients
        ingredients = parse_ingredients_text(scan_data.ingredients)
        
        # Detect allergens
        detection = detect_allergens(
            ingredients,
            profile.get('allergens', []),
            profile.get('custom_allergens', [])
        )
        
        # Save scan result
        scan = ScannedProduct(
            user_id=user_id,
            product_name=scan_data.product_name,
            ingredients=ingredients,
            allergens_detected=detection['detected'],
            severity=detection['severity'],
            safe=detection['safe'],
            scan_type="manual"
        )
        
        scan_doc = scan.model_dump()
        scan_doc['timestamp'] = scan_doc['timestamp'].isoformat()
        await db.scanned_products.insert_one(scan_doc)
        
        return {
            "scan_id": scan.id,
            "product_name": scan_data.product_name,
            "ingredients": ingredients,
            "allergens_detected": detection['detected'],
            "severity": detection['severity'],
            "safe": detection['safe'],
            "details": detection['details']
        }
    
    except Exception as e:
        logging.error(f"Manual scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@api_router.get("/history")
async def get_history(user_id: str = Depends(get_current_user)):
    scans = await db.scanned_products.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    
    return {"scans": scans, "total": len(scans)}

@api_router.get("/allergens/common")
async def get_common_allergens():
    return {"allergens": list(COMMON_ALLERGENS.keys())}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()