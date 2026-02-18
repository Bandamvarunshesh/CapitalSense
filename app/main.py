from fastapi import FastAPI
from pydantic import BaseModel, Field
from .engine import Inputs, full_analysis

app = FastAPI(title="AI COO (Pure Algorithmic Decision Engine)")

class AnalyzeRequest(BaseModel):
    cash_on_hand: float = Field(..., gt=0)
    monthly_revenue: float = Field(..., ge=0)
    monthly_fixed_costs: float = Field(..., ge=0)
    monthly_variable_costs: float = Field(..., ge=0)
    team_size: int = Field(..., ge=0)
    avg_fully_loaded_cost_per_employee: float = Field(..., ge=0)
    revenue_growth_rate_mom: float = Field(..., ge=-0.5, le=2.0)

    planned_hires: int = Field(0, ge=0)
    months: int = Field(12, ge=6, le=36)
    monte_carlo_runs: int = Field(5000, ge=1000, le=50000)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    inp = Inputs(
        cash_on_hand=req.cash_on_hand,
        monthly_revenue=req.monthly_revenue,
        monthly_fixed_costs=req.monthly_fixed_costs,
        monthly_variable_costs=req.monthly_variable_costs,
        team_size=req.team_size,
        avg_fully_loaded_cost_per_employee=req.avg_fully_loaded_cost_per_employee,
        revenue_growth_rate_mom=req.revenue_growth_rate_mom,
        planned_hires=req.planned_hires,
    )
    return full_analysis(inp, months=req.months, runs=req.monte_carlo_runs)
