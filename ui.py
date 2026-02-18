import streamlit as st
import matplotlib.pyplot as plt

from app.engine import Inputs, full_analysis


st.set_page_config(page_title="CapitalSense", layout="wide")
st.markdown("## CapitalSense")
st.markdown("### Intelligent Runway, Risk & Hiring Engine")


# ---------- Sidebar Inputs ----------
st.sidebar.header("Inputs")

cash_on_hand = st.sidebar.number_input("Cash on hand", min_value=0.0, value=3000000.0, step=50000.0)
monthly_revenue = st.sidebar.number_input("Monthly revenue", min_value=0.0, value=450000.0, step=10000.0)
monthly_fixed_costs = st.sidebar.number_input("Monthly fixed costs", min_value=0.0, value=200000.0, step=10000.0)
monthly_variable_costs = st.sidebar.number_input("Monthly variable costs", min_value=0.0, value=80000.0, step=5000.0)

team_size = st.sidebar.number_input("Team size", min_value=0, value=6, step=1)
avg_cost = st.sidebar.number_input("Avg fully-loaded cost / employee (monthly)", min_value=0.0, value=120000.0, step=5000.0)

growth_pct = st.sidebar.number_input("Revenue growth (MoM %) ", value=8.0, step=0.5)
planned_hires = st.sidebar.number_input("Planned hires now", min_value=0, value=0, step=1)

months = st.sidebar.slider("Projection horizon (months)", min_value=6, max_value=36, value=12, step=1)
runs = st.sidebar.slider("Monte Carlo runs", min_value=1000, max_value=50000, value=5000, step=1000)

analyze_clicked = st.sidebar.button("Analyze")

# ---------- Run Analysis ----------
if analyze_clicked:
    inp = Inputs(
        cash_on_hand=float(cash_on_hand),
        monthly_revenue=float(monthly_revenue),
        monthly_fixed_costs=float(monthly_fixed_costs),
        monthly_variable_costs=float(monthly_variable_costs),
        team_size=int(team_size),
        avg_fully_loaded_cost_per_employee=float(avg_cost),
        revenue_growth_rate_mom=float(growth_pct) / 100.0,
        planned_hires=int(planned_hires),
    )

    result = full_analysis(inp, months=int(months), runs=int(runs))

    # ---------- Top KPIs ----------
    col1, col2, col3, col4 = st.columns(4)
    cm = result["current_metrics"]
    mc = result["monte_carlo"]
    pv = result["pivot"]
    hs = result["hiring_suggestion"]
    rs = result["revenue_sensitivity"]

    runway = cm["runway_months"]
    net_burn = cm["net_burn"]
    monthly_cost = cm["monthly_cost"]

    col1.metric("Monthly Cost", f"{monthly_cost:,.0f}")
    col2.metric("Net Burn (Cost - Revenue)", f"{net_burn:,.0f}")

    if isinstance(runway, str):
        col3.metric("Runway (months)", runway)
    else:
        col3.metric("Runway (months)", f"{runway:.1f}")

    col4.metric("Pivot Score (0–100)", f"{pv['pivot_score']:.0f}")

    st.divider()

    # ---------- Risk + Hiring ----------
    c5, c6 = st.columns(2)

    with c5:
        st.subheader("Monte Carlo Risk (Probability)")
        st.write({
            "P(cash negative within horizon)": f"{mc['p_cash_negative_within_horizon']:.0%}",
            "P(cash negative within 6 months)": f"{mc['p_cash_negative_within_6_months']:.0%}",
            "P(cash negative within 3 months)": f"{mc['p_cash_negative_within_3_months']:.0%}",
            "P(break-even within horizon)": f"{mc['p_break_even_within_horizon']:.0%}",
        })

    with c6:
        st.subheader("Hiring + Revenue Sensitivity")
        st.write({
            "Safe hires now (>= 9 mo runway)": int(hs["safe_hires_now"]),
            "Extra monthly revenue needed (for 12 mo runway)": f"{rs['extra_monthly_revenue_needed_for_target_runway']:,.0f}",
            "Revenue needed to break-even now": f"{rs['monthly_revenue_needed_for_break_even']:,.0f}",
            "Status": rs["status"],
        })

    st.divider()

    # ---------- Pivot Reasons ----------
    st.subheader("Pivot Reasons")
    for r in pv["reasons"]:
        st.write(f"- {r}")

    st.divider()

    # ---------- Scenario Chart ----------
    st.subheader("Cash Projection by Scenario")

    fig = plt.figure()
    ax = fig.add_subplot(111)

    for sc in result["scenarios"]:
        ax.plot(sc["cash_curve"], label=sc["name"])

    ax.set_xlabel("Month")
    ax.set_ylabel("Cash")
    ax.legend()

    st.pyplot(fig)

    # ---------- Raw JSON (optional) ----------
    with st.expander("Show raw JSON output"):
        st.json(result)

else:
    st.info("Fill inputs on the left and click **Analyze**.")
