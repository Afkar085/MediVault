<p align="center">
  <img src="https://img.shields.io/badge/MediVault-Family%20Health%20Records-0d9488?style=for-the-badge" alt="MediVault" />
</p>

<h1 align="center">MediVault</h1>

<p align="center">
  <strong>AI-powered family medical records manager</strong><br/>
  Upload any prescription — even handwritten. AI reads it, extracts everything, and makes it searchable.
</p>

<p align="center">
  <a href="https://medi-vault-silk-five.vercel.app/">Live Demo</a> &nbsp;·&nbsp;
  <a href="https://github.com/Afkar085/MediVault">GitHub</a>
</p>

---

## Screenshots

### Mobile

<table>
  <tr>
    <td width="25%"><img src="screenshots/mobile-login.jpeg" alt="Mobile Login" /></td>
    <td width="25%"><img src="screenshots/mobile-dashboard.jpeg" alt="Mobile Dashboard" /></td>
    <td width="25%"><img src="screenshots/mobile-records.jpeg" alt="Mobile Records" /></td>
    <td width="25%"><img src="screenshots/mobile-health-journey.jpeg" alt="Health Journey" /></td>
  </tr>
  <tr>
    <td align="center">Login</td>
    <td align="center">Dashboard</td>
    <td align="center">Records & Search</td>
    <td align="center">AI Health Journey</td>
  </tr>
</table>

<table>
  <tr>
    <td width="25%"><img src="screenshots/mobile-record-detail.jpeg" alt="Record Detail" /></td>
    <td width="25%"><img src="screenshots/mobile-ocr-scan.jpeg" alt="OCR Scan" /></td>
    <td width="25%"><img src="screenshots/mobile-ocr-text.jpeg" alt="OCR Text" /></td>
    <td width="25%"><img src="screenshots/mobile-add-family.jpeg" alt="Add Family" /></td>
  </tr>
  <tr>
    <td align="center">Record Details</td>
    <td align="center">Handwritten Rx Scan</td>
    <td align="center">Extracted OCR Text</td>
    <td align="center">Add Family Member</td>
  </tr>
</table>

### Desktop

<table>
  <tr>
    <td><img src="screenshots/desktop-login.png" alt="Login" /></td>
    <td><img src="screenshots/desktop-dashboard.png" alt="Dashboard" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Sign In</strong></td>
    <td align="center"><strong>Dashboard — Stats, Activity & Records</strong></td>
  </tr>
</table>

---

## Project Overview

MediVault lets families store their complete medical history in one place. Take a photo of any prescription — printed or handwritten — and the AI extracts the doctor's name, medicines with dosages, diagnosis, hospital, and specialty. Records are automatically grouped into doctor visits. Bills, lab reports, and prescriptions from the same visit stay together even when uploaded on different days.

---

## Features

| Feature | Description |
|---|---|
| **AI OCR** | Upload any prescription photo or PDF; Groq Vision extracts doctor, medicines, diagnosis, date |
| **Smart Classification** | Automatically categorises records as prescription, lab report, bill, or discharge summary |
| **Doctor Visit Timeline** | Groups records by doctor and visit date; full history per doctor, chronological |
| **Multi-document Visits** | One visit holds prescriptions, lab reports, and multiple bills — uploaded on different days |
| **Bills Tracking** | Per-bill title, category (Consultation, Pharmacy, Lab Test, etc.), number, amount, insurance toggle |
| **Medicines Database** | Structured medicine data — type, dosage schedule (morning/afternoon/night), SOS flag, duration |
| **Family Profiles** | Independent record sets for each family member, switchable from the top bar |
| **Smart Search** | Instant client-side search across all records with category filter chips |
| **Health Journey** | AI-generated timeline narrative summarising medical history via Groq Llama 3.3 |
| **Edit History** | Every field change logged with old → new value and timestamp |
| **Mobile-first UI** | Optimised for phone use with gesture-friendly cards and bottom navigation |

---

## Tech Stack

### Frontend
- **React 19** — UI framework
- **React Context API** — global state (no Redux, no React Router)
- **Axios** — HTTP client with JWT interceptor
- **CSS (custom)** — no UI library; hand-crafted mobile-first design

### Backend
- **FastAPI** — REST API framework
- **Pydantic v2** — request/response validation
- **Supabase (PostgreSQL)** — database + file storage
- **Groq** — OCR via `llama-3.2-11b-vision-preview`, AI summaries via `llama-3.3-70b-versatile`
- **JWT + bcrypt** — authentication

### Infrastructure
- **Vercel** — frontend hosting (static build)
- **Railway** — backend hosting
- **Supabase Storage** — medical document files

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Frontend                        │
│               React 19 · Vercel                   │
│                                                   │
│   Auth ─── Dashboard ─── Records ─── Search       │
│               │              │          │         │
│          Profile Switcher  Doctor     Category    │
│          Health Journey    Timeline   Filters     │
└──────────────────┬───────────────────────────────┘
                   │ HTTPS + JWT
┌──────────────────┴───────────────────────────────┐
│                   Backend                         │
│             FastAPI · Railway                     │
│                                                   │
│   /auth ── /profiles ── /upload ── /search        │
│                              │                    │
│                    ┌─────────┴─────────┐          │
│                    │  Background OCR   │          │
│              Groq Vision     Groq Llama 3.3       │
│              (extract text)  (parse fields)       │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────┴───────────────────────────────┐
│                 Supabase                          │
│   PostgreSQL          Storage                     │
│   ├ users             └ medical-records/          │
│   ├ profiles                                      │
│   ├ records                                       │
│   ├ medicines                                     │
│   ├ record_files                                  │
│   └ record_edits                                  │
└──────────────────────────────────────────────────┘
```

---

## Folder Structure

```
MediVault/
├── frontend/
│   ├── public/
│   └── src/
│       ├── App.js                    # Root component, context, upload orchestration
│       ├── api.js                    # Axios instance with auth interceptor
│       ├── index.css                 # Global styles (mobile-first)
│       ├── utils/
│       │   └── format.js             # Date, currency, doctor name, visit grouping
│       └── components/
│           ├── auth/AuthScreen.jsx   # Login / register
│           ├── common/               # Gallery, Toast, Logo
│           ├── dashboard/Dashboard.jsx
│           ├── doctors/DoctorsPage.jsx
│           ├── family/FamilyPage.jsx
│           ├── journey/HealthJourneyScreen.jsx
│           ├── layout/               # TopBar, BottomNav
│           ├── profile/ProfilePage.jsx
│           ├── records/RecordModal.jsx  # Full record view/edit, medicines, history
│           ├── search/SearchPage.jsx
│           ├── upload/               # UploadSheet, UploadPreview
│           └── visits/
│               ├── DoctorDetailPage.jsx
│               └── VisitDetailPage.jsx
│
└── backend/
    ├── requirements.txt
    └── app/
        ├── main.py                   # FastAPI app, CORS, router registration
        ├── config.py                 # Pydantic settings from environment
        ├── database.py               # Supabase client singleton
        ├── api/v1/endpoints/
        │   ├── auth.py               # Register, login, JWT
        │   ├── profile.py            # Profile CRUD
        │   ├── records.py            # Record CRUD, bills, health journey, history
        │   ├── search.py
        │   └── upload.py             # File upload, OCR trigger
        ├── core/
        │   ├── dependencies.py       # JWT auth dependency
        │   └── security.py           # bcrypt + JWT helpers
        ├── schemas/
        │   ├── auth.py
        │   ├── profile.py
        │   └── record.py             # RecordResponse, RecordUpdate, MedicineResponse
        └── services/
            ├── ocr.py                # Groq Vision text extraction
            └── ai_extractor.py       # Structured data extraction from OCR text
```

---

## Installation

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase project
- Groq API key (free tier available at console.groq.com)

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
REACT_APP_API_URL=http://localhost:8000/api/v1
```

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=a_long_random_secret_string_minimum_32_chars
JWT_EXPIRE_HOURS=24
GROQ_API_KEY=gsk_...
```

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `REACT_APP_API_URL` | frontend | Backend API base URL |
| `SUPABASE_URL` | backend | Supabase project URL |
| `SUPABASE_KEY` | backend | Supabase anon/service key |
| `JWT_SECRET` | backend | Secret for signing JWT tokens |
| `JWT_EXPIRE_HOURS` | backend | Token expiry in hours (default: 24) |
| `GROQ_API_KEY` | backend | Groq API key for OCR and AI |

---

## Database Setup (Supabase)

Create these tables in your Supabase project (via the Table Editor or SQL Editor):

```sql
-- Core tables
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  relationship text,
  date_of_birth date,
  created_at timestamptz default now()
);

create table records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles not null,
  document_type text,
  document_category text,
  document_date date,
  doctor_name text,
  hospital_name text,
  specialty text,
  diagnosis text,
  recommendations text,
  bill_amount numeric,
  bill_category text,
  bill_title text,
  bill_number text,
  insurance_claimed boolean default false,
  file_path text,
  file_url text,
  status text default 'processing',
  created_at timestamptz default now()
);

create table medicines (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references records on delete cascade,
  name text not null,
  dosage text,
  frequency text,
  duration text
);

create table record_files (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references records on delete cascade,
  file_path text,
  file_url text,
  page_number int default 1
);

create table record_edits (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references records on delete cascade,
  field_name text,
  old_value text,
  new_value text,
  edited_at timestamptz default now()
);

-- If upgrading an existing database (bill columns added in V2)
alter table records add column if not exists bill_category text;
alter table records add column if not exists bill_title text;
alter table records add column if not exists bill_number text;
```

Create a Supabase Storage bucket named `medical-records` and configure public read access or signed URLs as appropriate for your security requirements.

---

## Running Locally

### Start the backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Start the frontend
```bash
cd frontend
npm start
```

App opens at `http://localhost:3000`. API requests go to `http://localhost:8000/api/v1`.

---

## Building for Production

```bash
cd frontend
npm run build
```

Output is in `frontend/build/`. Deploy the build folder to any static host (Vercel, Netlify, S3 + CloudFront, etc.).

---

## Deployment

### Frontend — Vercel

```bash
cd frontend
npx vercel --prod
```

In Vercel project settings:
- **Root directory**: `frontend`
- **Build command**: `npm run build`
- **Output directory**: `build`
- **Environment variable**: `REACT_APP_API_URL` → your Railway backend URL

### Backend — Railway

1. Create a new Railway service and connect your GitHub repository
2. Set **Root directory** to `backend`
3. Railway auto-detects FastAPI via `requirements.txt` and runs `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add all backend environment variables in Railway's Variables tab
5. Copy the generated Railway URL and set it as `REACT_APP_API_URL` in Vercel

---

## OCR Pipeline

```
User uploads file (JPEG / PNG / PDF)
        ↓
FastAPI receives file → validates type and size
        ↓
File stored in Supabase Storage → public URL generated
        ↓
Record created in database with status = "processing"
        ↓
Background task starts:
  Groq Vision (llama-3.2-11b-vision-preview) reads raw text from image
        ↓
Status → "extracting"
        ↓
AI Extractor (llama-3.3-70b-versatile) parses structured fields:
  doctor_name, hospital_name, document_date, specialty,
  diagnosis, recommendations, document_category,
  medicines [ { name, dosage, frequency, duration } ]
        ↓
Record updated with extracted fields, status = "done"
        ↓
Medicines inserted into medicines table
        ↓
Frontend polling detects status = "done" → refreshes UI
```

If a document is uploaded from inside an existing visit, the app enforces the visit date both immediately after upload and again post-OCR (via a `useRef` enforcement map), preventing the OCR-extracted date from splitting the document into a different visit group.

---

## AI Extraction Workflow

Two Groq models work in sequence for every upload:

1. **OCR — `llama-3.2-11b-vision-preview`**
   Reads the raw image (handwritten or printed). Outputs plain text transcription of the document.

2. **Extraction — `llama-3.3-70b-versatile`**
   Takes the OCR text and a structured prompt. Returns a JSON object with: doctor name, hospital, specialty, date, diagnosis, recommendations, document category, and a medicines array (name + dosage + frequency + duration).

3. **Health Journey — `llama-3.3-70b-versatile`**
   On demand from the Health Journey screen. Takes all of a profile's records, constructs a chronological visit summary, and asks Groq to produce 3–8 bullet-point narrative describing the patient's health history in plain language.

Handwritten prescriptions are fully supported. OCR accuracy depends on image quality — blurry or low-contrast photos may require manual field correction via the Edit Details form.

---

## Medical Record Organisation

Records are grouped by **doctor name** → **visit date**. Within a doctor, all documents uploaded on the same visit date appear together on the Visit Detail screen. Each visit can contain:

- **Prescriptions** — with extracted medicine list (name, dosage, schedule)
- **Lab Reports** — linked to the same visit even if collected a day later
- **Bills** — with category (Consultation Fee, Pharmacy, etc.), custom title, bill number, amount, and insurance toggle

Uploading a new document from inside an existing visit attaches it to that visit. The system enforces the visit date in two stages — immediately via PUT after upload, and again after OCR completes — so the extracted date never causes the document to be separated into a different visit group.

---

## Bill Categories

Supported bill categories:

| Category | Category |
|---|---|
| Consultation Fee | Lab Test |
| Pharmacy | Hospital Admission |
| Surgery | Scan / Imaging |
| Emergency | Physiotherapy |
| Dental | Eye Care |
| Vaccination | Insurance |
| Other | |

Each bill also supports:
- **Bill Title** — custom display name (e.g. "Apollo Pharmacy — June receipt")
- **Bill Number** — invoice or receipt number (e.g. INV-2024-001)
- **Insurance Toggle** — marks whether the bill has been insurance-claimed

---

## Family Member Support

Each user account can manage multiple **profiles** (family members). All records, doctors, and health history are scoped to a profile. Profiles can be:

- Named (e.g. "Dad", "Mom", "Self")
- Given a relationship label and date of birth
- Switched from the top bar at any time

Data is fully isolated — searching or viewing records on one profile never shows another profile's data.

---

## Search Functionality

Search is client-side, running over the already-loaded records array — no extra API call, zero latency.

**Searches across:**
- Doctor name
- Hospital name
- Diagnosis
- Specialty / department
- Recommendations / notes
- Medicine names (any medicine in the record's list)

**Filter chips narrow results to:**
- All
- Prescriptions
- Lab Reports
- Bills
- Medicines (records with at least one medicine attached)

Category filters and text search compose — e.g. filter to "Prescriptions" and type "amoxicillin" to find all prescriptions containing that medicine.

---

## Health Journey

The Health Journey screen combines a visual timeline with an AI narrative:

**Timeline section** — Chronological year-by-year list of all records with colour-coded dots per category (prescription, lab report, bill).

**AI narrative** — Groq Llama 3.3 generates 3–8 plain-English bullet points summarising:
- Key diagnoses and when they occurred
- Treatment progression and medication changes
- Follow-up outcomes and recurring conditions

The narrative is generated fresh on each visit to the Health Journey screen.

---

## Future Roadmap

- [ ] Smart visit suggestion — when uploading from the home screen, offer to attach to an existing visit by doctor + date proximity
- [ ] Bill PDF export and share
- [ ] Prescription refill reminders and medicine schedule notifications
- [ ] Lab result trend graphs (haemoglobin, blood sugar, cholesterol over time)
- [ ] Full medical history export as PDF
- [ ] Multi-language OCR for regional language prescriptions
- [ ] Medication interaction checker
- [ ] Appointment scheduling
- [ ] Doctor notes and custom annotations
- [ ] Insurance claim status (Pending / Submitted / Approved / Rejected)
- [ ] Offline mode with background sync

---

## Known Limitations

- **Medicine schema** — Schedule details (morning/afternoon/night tabs, SOS flag) are displayed in the app but only name/dosage/frequency/duration persist to the database. A richer medicines schema is planned.
- **OCR accuracy** — Depends on image quality. Blurry, poorly-lit, or very small text photos may require manual correction in the Edit Details form.
- **Health Journey caching** — The AI summary is generated on every page load. For large record histories this can take a few seconds.
- **Visit attachment for home uploads** — Documents uploaded from the main upload button (not from inside a visit) do not yet prompt "attach to existing visit?". They always create a new record grouped by OCR-extracted date and doctor.

---

## License

MIT — open source, free to use and modify.

---

## Author

**Afkar** — [GitHub @Afkar085](https://github.com/Afkar085)

Built with React 19, FastAPI, Supabase, and Groq AI.

---

<p align="center">
  <a href="https://medi-vault-silk-five.vercel.app/">Try MediVault Live</a>
</p>

<p align="center">
  React 19 · FastAPI · PostgreSQL · Supabase · Groq AI · Vercel · Railway
</p>
