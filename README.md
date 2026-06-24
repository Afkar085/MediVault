# MediVault

A full-stack web app for storing, organizing, and searching medical records. Upload a prescription, lab report, or any medical document — MediVault uses AI-powered OCR to extract doctor names, diagnoses, medicines, dosages, and more, making all your health records instantly searchable.

**Live demo:** [medivault.vercel.app](https://medi-vault-silk-five.vercel.app/)

## Screenshots

### Dashboard
![Dashboard](screenshots/dashboard.png)

### Multi-Profile Support
![Records](screenshots/records.png)

### AI-Powered OCR — Reads Handwritten Prescriptions
| Scanned Document | Extracted Text |
|---|---|
| ![OCR Scan](screenshots/ocr-scan.png) | ![OCR Text](screenshots/ocr-text.png) |

### Record Details & Medicines
| Record Detail | Medicines |
|---|---|
| ![Record Detail](screenshots/record-detail.png) | ![Medicines](screenshots/medicines.png) |

### Sign Up
![Sign Up](screenshots/signup.png)

## Features

- **AI-powered OCR** — upload any image or PDF, even handwritten prescriptions. Extracts text using Groq's Llama Vision model, then parses it into structured fields with AI
- **Multi-profile support** — manage records for yourself and family members
- **Structured extraction** — automatically identifies document type, doctor name, hospital, date, specialty, diagnosis, recommendations, and medicines (with dosage and frequency)
- **Full-text search** — search across all extracted fields instantly
- **Edit & correct** — fix any AI-extracted field; edits are tracked in an audit trail
- **Secure auth** — JWT-based signup/login with bcrypt password hashing
- **Responsive design** — works on desktop and mobile with bottom navigation

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Axios |
| Backend | FastAPI, Pydantic, Uvicorn |
| Database | PostgreSQL (Supabase) |
| Storage | Supabase Storage |
| OCR | Groq Llama Vision (AI-powered) |
| AI Extraction | Groq Llama 3.3 70B |
| Hosting | Vercel (frontend), Railway (backend) |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Supabase](https://supabase.com) project (free tier works)
- [Groq](https://console.groq.com) API key (free tier works)

### 1. Clone and set up

```bash
git clone https://github.com/Afkar085/MediVault.git
cd MediVault
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 3. Environment variables

Copy `.env.example` to `backend/.env` and fill in:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=any_long_random_string
JWT_EXPIRE_HOURS=24
GROQ_API_KEY=your_groq_api_key
```

### 4. Database

Run `backend/database/schema.sql` in your Supabase SQL editor.

### 5. Frontend

```bash
cd frontend
npm install
```

### 6. Run

```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm start
```

Frontend: `http://localhost:3000` · Backend: `http://localhost:8000`

## Project Structure

```
MediVault/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Environment settings
│   │   ├── database.py          # Supabase client
│   │   ├── core/                # Auth dependencies
│   │   ├── schemas/             # Pydantic models
│   │   ├── services/
│   │   │   ├── ocr.py           # Groq Vision OCR
│   │   │   └── ai_extractor.py  # Structured data extraction
│   │   └── api/v1/endpoints/
│   │       ├── auth.py          # Signup, login
│   │       ├── profile.py       # Family profiles CRUD
│   │       ├── upload.py        # File upload + background OCR
│   │       ├── records.py       # Records CRUD
│   │       └── search.py        # Full-text search
│   ├── database/
│   │   └── schema.sql           # Table definitions
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js               # Single-page app
│   │   └── api.js               # Axios client
│   └── package.json
└── .env.example
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/signup` | Create account |
| POST | `/api/v1/auth/login` | Login (returns JWT) |
| GET | `/api/v1/profiles` | List family profiles |
| POST | `/api/v1/profiles` | Create a profile |
| POST | `/api/v1/upload/{profile_id}` | Upload medical document |
| GET | `/api/v1/profiles/{id}/records` | List records |
| GET | `/api/v1/search?q=...` | Search all records |
