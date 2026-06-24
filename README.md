# MediVault

A full-stack web app that lets you store, organize, and search your medical records. Upload a prescription, lab report, or medical certificate — MediVault runs OCR + AI extraction to pull out doctor names, diagnoses, medicines, and more, so you can search across all your records instantly.

**Live demo:** [medivault on Railway](https://profound-smile-production-f645.up.railway.app)

## Features

- **Multi-profile support** — manage records for yourself and family members (spouse, parent, child, etc.)
- **Upload & auto-extract** — upload images (JPEG, PNG, WEBP, GIF, BMP) or PDFs (up to 10 MB). The app runs OCR in the background and uses AI to extract structured fields
- **AI-extracted fields** — document type, doctor name, hospital, date, specialty, diagnosis, recommendations, and medicines (with dosage, frequency, duration)
- **Full-text search** — search across all extracted fields (doctor, diagnosis, hospital, specialty, OCR text) with optional filters by document type and profile
- **Edit & correct** — fix any AI-extracted field; edits are tracked in an audit trail
- **Secure auth** — JWT-based signup/login with password hashing

## Tech stack

| Layer    | Technology                                               |
|----------|----------------------------------------------------------|
| Frontend | React 19, React Router, Axios                           |
| Backend  | FastAPI, Pydantic, Uvicorn                               |
| Database | PostgreSQL (via Supabase)                                |
| Storage  | Supabase Storage (medical-records bucket)                |
| OCR      | Tesseract (images), pdfminer + pdf2image (PDFs)          |
| AI       | Groq API (Llama 3.3 70B) for structured data extraction |
| Hosting  | Railway (backend), Vercel/Netlify-ready (frontend)       |

## Project structure

```
MediVault/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── config.py                # Environment settings
│   │   ├── database.py              # Supabase client
│   │   ├── core/                    # Auth dependencies
│   │   ├── schemas/                 # Pydantic models (auth, profile, record)
│   │   ├── services/
│   │   │   ├── ocr.py               # Tesseract + PDF text extraction
│   │   │   └── ai_extractor.py      # Groq/Llama structured extraction
│   │   └── api/v1/endpoints/
│   │       ├── auth.py              # Signup, login, password reset
│   │       ├── profile.py           # CRUD for family profiles
│   │       ├── upload.py            # File upload + background OCR
│   │       ├── records.py           # Record listing, detail, edit, delete
│   │       └── search.py            # Full-text search across records
│   ├── database/
│   │   ├── schema.sql               # Table definitions
│   │   └── seed.sql                 # Sample data
│   ├── requirements.txt
│   └── railway.json                 # Railway deployment config
├── frontend/
│   ├── src/
│   │   ├── App.js                   # Single-page app (auth + dashboard)
│   │   └── api.js                   # Axios client with JWT interceptor
│   └── package.json
└── .env.example                     # Required environment variables
```

## Getting started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq](https://console.groq.com) API key (free tier works)
- Tesseract OCR installed on your system

### 1. Clone the repo

```bash
git clone https://github.com/Afkar085/MediVault.git
cd MediVault
```

### 2. Set up the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy `.env.example` to `backend/.env` and fill in your keys:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_BUCKET=medivault-files
JWT_SECRET=any_long_random_string_here
JWT_EXPIRE_HOURS=24
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Set up the database

Run `backend/database/schema.sql` in your Supabase SQL editor to create the tables.

### 5. Set up the frontend

```bash
cd frontend
npm install
```

### 6. Run

Start both in separate terminals:

```bash
# Terminal 1 — backend
cd backend
uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend
npm start
```

The frontend runs at `http://localhost:3000` and the backend API at `http://localhost:8000`.

## API endpoints

| Method | Endpoint                          | Description                  |
|--------|-----------------------------------|------------------------------|
| POST   | `/api/v1/auth/signup`             | Create account               |
| POST   | `/api/v1/auth/login`              | Login, returns JWT           |
| GET    | `/api/v1/profiles`                | List family profiles         |
| POST   | `/api/v1/profiles`                | Create a profile             |
| POST   | `/api/v1/upload/{profile_id}`     | Upload a medical document    |
| GET    | `/api/v1/profiles/{id}/records`   | List records for a profile   |
| GET    | `/api/v1/search?q=...`            | Search across all records    |
