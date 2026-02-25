from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict

from app.engine import Inputs, full_analysis


class InputsModel(BaseModel):
    cash_on_hand: float = Field(..., ge=0)
    monthly_revenue: float = Field(..., ge=0)
    monthly_fixed_costs: float = Field(..., ge=0)
    monthly_variable_costs: float = Field(..., ge=0)
    team_size: int = Field(..., ge=0)
    avg_fully_loaded_cost_per_employee: float = Field(..., ge=0)
    revenue_growth_rate_mom: float  # can be negative too
    planned_hires: int = 0


app = FastAPI(title="CapitalSense API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://capitalsense.pages.dev",  # Cloudflare Pages prod frontend
        "http://localhost:5173",           # local dev
        "http://127.0.0.1:5173",           # local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
def analyze(
    payload: InputsModel,
    projection_horizon_months: int = 18,
    monte_carlo_runs: int = 5000,
) -> Dict[str, Any]:
    inputs = Inputs(**payload.model_dump())
    return full_analysis(
        inputs,
        projection_horizon_months=projection_horizon_months,
        monte_carlo_runs=monte_carlo_runs,
    )