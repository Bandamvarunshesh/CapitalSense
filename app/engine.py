from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List
import numpy as np


@dataclass
class Inputs:
    cash_on_hand: float
    monthly_revenue: float
    monthly_fixed_costs: float
    monthly_variable_costs: float
    team_size: int
    avg_fully_loaded_cost_per_employee: float
    revenue_growth_rate_mom: float  # e.g., 0.08 for 8% MoM
    planned_hires: int = 0          # hires immediately


def monthly_total_cost(inp: Inputs) -> float:
    payroll = (inp.team_size + inp.planned_hires) * inp.avg_fully_loaded_cost_per_employee
    return float(inp.monthly_fixed_costs + inp.monthly_variable_costs + payroll)


def burn_and_runway(inp: Inputs) -> Dict[str, float | str]:
    cost = monthly_total_cost(inp)
    net_burn = cost - inp.monthly_revenue  # + => burning
    if net_burn <= 0:
        runway = "infinite (profitable or break-even)"
        runway_months_numeric = -1.0
    else:
        runway_months_numeric = float(inp.cash_on_hand / net_burn)
        runway = float(runway_months_numeric)

    return {
        "monthly_cost": float(cost),
        "net_burn": float(net_burn),
        "runway_months": runway,
        "runway_months_numeric": runway_months_numeric,
    }


def simulate_cash_curve(
    cash0: float,
    rev0: float,
    cost0: float,
    growth_mom: float,
    cost_infl_mom: float,
    months: int = 12
) -> List[float]:
    cash = float(cash0)
    rev = float(rev0)
    cost = float(cost0)
    curve = [cash]

    for _ in range(months):
        cash = cash - (cost - rev)
        curve.append(float(cash))
        rev = rev * (1.0 + growth_mom)
        cost = cost * (1.0 + cost_infl_mom)

    return curve


def scenario_analysis(inp: Inputs, months: int = 12) -> List[Dict]:
    base_cost = monthly_total_cost(inp)
    g = inp.revenue_growth_rate_mom

    scenarios = [
        ("optimistic", g * 1.25, 0.01),
        ("base",       g,        0.02),
        ("pessimistic", g * 0.60, 0.04),
    ]

    out = []
    for name, growth, infl in scenarios:
        curve = simulate_cash_curve(
            cash0=inp.cash_on_hand,
            rev0=inp.monthly_revenue,
            cost0=base_cost,
            growth_mom=float(growth),
            cost_infl_mom=float(infl),
            months=months,
        )
        min_cash = float(min(curve))
        out.append({
            "name": name,
            "growth_mom": float(growth),
            "cost_inflation_mom": float(infl),
            "cash_curve": curve,
            "cash_end": float(curve[-1]),
            "min_cash": min_cash,
            "goes_negative": bool(min_cash < 0),
        })
    return out


def monte_carlo_risk(inp: Inputs, months: int = 12, runs: int = 5000) -> Dict[str, float]:
    base_cost = monthly_total_cost(inp)
    base_growth = inp.revenue_growth_rate_mom

    growth_samples = np.random.uniform(base_growth * 0.6, base_growth * 1.4, size=runs)
    infl_samples = np.random.uniform(0.00, 0.06, size=runs)

    went_negative = 0
    neg_within_6 = 0
    neg_within_3 = 0
    break_even_within_horizon = 0

    for i in range(runs):
        cash = float(inp.cash_on_hand)
        rev = float(inp.monthly_revenue)
        cost = float(base_cost)

        g = float(growth_samples[i])
        infl = float(infl_samples[i])

        first_neg = None
        hit_break_even = False

        for m in range(1, months + 1):
            cash = cash - (cost - rev)

            if first_neg is None and cash < 0:
                first_neg = m

            if not hit_break_even and (rev - cost) >= 0:
                hit_break_even = True

            rev = rev * (1.0 + g)
            cost = cost * (1.0 + infl)

        if first_neg is not None:
            went_negative += 1
            if first_neg <= 6:
                neg_within_6 += 1
            if first_neg <= 3:
                neg_within_3 += 1

        if hit_break_even:
            break_even_within_horizon += 1

    return {
        "runs": float(runs),
        "p_cash_negative_within_horizon": float(went_negative / runs),
        "p_cash_negative_within_6_months": float(neg_within_6 / runs),
        "p_cash_negative_within_3_months": float(neg_within_3 / runs),
        "p_break_even_within_horizon": float(break_even_within_horizon / runs),
    }


def safe_hires_suggestion(inp: Inputs, min_runway_months: float = 9.0) -> Dict[str, float | str]:
    best = 0
    best_runway: float | str = "unknown"

    for hires in range(0, 21):
        test = Inputs(**{**inp.__dict__, "planned_hires": hires})
        metrics = burn_and_runway(test)
        runway_num = float(metrics["runway_months_numeric"])

        if runway_num < 0:
            best = hires
            best_runway = "infinite"
            continue

        if runway_num >= min_runway_months:
            best = hires
            best_runway = runway_num

    return {
        "min_required_runway_months": float(min_runway_months),
        "safe_hires_now": float(best),
        "resulting_runway_months": best_runway,
    }


def revenue_sensitivity(inp: Inputs, target_runway_months: float = 12.0) -> Dict[str, float | str]:
    cost = monthly_total_cost(inp)
    net_burn = cost - inp.monthly_revenue

    if net_burn <= 0:
        return {
            "target_runway_months": float(target_runway_months),
            "extra_monthly_revenue_needed_for_target_runway": 0.0,
            "monthly_revenue_needed_for_break_even": float(cost),
            "status": "Already break-even/profitable",
        }

    net_burn_target = inp.cash_on_hand / target_runway_months
    extra_rev = max(0.0, net_burn - net_burn_target)

    return {
        "target_runway_months": float(target_runway_months),
        "extra_monthly_revenue_needed_for_target_runway": float(extra_rev),
        "monthly_revenue_needed_for_break_even": float(cost),
        "status": "Burning cash",
    }


def pivot_score(inp: Inputs, risk: Dict[str, float], metrics: Dict[str, float | str]) -> Dict:
    p6 = float(risk["p_cash_negative_within_6_months"])
    p12 = float(risk["p_cash_negative_within_horizon"])
    pbe = float(risk["p_break_even_within_horizon"])

    net_burn = float(metrics["net_burn"])
    revenue = float(inp.monthly_revenue)
    burn_ratio = 0.0 if revenue <= 0 else max(0.0, net_burn / revenue)

    score = 0.0
    reasons = []

    score += 60.0 * p6
    if p6 > 0.4:
        reasons.append(f"High risk: probability of running out of cash within 6 months is {p6:.0%}.")

    score += 25.0 * p12
    if p12 > 0.5:
        reasons.append(f"Longer-horizon risk: probability of cash going negative within 12 months is {p12:.0%}.")

    score += min(25.0, 15.0 * burn_ratio)
    if burn_ratio > 0.5:
        reasons.append(f"Burn is high vs revenue: net burn is {burn_ratio:.2f}× monthly revenue.")

    # If break-even probability is low, increase pivot pressure
    if pbe < 0.25:
        score += 10.0
        reasons.append(f"Low break-even probability within horizon: {pbe:.0%}.")

    if inp.revenue_growth_rate_mom < 0.03:
        score += 8.0
        reasons.append("Growth is low (<3% MoM), reaching break-even may require changes.")

    score = float(min(100.0, score))

    if not reasons:
        reasons.append("Pivot pressure is moderate/low given current assumptions.")

    return {"pivot_score": score, "reasons": reasons}


def full_analysis(inp: Inputs, months: int = 12, runs: int = 5000) -> Dict:
    metrics = burn_and_runway(inp)
    scenarios = scenario_analysis(inp, months=months)
    risk = monte_carlo_risk(inp, months=months, runs=runs)
    hires = safe_hires_suggestion(inp, min_runway_months=9.0)
    sensitivity = revenue_sensitivity(inp, target_runway_months=12.0)
    pivot = pivot_score(inp, risk=risk, metrics=metrics)

    return {
        "current_metrics": metrics,
        "scenarios": scenarios,
        "monte_carlo": risk,
        "hiring_suggestion": hires,
        "revenue_sensitivity": sensitivity,
        "pivot": pivot,
    }
