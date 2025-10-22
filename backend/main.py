# from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from fastapi.middleware.cors import CORSMiddleware
# from starlette.middleware.base import BaseHTTPMiddleware
# from sqlalchemy.orm import Session
# from database import get_db
# from auth import router as auth_router
# from documents import router as documents_router
# from organization import router as organization_router
# from mfa import router as mfa_router
# from document_assignments import router as document_assignments_router
# from questionnaires import router as questionnaires_router
# from fastapi.responses import FileResponse
# from fastapi.staticfiles import StaticFiles

# app = FastAPI(
#     title="Comply-X API",
#     description="A comprehensive compliance management system API with authentication, RBAC, and modular compliance tools.",
#     version="1.0.0",
#     docs_url="/docs",
#     redoc_url="/redoc",
#     openapi_tags=[
#         {
#             "name": "authentication",
#             "description": "User authentication and authorization operations",
#         },
#         {
#             "name": "users",
#             "description": "User management operations",
#         },
#         {
#             "name": "health",
#             "description": "System health checks",
#         },
#         {
#             "name": "documents",
#             "description": "Document management operations",
#         },
#         {
#             "name": "organization",
#             "description": "Organization structure and user assignment operations",
#         },
#         {
#             "name": "mfa",
#             "description": "Multi-factor authentication and device management operations",
#         },
#         {
#             "name": "document-assignments",
#             "description": "Document assignment, scheduling, and cross-department tagging operations",
#         },
#         {
#             "name": "questionnaires",
#             "description": "Questionnaire builder and response collection operations",
#         },
#     ]
# )

# # Custom CORS middleware to ensure headers are always set
# class CustomCORSMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         origin = request.headers.get("origin")
#         allowed_origins = [
#             "https://comply-x-tyle.onrender.com",
#             # "http://localhost:3000",
#             # "http://127.0.0.1:3000"
#         ]
        
#         # Handle preflight requests
#         if request.method == "OPTIONS":
#             response = Response()
#             if origin in allowed_origins:
#                 response.headers["Access-Control-Allow-Origin"] = origin
#             response.headers["Access-Control-Allow-Credentials"] = "true"
#             response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
#             response.headers["Access-Control-Allow-Headers"] = "Accept, Accept-Language, Content-Language, Content-Type, Authorization, X-Requested-With, Origin"
#             response.headers["Access-Control-Max-Age"] = "600"
#             return response
        
#         response = await call_next(request)
        
#         # Add CORS headers to actual requests
#         if origin in allowed_origins:
#             response.headers["Access-Control-Allow-Origin"] = origin
#             response.headers["Access-Control-Allow-Credentials"] = "true"
#             response.headers["Access-Control-Expose-Headers"] = "*"
        
#         return response

# # CORS middleware
# app.add_middleware(CustomCORSMiddleware)
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "https://comply-x-tyle.onrender.com",
#         # "http://localhost:3000",
#         # "http://127.0.0.1:3000"
#     ],
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
#     allow_headers=[
#         "Accept",
#         "Accept-Language",
#         "Content-Language",
#         "Content-Type",
#         "Authorization",
#         "X-Requested-With",
#         "Origin",
#         "Access-Control-Request-Method",
#         "Access-Control-Request-Headers",
#     ],
#     expose_headers=["*"],
# )

# # Include routers
# app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
# app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
# app.include_router(organization_router, prefix="/api/organization", tags=["organization"])
# app.include_router(mfa_router, prefix="/api/mfa", tags=["mfa"])
# app.include_router(document_assignments_router, prefix="/api/document-assignments", tags=["document-assignments"])
# app.include_router(questionnaires_router, prefix="/api/questionnaires", tags=["questionnaires"])

# @app.get("/")
# async def root():
#     return {"message": "Comply-X API is running"}

# @app.get("/api/health", tags=["health"], summary="Health Check", description="Check if the API is running and healthy")
# async def health_check():
#     return {"status": "healthy", "message": "Comply-X API is running successfully"}

# @app.options("/{full_path:path}")
# async def options_handler(full_path: str):
#     return {"message": "OK"}

# app.mount("/_next", StaticFiles(directory="static/.next"), name="_next")
# app.mount("/public", StaticFiles(directory="static/public"), name="public")

# @app.get("/{full_path:path}")
# async def serve_frontend(full_path: str):
#     index_path = os.path.join("static", "public", "index.html")
#     if os.path.exists(index_path):
#         return FileResponse(index_path)
#     return {"message": "Comply-X API is running"}

# main.py
import os
from typing import Set

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from documents import router as documents_router
from organization import router as organization_router
from mfa import router as mfa_router
from document_assignments import router as document_assignments_router
from questionnaires import router as questionnaires_router
from fmea_router import router as fmea_router
# from calendar_module import router as calendar_module_router
# from app.routes.calendar_ai import router as calendar_ai_router
from calendar_api import router as calendar_api_router

try:
    from app.routes.calendar_ai import router as calendar_ai_router
except Exception:
    calendar_ai_router = None

try:
    from app.routes.fmea_ai import router as fmea_ai_router
except Exception:
    fmea_ai_router = None

try:
    from app.routes.document_ai import router as document_ai_router
except Exception:
    document_ai_router = None

try:
    from app.routes.audit_builder import router as audit_builder_router
except Exception:
    audit_builder_router = None

try:
    from app.routes.risk_assessment import router as risk_assessment_router
except Exception:
    risk_assessment_router = None

try:
    from app.routes.incident_reporting import router as incident_reporting_router
except Exception:
    incident_reporting_router = None

try:
    from app.routes.corrective_actions import router as corrective_actions_router
except Exception:
    corrective_actions_router = None

# ⬇️ import your models Base and engine
from models import Base
from database import engine

app = FastAPI(
    title="Comply-X API",
    description="Compliance management system API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

DEFAULT_ALLOWED_ORIGINS: Set[str] = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Production frontend currently deployed on Render
    "https://comply-x-tyle.onrender.com",
    "https://comply-one.vercel.app",
    "https://comply-git-main-satheshkumars-projects-4dc0dbec.vercel.app",
    "https://comply-qgnzm8qcx-satheshkumars-projects-4dc0dbec.vercel.app",
    # Allow same-origin calls when the frontend is served from the API host
    "https://comply-x.onrender.com",
    "https://comply-9dpi.onrender.com",
}


def _load_additional_cors_origins() -> Set[str]:
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
    if not raw:
        return set()
    return {origin.strip() for origin in raw.split(",") if origin.strip()}


ALLOWED_ORIGINS = sorted(DEFAULT_ALLOWED_ORIGINS | _load_additional_cors_origins())

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    # allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_methods=["*"],
    # allow_headers=[
    #     "Accept","Accept-Language","Content-Language","Content-Type","Authorization",
    #     "X-Requested-With","Origin","Access-Control-Request-Method","Access-Control-Request-Headers",
    # ],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.on_event("startup")
def _create_tables_on_startup():
    # Safe to call repeatedly; will only create missing tables
    Base.metadata.create_all(bind=engine)

@app.get("/")
async def root():
    return {"message": "Comply-X API is running"}

@app.get("/api/health", tags=["health"], summary="Health Check")
async def health_check():
    return {"status": "healthy", "message": "Comply-X API is running successfully"}

# Routers (your prefixes as you currently have them)
app.include_router(auth_router,                 prefix="/api/auth",                  tags=["authentication"])
app.include_router(documents_router,            prefix="/api/documents",             tags=["documents"])
app.include_router(organization_router,         prefix="/api/organization",          tags=["organization"])
app.include_router(mfa_router,                  prefix="/api/mfa",                   tags=["mfa"])
app.include_router(document_assignments_router, prefix="/api/document-assignments",  tags=["document-assignments"])
app.include_router(questionnaires_router,       prefix="/api/questionnaires",        tags=["questionnaires"])
app.include_router(fmea_router,                 prefix="/api",                       tags=["fmea"])
# app.include_router(calendar_module_router,      prefix="/api",                       tags=["calendar"])
# app.include_router(calendar_ai_router,          prefix="/api",                       tags=["calendar-ai"])
app.include_router(calendar_api_router)

if audit_builder_router:
    app.include_router(audit_builder_router)

if calendar_ai_router:
    # most AI examples use router without a prefix; put it under /api
    app.include_router(calendar_ai_router,      prefix="/api",                      tags=["calendar-ai"])

if fmea_ai_router:
    app.include_router(fmea_ai_router,          prefix="/api",                      tags=["fmea-ai"])

if document_ai_router:
    app.include_router(document_ai_router,     prefix="/api",                      tags=["documents-ai"])

if risk_assessment_router:
    app.include_router(risk_assessment_router)

if incident_reporting_router:
    app.include_router(incident_reporting_router)

if corrective_actions_router:
    app.include_router(corrective_actions_router)

# Optional: manual init endpoint if you ever need to click it
@app.post("/api/dev/init-db", tags=["health"])
def init_db_now():
    Base.metadata.create_all(bind=engine)
    return {"ok": True}
