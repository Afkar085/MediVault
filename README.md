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

## Built With

React 19 · FastAPI · PostgreSQL · Supabase · Groq Llama Vision · Vercel · Railway
