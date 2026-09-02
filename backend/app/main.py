from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import forecast, localities
from app.services.forecasting import ForecastEngine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up model artifacts into memory on startup
    ForecastEngine.get_instance()
    yield


app = FastAPI(
    title="PeakSense API",
    description="PeakSense Electricity Demand Forecasting and Digital Twin Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(localities.router)
app.include_router(forecast.router)


