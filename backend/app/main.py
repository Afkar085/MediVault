from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1.endpoints import auth, profile, upload, records, search

app = FastAPI(
    title="MediVault API",
    version="1.0.0",
    description="AI-powered personal medical records assistant",
)

# CORS: origins are configurable via the FRONTEND_ORIGINS env var (comma-separated)
# so production can be locked down to the deployed frontend instead of "*".
# allow_credentials stays False because the JWT travels in the Authorization
# header, not a cookie.
allowed_origins = [o.strip() for o in settings.FRONTEND_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,    prefix="/api/v1/auth",     tags=["auth"])
app.include_router(profile.router, prefix="/api/v1/profiles", tags=["profiles"])
app.include_router(upload.router,  prefix="/api/v1",          tags=["upload"])
app.include_router(records.router, prefix="/api/v1/profiles", tags=["records"])
app.include_router(search.router,  prefix="/api/v1",          tags=["search"])


@app.get("/")
def root():
    return {"status": "MediVault API running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
