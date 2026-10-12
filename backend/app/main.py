from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.limiter import limiter
from app.logger import logger
from app.services.document_files import MAX_FILES, MAX_SIZE
from app.api.v1.endpoints import assistant, auth, profile, records, search, upload

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
def parse_origins(raw: str) -> list[str]:
    """Split the comma-separated ALLOWED_ORIGINS setting into a clean list."""
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


allowed_origins = parse_origins(settings.ALLOWED_ORIGINS)

# Production must run with DEBUG off (it publishes the API docs) and with the
# real frontend origin only. Say so loudly at startup rather than silently.
if settings.DEBUG:
    logger.warning("DEBUG is on: API docs are public at /docs. Turn it off in production.")
if "*" in allowed_origins:
    logger.warning("ALLOWED_ORIGINS contains '*': any website may call this API from a browser.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,  # JWT is in Authorization header, not a cookie
    # Only what the frontend actually sends.
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# A request larger than the most an upload may be is refused before its body is
# read. Uploads are checked file by file as well (services.document_files).
MAX_REQUEST_BYTES = MAX_FILES * MAX_SIZE + 1024 * 1024


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_REQUEST_BYTES:
        return JSONResponse({"detail": "That upload is too large."}, status_code=413)
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # Responses carry medical records: never keep them in a browser or proxy cache.
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(auth.router,    prefix="/api/v1/auth",     tags=["auth"])
app.include_router(profile.router, prefix="/api/v1/profiles", tags=["profiles"])
app.include_router(upload.router,  prefix="/api/v1",          tags=["upload"])
app.include_router(records.router, prefix="/api/v1/profiles", tags=["records"])
app.include_router(search.router,  prefix="/api/v1",          tags=["search"])
app.include_router(assistant.router, prefix="/api/v1",        tags=["assistant"])


@app.get("/")
def root():
    return {"status": "MediVault API running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
