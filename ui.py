import time
import inspect
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
# Bright Neon Theme + Animated Tabs + More Motion
# -------------------------------------------------
st.markdown(
    """
    <style>
      html, body, .stApp {
          background-color: #050816;
          color: #EAF2FF;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }

      /* --- Bright animated gradient background --- */
      .stApp {
        background:
          radial-gradient(1200px 800px at 10% 10%, rgba(0,255,240,0.18), transparent 55%),
          radial-gradient(900px 700px at 90% 30%, rgba(255,0,200,0.12), transparent 55%),
          radial-gradient(900px 700px at 55% 95%, rgba(255,255,0,0.10), transparent 60%),
          linear-gradient(180deg, #050816 0%, #02030A 100%);
        overflow-x: hidden;
      }

      /* Floating neon blobs */
      .cs-bg-blobs {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        opacity: 0.70;
      }
      .cs-blob {
        position: absolute;
        width: 460px;
        height: 460px;
        border-radius: 999px;
        filter: blur(46px);
        transform: translate3d(0,0,0);
        animation: csFloat 9s ease-in-out infinite;
        mix-blend-mode: screen;
      }
      .cs-blob.one   { left: -160px; top: 60px;  background: rgba(0,255,240,0.40); animation-duration: 11s; }
      .cs-blob.two   { right: -180px; top: 160px; background: rgba(255,0,200,0.30); animation-duration: 13s; }
      .cs-blob.three { left: 20%; bottom: -220px; background: rgba(255,255,0,0.22); animation-duration: 15s; }

      @keyframes csFloat {
        0%   { transform: translateY(0) translateX(0) scale(1); }
        50%  { transform: translateY(-26px) translateX(20px) scale(1.06); }
        100% { transform: translateY(0) translateX(0) scale(1); }
      }

      .block-container {
          position: relative;
          z-index: 1;
          padding-top: 1.2rem;
          padding-bottom: 1.4rem;
      }

      /* Header */
      .cs-header {
          padding: 1.2rem 1.5rem;
          border-radius: 16px;
          background: rgba(10,14,40,0.60);
          margin-bottom: 1rem;
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 18px 45px rgba(0,0,0,0.55);
          backdrop-filter: blur(12px);
          animation: csFadeUp 520ms ease-out both;
      }

      .cs-title {
          font-size: 2.1rem;
          font-weight: 900;
          margin: 0;
          background: linear-gradient(90deg, #00FFF0, #FF00C8, #FFE600);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          letter-spacing: 0.4px;
          text-shadow: 0 0 22px rgba(0,255,240,0.18);
      }

      .cs-subtitle {
          font-size: 1rem;
          margin-top: 0.35rem;
          color: rgba(234,242,255,0.74);
          line-height: 1.4;
      }

      /* Section heading: neon underline sweep */
      .cs-section {
          padding: 0.75rem 0.95rem;
          border-radius: 12px;
          margin-top: 1rem;
          margin-bottom: 0.6rem;
          font-weight: 900;
          background: rgba(10,14,40,0.55);
          border: 1px solid rgba(255,255,255,0.10);
          color: #66FFFD;
          animation: csFadeUp 420ms ease-out both;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(12px);
      }
      .cs-section::after{
          content:"";
          position:absolute;
          left:-30%;
          bottom:0;
          width:160%;
          height:2px;
          background: linear-gradient(90deg, transparent, rgba(0,255,240,0.95), rgba(255,0,200,0.70), transparent);
          animation: csSweep 2.1s ease-in-out infinite;
          opacity: 0.8;
      }
      @keyframes csSweep {
        0% { transform: translateX(-35%); opacity: 0.35; }
        50% { transform: translateX(0%); opacity: 1; }
        100% { transform: translateX(35%); opacity: 0.35; }
      }

      /* Cards */
      .cs-card {
          padding: 1rem;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(10,14,40,0.50);
          color: #EAF2FF;
          backdrop-filter: blur(12px);
          animation: csFadeUp 520ms ease-out both;
          box-shadow: 0 16px 40px rgba(0,0,0,0.35);
      }
      .cs-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 24px 60px rgba(0,0,0,0.45);
        border-color: rgba(255,255,255,0.22);
      }

      /* Metric tiles */
      .cs-metric {
        padding: 0.95rem 1rem;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(10,14,40,0.55);
        backdrop-filter: blur(12px);
        animation: csFadeUp 520ms ease-out both;
        box-shadow: 0 16px 38px rgba(0,0,0,0.32);
      }
      .metric-label {
          font-size: 0.85rem;
          color: rgba(234,242,255,0.70);
      }
      .metric-value {
          font-size: 1.75rem;
          font-weight: 950;
          margin-top: 0.25rem;
          letter-spacing: 0.25px;
          text-shadow: 0 10px 35px rgba(0,0,0,0.45);
      }
      .mv-cyan { color: #00FFF0; }
      .mv-pink { color: #FF00C8; }
      .mv-yellow { color: #FFE600; }
      .mv-green { color: #39FF14; }
      .mv-red { color: #FF3B3B; }

      .risk-low  { color: #39FF14; font-weight: 950; }
      .risk-med  { color: #FFE600; font-weight: 950; }
      .risk-high { color: #FF3B3B; font-weight: 950; }

      .risk-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(2,6,23,0.35);
      }
      .risk-dot {
        width: 10px; height: 10px; border-radius: 999px;
        animation: csPulse 1.25s ease-in-out infinite;
      }
      @keyframes csPulse {
        0% { transform: scale(1); opacity: 0.55; }
        50% { transform: scale(1.55); opacity: 1; }
        100% { transform: scale(1); opacity: 0.55; }
      }

      /* Buttons */
      .stButton>button {
          background: linear-gradient(90deg, #00FFF0, #FF00C8);
          color: #050816;
          font-weight: 950;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10);
          position: relative;
          overflow: hidden;
          box-shadow: 0 14px 30px rgba(0,0,0,0.35);
      }
      .stButton>button:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 20px 50px rgba(0,0,0,0.48);
      }
      .stButton>button::after{
          content:"";
          position:absolute;
          top:50%;
          left:50%;
          width:0;
          height:0;
          border-radius:999px;
          transform: translate(-50%,-50%);
          background: rgba(255,255,255,0.22);
          opacity: 0;
      }
      .stButton>button:hover::after{
          width: 340px;
          height: 340px;
          opacity: 1;
          transition: width 520ms ease, height 520ms ease, opacity 700ms ease;
      }

      /* Inputs */
      input, textarea {
          background-color: rgba(2,6,23,0.35) !important;
          color: #EAF2FF !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 12px !important;
      }
      input:focus, textarea:focus {
        outline: none !important;
        border-color: rgba(0,255,240,0.85) !important;
        box-shadow: 0 0 0 3px rgba(0,255,240,0.25) !important;
      }

      .footer {
          margin-top: 2rem;
          font-size: 0.85rem;
          color: rgba(234,242,255,0.65);
          opacity: 0.9;
      }

      /* Global fade up */
      * {
        transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease,
                    transform 180ms ease, box-shadow 180ms ease, opacity 220ms ease;
      }
      @keyframes csFadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* -----------------------------
         ANIMATED TABS (Streamlit st.tabs)
         ----------------------------- */
      [data-testid="stTabs"] { margin-top: 0.25rem; }

      /* tab row */
      [data-testid="stTabs"] > div:first-child {
        background: rgba(10,14,40,0.45);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 16px;
        padding: 10px;
        backdrop-filter: blur(12px);
        box-shadow: 0 14px 34px rgba(0,0,0,0.28);
        animation: csFadeUp 520ms ease-out both;
      }

      /* tab buttons */
      [data-testid="stTabs"] button {
        border-radius: 999px !important;
        padding: 10px 14px !important;
        font-weight: 900 !important;
        color: rgba(234,242,255,0.75) !important;
        background: rgba(2,6,23,0.25) !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        margin-right: 8px !important;
        position: relative;
        overflow: hidden;
        transform: translateZ(0);
      }

      [data-testid="stTabs"] button:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 30px rgba(0,0,0,0.35);
        border-color: rgba(0,255,240,0.30) !important;
      }

      /* shine sweep */
      [data-testid="stTabs"] button::after {
        content:"";
        position:absolute;
        top:-60%;
        left:-30%;
        width: 40%;
        height: 220%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        transform: rotate(20deg) translateX(-120%);
        opacity: 0;
      }
      [data-testid="stTabs"] button:hover::after {
        opacity: 1;
        transform: rotate(20deg) translateX(260%);
        transition: transform 650ms ease, opacity 350ms ease;
      }

      /* active */
      [data-testid="stTabs"] button[aria-selected="true"] {
        color: #050816 !important;
        background: linear-gradient(90deg, #00FFF0, #FF00C8, #FFE600) !important;
        border-color: rgba(255,255,255,0.18) !important;
        box-shadow: 0 18px 40px rgba(0,0,0,0.40);
        transform: translateY(-1px);
      }

      /* tab content animation */
      [data-testid="stTabs"] [data-testid="stMarkdownContainer"],
      [data-testid="stTabs"] [data-testid="stVerticalBlock"] {
        animation: csTabIn 360ms ease-out both;
      }
      @keyframes csTabIn {
        from { opacity: 0; transform: translateY(10px) scale(0.99); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Charts */
      [data-testid="stPyplotFigure"] { animation: csFadeUp 480ms ease-out both; }
      [data-testid="stPyplotFigure"]:hover { transform: translateY(-2px); }
    </style>
    """,
    unsafe_allow_html=True
)

# Background blobs
st.markdown(
    """
    <div class="cs-bg-blobs">
      <div class="cs-blob one"></div>
      <div class="cs-blob two"></div>
      <div class="cs-blob three"></div>
    </div>
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
# Helpers
# -------------------------------------------------
def fmt(x):
    return f"{x:,.0f}"

def risk_text(p6: float):
    if p6 < 0.15:
        return "Low Risk", "risk-low"
    elif p6 < 0.40:
        return "Medium Risk", "risk-med"
    else:
        return "High Risk", "risk-high"

def parse_float(label: str, raw: str):
    raw = (raw or "").strip()
    if raw == "":
        return None, f"{label}: required"
    try:
        v = float(raw.replace(",", ""))
        if v < 0:
            return None, f"{label}: must be ≥ 0"
        return v, None
    except ValueError:
        return None, f"{label}: enter a number (example: 250000)"

def parse_int(label: str, raw: str):
    raw = (raw or "").strip()
    if raw == "":
        return None, f"{label}: required"
    try:
        v = int(float(raw.replace(",", "")))
        if v < 0:
            return None, f"{label}: must be ≥ 0"
        return v, None
    except ValueError:
        return None, f"{label}: enter a whole number (example: 6)"

# -------------------------------------------------
# Robust engine call wrapper:
# - Avoids "unexpected keyword argument months"
# - Adapts to your engine's real parameter names
# -------------------------------------------------
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

    sig = inspect.signature(full_analysis)
    params = sig.parameters

    kwargs = {}

    # months/horizon variants
    if "months" in params:
        kwargs["months"] = payload["months"]
    elif "horizon_months" in params:
        kwargs["horizon_months"] = payload["months"]
    elif "n_months" in params:
        kwargs["n_months"] = payload["months"]
    elif "projection_months" in params:
        kwargs["projection_months"] = payload["months"]

    # runs/simulations variants
    if "runs" in params:
        kwargs["runs"] = payload["runs"]
    elif "mc_runs" in params:
        kwargs["mc_runs"] = payload["runs"]
    elif "n_runs" in params:
        kwargs["n_runs"] = payload["runs"]
    elif "simulations" in params:
        kwargs["simulations"] = payload["runs"]

    # try kwargs, then positional fallbacks
    try:
        return full_analysis(inp, **kwargs)
    except TypeError:
        try:
            return full_analysis(inp, payload["months"], payload["runs"])
        except TypeError:
            try:
                return full_analysis(inp, payload["months"])
            except TypeError:
                return full_analysis(inp)

def metric_tile(col, label, value, color_class="mv-cyan"):
    col.markdown(
        f"""
        <div class="cs-metric">
          <div class="metric-label">{label}</div>
          <div class="metric-value {color_class}">{value}</div>
        </div>
        """,
        unsafe_allow_html=True
    )

# -------------------------------------------------
# Layout
# -------------------------------------------------
left, right = st.columns([1, 2])

# -------------------------------------------------
# Inputs Panel
# -------------------------------------------------
with left:
    st.markdown('<div class="cs-section">Inputs</div>', unsafe_allow_html=True)

    cash_raw = st.text_input("Cash on hand", value="0")
    rev_raw = st.text_input("Monthly revenue", value="0")
    fixed_raw = st.text_input("Monthly fixed costs", value="0")
    var_raw = st.text_input("Monthly variable costs", value="0")

    team_raw = st.text_input("Team size", value="0")
    cost_raw = st.text_input("Average cost per employee (monthly)", value="0")
    hires_raw = st.text_input("Planned hires now", value="0")

    growth_raw = st.text_input("Revenue growth (MoM %)", value="0")
    months_raw = st.text_input("Projection horizon (months)", value="12")
    runs_raw = st.text_input("Monte Carlo runs", value="5000")

    analyze = st.button("Run Analysis", use_container_width=True)

# -------------------------------------------------
# Tabs (Right Panel)
# -------------------------------------------------
with right:
    tab_overview, tab_analysis, tab_notes = st.tabs(["✨ Overview", "📈 Analysis", "🧠 Notes"])

    # ----------------------------
    # Overview
    # ----------------------------
    with tab_overview:
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
            st.markdown(
                """
                <div class="cs-card">
                  <b>Getting Started</b><br><br>
                  1) Enter inputs on the left (all fields start at 0).<br>
                  2) Add cash, revenue, costs, team size, and expected growth.<br>
                  3) Click <b>Run Analysis</b> to generate runway, risk, and scenarios.<br><br>
                  Tip: Commas are allowed (example: 3,000,000).
                </div>
                """,
                unsafe_allow_html=True
            )
            st.stop()

    if not analyze:
        st.stop()

    # -------------------------------------------------
    # Validate + Parse inputs
    # -------------------------------------------------
    errors = []

    cash_on_hand, e = parse_float("Cash on hand", cash_raw)
    if e: errors.append(e)

    monthly_revenue, e = parse_float("Monthly revenue", rev_raw)
    if e: errors.append(e)

    monthly_fixed_costs, e = parse_float("Monthly fixed costs", fixed_raw)
    if e: errors.append(e)

    monthly_variable_costs, e = parse_float("Monthly variable costs", var_raw)
    if e: errors.append(e)

    team_size, e = parse_int("Team size", team_raw)
    if e: errors.append(e)

    avg_cost, e = parse_float("Average cost per employee (monthly)", cost_raw)
    if e: errors.append(e)

    planned_hires, e = parse_int("Planned hires now", hires_raw)
    if e: errors.append(e)

    growth_pct, e = parse_float("Revenue growth (MoM %)", growth_raw)
    if e: errors.append(e)

    months, e = parse_int("Projection horizon (months)", months_raw)
    if e: errors.append(e)

    runs, e = parse_int("Monte Carlo runs", runs_raw)
    if e: errors.append(e)

    if errors:
        with tab_analysis:
            st.error("Fix the following input issues:")
            for msg in errors:
                st.write(f"- {msg}")
        st.stop()

    growth_fraction = float(growth_pct) / 100.0

    payload = {
        "cash": cash_on_hand,
        "rev": monthly_revenue,
        "fixed": monthly_fixed_costs,
        "var": monthly_variable_costs,
        "team": team_size,
        "cost": avg_cost,
        "growth": growth_fraction,
        "hires": planned_hires,
        "months": months,
        "runs": runs,
    }

    # -------------------------------------------------
    # Animated run
    # -------------------------------------------------
    with tab_analysis:
        st.markdown('<div class="cs-section">Running Simulation</div>', unsafe_allow_html=True)

        progress = st.progress(0)
        status = st.empty()

        for i in range(0, 101, 4):
            progress.progress(i)
            if i < 35:
                status.markdown("<div class='cs-card'>Validating inputs… ✨</div>", unsafe_allow_html=True)
            elif i < 70:
                status.markdown("<div class='cs-card'>Simulating scenarios… 🚀</div>", unsafe_allow_html=True)
            else:
                status.markdown("<div class='cs-card'>Summarizing runway & risk… 🧠</div>", unsafe_allow_html=True)
            time.sleep(0.015)

        with st.spinner("Running Monte Carlo..."):
            result = run_analysis(payload)

        status.empty()
        progress.empty()

    cm = result["current_metrics"]
    mc = result["risk"]

    # -------------------------------------------------
    # Analysis Tab
    # -------------------------------------------------
    with tab_analysis:
        st.markdown('<div class="cs-section">Key Metrics</div>', unsafe_allow_html=True)
        c1, c2, c3, c4 = st.columns(4)

        metric_tile(c1, "Monthly Cost", fmt(cm["monthly_cost"]), "mv-yellow")
        metric_tile(c2, "Net Burn", fmt(cm["net_burn"]), "mv-red")

        runway = cm["runway_months"]
        runway_display = runway if isinstance(runway, str) else f"{float(runway):.1f}"
        if isinstance(runway, str):
            runway_color = "mv-cyan"
        else:
            runway_color = "mv-green" if float(runway) >= 12 else ("mv-yellow" if float(runway) >= 6 else "mv-red")
        metric_tile(c3, "Runway (months)", runway_display, runway_color)

        risk_prob = float(result["p_cash_negative_within_6_months"])
        risk_label, risk_class = risk_text(risk_prob)
        dot_color = "#39FF14" if risk_class == "risk-low" else ("#FFE600" if risk_class == "risk-med" else "#FF3B3B")

        c4.markdown(
            f"""
            <div class="cs-metric">
              <div class="metric-label">Risk Level</div>
              <div class="risk-pill">
                <span class="risk-dot" style="background:{dot_color};"></span>
                <span class="metric-value {risk_class}" style="font-size:1.25rem; margin:0;">{risk_label}</span>
              </div>
              <div class="metric-label" style="margin-top:10px;">P(cash &lt; 0 in 6 mo): <b>{risk_prob:.0%}</b></div>
            </div>
            """,
            unsafe_allow_html=True
        )

        st.markdown('<div class="cs-section">Scenario Projection</div>', unsafe_allow_html=True)
        st.markdown("<div class='cs-card'>", unsafe_allow_html=True)

        fig = plt.figure()
        ax = fig.add_subplot(111)

        for sc in result.get("scenarios", []):
            ax.plot(sc["cash_curve"], label=sc.get("name", "Scenario"))

        ax.axhline(0)
        ax.set_xlabel("Month")
        ax.set_ylabel("Cash")
        if result.get("scenarios"):
            ax.legend()

        st.pyplot(fig, use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)

        st.markdown('<div class="cs-section">Conclusion</div>', unsafe_allow_html=True)

        runway_val = cm["runway_months"]
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
            risk_summary = "Short-term insolvency risk is moderate. Maintain disciplined operations and monitor leading indicators."
        else:
            risk_summary = "Short-term insolvency risk appears controlled under current assumptions."

        st.markdown(
            f"""
            <div class="cs-card">
              <b>Executive Summary</b><br><br>
              {runway_summary}<br><br>
              <b>Risk assessment:</b> {risk_summary}<br><br>
              Recommended next step: validate assumptions, review costs, and re-run the model after major hiring or funding decisions.
            </div>
            """,
            unsafe_allow_html=True
        )

    # -------------------------------------------------
    # Notes Tab
    # -------------------------------------------------
    with tab_notes:
        st.markdown('<div class="cs-section">Model Notes</div>', unsafe_allow_html=True)
        st.markdown(
            """
            <div class="cs-card">
              <b>Tips to get better outputs</b><br><br>
              • Use realistic monthly costs (fixed + variable + employees).<br>
              • Keep growth modest unless you’re confident in pipeline/retention.<br>
              • Re-run after changing hires or revenue assumptions.<br><br>
              <b>Interpretation</b><br>
              Risk is shown as P(cash &lt; 0 within 6 months) from Monte Carlo runs.
            </div>
            """,
            unsafe_allow_html=True
        )

st.markdown('<div class="footer">CapitalSense ©️ Financial Simulation Engine</div>', unsafe_allow_html=True)
