from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List
import math
import random


@dataclass
class Inputs:
    cash_on_hand: float
    monthly_revenue: float
    monthly_fixed_costs: float
    monthly_variable_costs: float
    team_size: int
    avg_fully_loaded_cost_per_employee: float
    revenue_growth_rate_mom: float  # e.g. 0.04 for 4% MoM
    planned_hires: int = 0


# -----------------------------
# Core helper calculations
# -----------------------------
def _monthly_cost(inputs: Inputs) -> float:
    payroll = float(inputs.team_size) * float(inputs.avg_fully_loaded_cost_per_employee)
    return float(inputs.monthly_fixed_costs) + float(inputs.monthly_variable_costs) + payroll


def _net_burn(inputs: Inputs) -> float:
    # positive = burning cash, negative = generating cash
    return _monthly_cost(inputs) - float(inputs.monthly_revenue)


def _runway(inputs: Inputs) -> Dict[str, Any]:
    burn = _net_burn(inputs)

    if burn <= 0:
        return {
            "runway_months_numeric": float("inf"),
            "runway_months_label": "Infinite (cash-flow positive)",
        }

    runway = float(inputs.cash_on_hand) / burn if burn > 0 else float("inf")
    return {
        "runway_months_numeric": runway,
        "runway_months_label": f"{runway:.1f} months",
    }


def _risk_label(p_cash_negative_within_6m: float) -> str:
    if p_cash_negative_within_6m >= 0.60:
        return "HIGH"
    if p_cash_negative_within_6m >= 0.30:
        return "MEDIUM"
    return "LOW"


def _percentile(sorted_vals: List[float], p: float) -> float:
    # p in [0, 1]
    if not sorted_vals:
        return float("nan")
    if len(sorted_vals) == 1:
        return float(sorted_vals[0])

    idx = p * (len(sorted_vals) - 1)
    lo = int(math.floor(idx))
    hi = int(math.ceil(idx))
    if lo == hi:
        return float(sorted_vals[lo])
    frac = idx - lo
    return float(sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac)


# -----------------------------
# Scenario curves (for chart)
# -----------------------------
def _build_scenarios(inputs: Inputs, months: int) -> List[Dict[str, Any]]:
    """
    Builds 3 deterministic cash curves for charting:
      - Base: uses given growth
      - Optimistic: higher growth, slightly lower costs
      - Conservative: lower growth, slightly higher costs
    """
    base_growth = float(inputs.revenue_growth_rate_mom)

    scenarios = [
        {"name": "Conservative", "growth": max(-0.10, base_growth - 0.03), "cost_mult": 1.08},
        {"name": "Base",         "growth": base_growth,                  "cost_mult": 1.00},
        {"name": "Optimistic",   "growth": base_growth + 0.03,           "cost_mult": 0.95},
    ]

    out = []
    for sc in scenarios:
        cash = float(inputs.cash_on_hand)
        revenue = float(inputs.monthly_revenue)

        curve = [cash]
        for m in range(1, months + 1):
            revenue *= (1.0 + sc["growth"])
            cost = _monthly_cost(inputs) * float(sc["cost_mult"])
            cash = cash + revenue - cost
            curve.append(cash)

        out.append({"name": sc["name"], "cash_by_month": curve})
    return out


# -----------------------------
# Monte Carlo risk
# -----------------------------
def _monte_carlo_risk(inputs: Inputs, months: int, runs: int) -> Dict[str, Any]:
    """
    We simulate cash month-by-month with randomness in:
      - revenue growth
      - variable costs
      - (optional) hire timing effect on payroll

    Returns:
      - probability of going cash-negative within 6 months
      - p10/p50/p90 runway (months until cash < 0)
    """
    base_growth = float(inputs.revenue_growth_rate_mom)

    # Tunable uncertainty knobs (small but meaningful)
    growth_sigma = 0.03  # +/- around growth
    var_cost_sigma = 0.12  # variable costs fluctuate

    # Spread planned hires over first 3 months (simple assumption)
    hires_total = int(inputs.planned_hires or 0)
    hire_schedule = [0] * months
    if hires_total > 0:
        spread_months = min(3, months)
        per = hires_total // spread_months
        rem = hires_total % spread_months
        for i in range(spread_months):
            hire_schedule[i] = per + (1 if i < rem else 0)

    runway_samples = []
    neg_within_6 = 0

    for _ in range(runs):
        cash = float(inputs.cash_on_hand)
        revenue = float(inputs.monthly_revenue)

        team = int(inputs.team_size)
        went_negative_month = None

        for m in range(1, months + 1):
            # random growth around base
            g = random.gauss(base_growth, growth_sigma)
            g = max(-0.30, min(g, 0.50))  # clamp extremes
            revenue *= (1.0 + g)

            # hires this month
            if m - 1 < len(hire_schedule):
                team += hire_schedule[m - 1]

            # costs this month
            payroll = float(team) * float(inputs.avg_fully_loaded_cost_per_employee)
            fixed = float(inputs.monthly_fixed_costs)
            var = float(inputs.monthly_variable_costs) * max(0.0, random.gauss(1.0, var_cost_sigma))
            cost = fixed + var + payroll

            cash = cash + revenue - cost

            if cash < 0 and went_negative_month is None:
                went_negative_month = m
                break

        # runway sample: if never negative, treat as months+1 (beyond horizon)
        runway_m = float(went_negative_month if went_negative_month is not None else (months + 1))
        runway_samples.append(runway_m)

        if went_negative_month is not None and went_negative_month <= 6:
            neg_within_6 += 1

    runway_samples.sort()
    p10 = _percentile(runway_samples, 0.10)
    p50 = _percentile(runway_samples, 0.50)
    p90 = _percentile(runway_samples, 0.90)

    return {
        "p_cash_negative_within_6_months": neg_within_6 / float(runs),
        "runway_p10_months": p10,
        "runway_p50_months": p50,
        "runway_p90_months": p90,
    }


def _executive_summary(runway_months: float, p6: float, runway_p10: float) -> str:
    if math.isinf(runway_months):
        return "You are currently cash-flow positive. Focus on sustaining growth while keeping costs controlled."

    if runway_months < 6 or p6 >= 0.60:
        return (
            "High risk: cash may run out soon. Consider immediate cost reduction, slowing hiring, "
            "or accelerating revenue actions. Monitor weekly."
        )

    if runway_months < 12 or p6 >= 0.30 or runway_p10 <= 8:
        return (
            "Moderate risk: runway is limited under downside scenarios. Tighten spending, prioritize revenue, "
            "and track burn monthly."
        )

    return "Lower risk: runway looks healthy. Keep monitoring burn and validate growth assumptions each month."


# -----------------------------
# Public API: full_analysis()
# -----------------------------
def full_analysis(
    inputs: Inputs,
    projection_horizon_months: int = 18,
    monte_carlo_runs: int = 5000
) -> Dict[str, Any]:

    months = max(6, int(projection_horizon_months))
    runs = max(300, int(monte_carlo_runs))

    monthly_cost = _monthly_cost(inputs)
    net_burn = _net_burn(inputs)
    runway_info = _runway(inputs)

    # scenario curves for chart
    scenarios = _build_scenarios(inputs, months)

    # monte carlo
    mc = _monte_carlo_risk(inputs, months, runs)
    p6 = mc["p_cash_negative_within_6_months"]
    risk_level = _risk_label(p6)

    summary = _executive_summary(runway_info["runway_months_numeric"], p6, mc["runway_p10_months"])

    return {
        "inputs_echo": {
            "cash_on_hand": float(inputs.cash_on_hand),
            "monthly_revenue": float(inputs.monthly_revenue),
            "monthly_fixed_costs": float(inputs.monthly_fixed_costs),
            "monthly_variable_costs": float(inputs.monthly_variable_costs),
            "team_size": int(inputs.team_size),
            "avg_fully_loaded_cost_per_employee": float(inputs.avg_fully_loaded_cost_per_employee),
            "revenue_growth_rate_mom": float(inputs.revenue_growth_rate_mom),
            "planned_hires": int(inputs.planned_hires),
        },
        "metrics": {
            "monthly_cost": float(monthly_cost),
            "net_burn": float(net_burn),
            "runway_months": (
                None if math.isinf(runway_info["runway_months_numeric"]) else float(runway_info["runway_months_numeric"])
            ),
            "runway_label": runway_info["runway_months_label"],
            "p_cash_negative_within_6_months": float(p6),
            "risk_level": risk_level,
            "runway_p10_months": float(mc["runway_p10_months"]),
            "runway_p50_months": float(mc["runway_p50_months"]),
            "runway_p90_months": float(mc["runway_p90_months"]),
        },
        "scenarios": scenarios,
        "executive_summary": summary,
        "meta": {
            "projection_horizon_months": months,
            "monte_carlo_runs": runs,
        },
    }