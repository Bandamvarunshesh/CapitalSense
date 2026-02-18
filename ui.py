import streamlit as st
import matplotlib.pyplot as plt
from app.engine import Inputs, full_analysis

# -------------------------------------------------
# Page Config
# -------------------------------------------------
st.set_page_config(
    page_title="CapitalSense",
    layout="wide",
    initial_sidebar_state="expanded"
)

# -------------------------------------------------
# Fintech Professional Theme
# -------------------------------------------------
st.markdown(
    """
    <style>
      html, body, .stApp {
          background-color: #0F172A;
          color: #E2E8F0;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .block-container {
          padding-top: 1.5rem;
          padding-bottom: 1.5rem;
      }

      /* Header */
      .cs-header {
          padding: 1.2rem 1.5rem;
          border-radius: 12px;
          background: #111827;
          margin-bottom: 1.2rem;
          border: 1px solid #1F2937;
      }

      .cs-title {
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
          color: #3B82F6;
      }

      .cs-subtitle {
          font-size: 1rem;
          margin-top: 0.4rem;
          color: #94A3B8;
          line-height: 1.4;
      }

      /* Section Headers */
      .cs-section {
          padding: 0.6rem 0.9rem;
          border-radius: 8px;
          margin-top: 1rem;
          margin-bottom: 0.6rem;
          font-weight: 600;
          background: #111827;
          border: 1px solid #1F2937;
          color: #3B82F6;
      }

      /* Cards */
      .cs-card {
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid #1F2937;
          background: #111827;
          color: #E2E8F0;
      }

      /* Metrics */
      .metric-label {
          font-size: 0.85rem;
          color: #94A3B8;
      }

      .metric-value {
          font-size: 1.6rem;
          font-weight: 700;
          margin-top: 0.2rem;
          color: #22C55E;
      }

      .risk-low { color: #16A34A; font-weight: 700; }
      .risk-med { color: #F59E0B; font-weight: 700; }
      .risk-high { color: #EF4444; font-weight: 700; }

      /* Buttons */
      .stButton>button {
          background-color: #3B82F6;
          color: white;
          font-weight: 600;
          border-radius: 8px;
      }

      .stButton>button:hover {
          background-color: #2563EB;
      }

      /* Inputs */
      input, textarea {
          background-color: #0F172A !important;
          color: #E2E8F0 !important;
          border: 1px solid #1F2937 !important;
      }

      .footer {
          margin-top: 2rem;
          font-size: 0.85rem;
          color: #64748B;
      }
    </style>
    """,
    unsafe_allow_html=True
)

# -------------------------------------------------
# Header
# -------------------------------------------------
st.markdown(
    """
    <div class="cs-header">
      <div class="cs-title">CapitalSense</div>
      <div class="cs-subtitle">
        Financial decision engine for runway modeling, hiring strategy, and risk analysis.
      </div>
    </div>
    """,
    unsafe_allow_html=True
)

# -------------------------------------------------
# Helper Functions
# -------------------------------------------------
def fmt(x):
    return f"{x:,.0f}"

def risk_text(p6):
    if p6 < 0.15:
        return "Low Risk", "risk-low"
    elif p6 < 0.40:
        return "Medium Risk", "risk-med"
    else:
        return "High Risk", "risk-high"

@st.cache_data(show_spinner=False)
def run_analysis(payload):
    inp = Inputs(
        cash_on_hand=payload["cash"],
        monthly_revenue=payload["rev"],
        monthly_fixed_costs=payload["fixed"],
        monthly_variable_costs=payload["var"],
        team_size=payload["team"],
        avg_fully_loaded_cost_per_employee=payload["cost"],
        revenue_growth_rate_mom=payload["growth"],
        planned_hires=payload["hires"],
    )
    return full_analysis(inp, months=payload["months"], runs=payload["runs"])

# -------------------------------------------------
# Layout
# -------------------------------------------------
left, right = st.columns([1, 2])

# -------------------------------------------------
# Inputs Panel
# -------------------------------------------------
with left:
    st.markdown('<div class="cs-section">Inputs</div>', unsafe_allow_html=True)

    cash_on_hand = st.number_input("Cash on hand", value=3000000.0)
    monthly_revenue = st.number_input("Monthly revenue", value=450000.0)
    monthly_fixed_costs = st.number_input("Monthly fixed costs", value=200000.0)
    monthly_variable_costs = st.number_input("Monthly variable costs", value=80000.0)

    team_size = st.number_input("Team size", value=6)
    avg_cost = st.number_input("Average cost per employee (monthly)", value=120000.0)
    planned_hires = st.number_input("Planned hires now", value=0)

    growth_pct = st.number_input("Revenue growth (MoM %)", value=8.0)
    months = st.slider("Projection horizon (months)", 6, 36, 12)
    runs = st.slider("Monte Carlo runs", 1000, 20000, 5000)

    analyze = st.button("Run Analysis", use_container_width=True)

# -------------------------------------------------
# Results Panel
# -------------------------------------------------
with right:
    st.markdown('<div class="cs-section">What It Does</div>', unsafe_allow_html=True)
    st.markdown(
        """
        <div class="cs-card">
          CapitalSense models a startup’s financial future using transparent financial logic and Monte Carlo simulation.
          It turns a small set of inputs (cash, revenue, costs, team size, growth, hiring) into runway and risk insights.
        </div>
        """,
        unsafe_allow_html=True
    )

    st.markdown('<div class="cs-section">Why It Is Used</div>', unsafe_allow_html=True)
    st.markdown(
        """
        <div class="cs-card">
          Founders and operators use CapitalSense to make disciplined decisions around hiring, burn control,
          and fundraising timing. Instead of relying on a single forecast, it quantifies uncertainty and downside risk.
        </div>
        """,
        unsafe_allow_html=True
    )

    if not analyze:
        st.info("Adjust inputs and click Run Analysis.")
        st.stop()

    payload = {
        "cash": cash_on_hand,
        "rev": monthly_revenue,
        "fixed": monthly_fixed_costs,
        "var": monthly_variable_costs,
        "team": team_size,
        "cost": avg_cost,
        "growth": growth_pct / 100,
        "hires": planned_hires,
        "months": months,
        "runs": runs
    }

    with st.spinner("Running simulations..."):
        result = run_analysis(payload)

    cm = result["current_metrics"]
    mc = result["monte_carlo"]

    # -----------------------------
    # Key Metrics
    # -----------------------------
    st.markdown('<div class="cs-section">Key Metrics</div>', unsafe_allow_html=True)

    c1, c2, c3, c4 = st.columns(4)

    c1.markdown(
        f"<div class='metric-label'>Monthly Cost</div><div class='metric-value'>{fmt(cm['monthly_cost'])}</div>",
        unsafe_allow_html=True
    )
    c2.markdown(
        f"<div class='metric-label'>Net Burn</div><div class='metric-value'>{fmt(cm['net_burn'])}</div>",
        unsafe_allow_html=True
    )

    runway = cm["runway_months"]
    runway_display = runway if isinstance(runway, str) else f"{runway:.1f}"
    c3.markdown(
        f"<div class='metric-label'>Runway (months)</div><div class='metric-value'>{runway_display}</div>",
        unsafe_allow_html=True
    )

    risk_label, risk_class = risk_text(mc["p_cash_negative_within_6_months"])
    c4.markdown(
        f"<div class='metric-label'>Risk Level</div><div class='metric-value {risk_class}'>{risk_label}</div>",
        unsafe_allow_html=True
    )

    # -----------------------------
    # Scenario Projection Chart
    # -----------------------------
    st.markdown('<div class="cs-section">Scenario Projection</div>', unsafe_allow_html=True)

    fig = plt.figure()
    ax = fig.add_subplot(111)

    for sc in result["scenarios"]:
        ax.plot(sc["cash_curve"], label=sc["name"])

    ax.axhline(0)
    ax.set_xlabel("Month")
    ax.set_ylabel("Cash")
    ax.legend()
    st.pyplot(fig, use_container_width=True)

    # -----------------------------
    # Conclusion Section (after chart)
    # -----------------------------
    st.markdown('<div class="cs-section">Conclusion</div>', unsafe_allow_html=True)

    runway_val = cm["runway_months"]
    risk_prob = float(mc["p_cash_negative_within_6_months"])

    runway_numeric = None if isinstance(runway_val, str) else float(runway_val)

    if runway_numeric is None:
        runway_summary = "Runway could not be expressed numerically under current assumptions."
    elif runway_numeric < 6:
        runway_summary = (
            "Runway is limited. Prioritize immediate burn reduction, revenue acceleration, "
            "or fundraising preparation."
        )
    elif runway_numeric < 12:
        runway_summary = (
            "Runway is moderate. Hiring should be cautious and aligned with near-term revenue confidence."
        )
    else:
        runway_summary = (
            "Runway is healthy. You can pursue growth initiatives with measured confidence while monitoring burn."
        )

    if risk_prob > 0.40:
        risk_summary = "Short-term insolvency risk is elevated under uncertainty. Mitigation actions are recommended."
    elif risk_prob > 0.15:
        risk_summary = "Short-term insolvency risk is moderate. Maintain a disciplined operating plan and monitor leading indicators."
    else:
        risk_summary = "Short-term insolvency risk appears controlled under current assumptions."

    st.markdown(
        f"""
        <div class="cs-card">
          <b>Executive Summary</b><br><br>
          {runway_summary}<br><br>
          <b>Risk assessment:</b> {risk_summary}<br><br>
          Recommended next step: review costs, validate growth assumptions, and re-run the model monthly or after major hiring/funding decisions.
        </div>
        """,
        unsafe_allow_html=True
    )

st.markdown('<div class="footer">CapitalSense ©️ Financial Simulation Engine</div>', unsafe_allow_html=True)