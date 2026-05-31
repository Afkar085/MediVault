from fastapi import FastAPI

app = FastAPI(
    title="MediVault API",
    description="AI-Powered Personal Medical Records Assistant",
    version="0.1.0"
)

@app.get("/")
def health_check():
    return {"status": "ok", "project": "MediVault"}
