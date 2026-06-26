<p align="center">
  <img src="https://img.shields.io/badge/MediVault-Family%20Health%20Records-0d9488?style=for-the-badge" alt="MediVault" />
</p>

<h1 align="center">MediVault</h1>

<p align="center">
  <strong>AI-powered family medical records manager</strong><br/>
  Upload any prescription — even handwritten. AI reads it, extracts everything, and makes it searchable.
</p>

<p align="center">
  <a href="https://medi-vault-silk-five.vercel.app/">Live Demo</a>
</p>

---

## Desktop

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

## Mobile

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

---

## What It Does

MediVault lets families store their complete medical history in one place. Take a photo of any prescription — printed or handwritten — and the AI extracts the doctor's name, medicines with dosages, diagnosis, hospital, and specialty. Everything becomes searchable across all family members and all doctors.

## Key Features

**AI Document Processing**
- Reads handwritten prescriptions, lab reports, printed documents
- Extracts doctor name, hospital, specialty, diagnosis, medicines (name, dosage, frequency)
- Works with any image format or PDF

**Family Profiles**
- Separate medical timeline for each family member
- Switch between profiles instantly
- Track health history across your entire family

**Doctor Visit Timeline**
- Records grouped by doctor automatically
- View all visits with any doctor in chronological order
- Compare two visits side-by-side (medicines added, removed, continued)

**Smart Search**
- Search by doctor, medicine, hospital, diagnosis, department, family member
- Search by date — "2026", "June", or any month/year
- Category filters for targeted results
- Results ranked by relevance

**AI Health Journey**
- AI-generated summary of each family member's health timeline
- Tracks treatment progression, medication changes, follow-up outcomes
- Helps patients understand their health history at a glance

**Production Features**
- JWT authentication with bcrypt password hashing
- Edit audit trail — every change is logged
- Fully responsive — desktop, tablet, and mobile
- Bottom navigation with floating upload button on mobile
- Real-time OCR status tracking
- Error recovery with meaningful messages

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend                        │
│              React 19 · Vercel                   │
│                                                  │
│   Auth ─── Dashboard ─── Records ─── Search      │
│               │              │          │        │
│          Profile Switcher  Doctor     Category   │
│          Health Journey    Timeline   Filters    │
│                            Compare              │
└─────────────────┬────────────────────────────────┘
                  │ HTTPS + JWT
┌─────────────────┴────────────────────────────────┐
│                  Backend                          │
│            FastAPI · Railway                      │
│                                                  │
│   /auth ── /profiles ── /upload ── /search        │
│                             │                    │
│                   ┌─────────┴─────────┐          │
│                   │  Background OCR   │          │
│                   │                   │          │
│             Groq Llama     Groq Llama            │
│             Vision (OCR)   3.3 70B (AI)          │
└─────────────────┬────────────────────────────────┘
                  │
┌─────────────────┴────────────────────────────────┐
│                Supabase                           │
│   PostgreSQL        Storage                       │
│   ├ users           └ medical-records/            │
│   ├ profiles                                      │
│   ├ records                                       │
│   ├ medicines                                     │
│   └ record_edits                                  │
└──────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 |
| Backend | FastAPI, Pydantic |
| Database | PostgreSQL (Supabase) |
| Storage | Supabase Storage |
| OCR | Groq Llama Vision |
| AI Extraction | Groq Llama 3.3 70B |
| Auth | JWT + bcrypt |
| Hosting | Vercel + Railway |

## Challenges Solved

**Handwritten prescription OCR** — Most OCR services fail on handwritten medical documents. MediVault uses a multimodal vision model that reliably reads handwriting, stamps, and mixed-format medical documents.

**Structured extraction from unstructured text** — A second AI pass with a carefully designed prompt extracts structured fields (doctor, medicines with dosages, diagnosis) from raw OCR output.

**Family-scale records** — Real families visit many doctors over years. The doctor timeline view and visit comparison make it possible to track treatment progression without losing context.

**Cross-field search** — Searching "fever" finds diagnoses. "Crocin" finds prescriptions. "2026" finds visits from that year. "Father" shows one family member's records.

## Future Roadmap

- PDF export of medical history
- Medication reminders
- Doctor-side portal
- Multi-language OCR
- Offline mode with sync
- HIPAA-compliant deployment
- Pharmacy integration

---

<p align="center">
  <a href="https://medi-vault-silk-five.vercel.app/">Try MediVault</a>
</p>

<p align="center">
  React 19 · FastAPI · PostgreSQL · Supabase · Groq AI · Vercel · Railway
</p>
