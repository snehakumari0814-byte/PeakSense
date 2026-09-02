from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import localities

app = FastAPI(title="PeakSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(localities.router)
