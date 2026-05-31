from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import auth, profile, upload, records, search

app = FastAPI(
    title="MediVault API",
    version="1.0.0",
    description="AI-powered personal medical records assistant",
)

# CORS: allow_credentials must be True when sending Authorization headers
# from a browser. allow_origins cannot be ["*"] when credentials=True,
# so we use a permissive list for MVP and tighten this in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # JWT is in Authorization header, not a cookie
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
