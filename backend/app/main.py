from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.limiter import limiter
from app.api.v1.endpoints import auth, profile, upload, records, search

app = FastAPI(
    title="MediVault API",
    version="1.0.0",
    description="AI-powered personal medical records assistant",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: allow_credentials must be True when sending Authorization headers
# from a browser. allow_origins cannot be ["*"] when credentials=True,
# so ALLOWED_ORIGINS must list the real frontend domain(s) explicitly.
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,  # JWT is in Authorization header, not a cookie
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


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
