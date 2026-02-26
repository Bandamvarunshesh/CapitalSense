import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

export default function App() {
  const API_BASE = useMemo(() => {
    return (import.meta.env.VITE_API_BASE || "https://capitalsense.onrender.com").replace(/\/$/, "");
  }, []);

  // --- Inputs stored as strings so user can backspace to empty without snapping to 0
  const [inputs, setInputs] = useState({
    cash_on_hand: "0",
    monthly_revenue: "0",
    monthly_fixed_costs: "0",
    monthly_variable_costs: "0",
    team_size: "0",
    avg_fully_loaded_cost_per_employee: "0",
    revenue_growth_rate_mom: "0",
    planned_hires: "0",
  });

  const [projectionMonths, setProjectionMonths] = useState("18");
  const [monteCarloRuns, setMonteCarloRuns] = useState("5000");

  // Backend status: avoid showing "down" on first paint
  const [backendStatus, setBackendStatus] = useState("checking"); // checking | ok | down
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const resultsRef = useRef(null);

  // ---------- helpers ----------
  const toNumber = (v) => {
    // empty => 0 to keep backend stable
    if (v === "" || v === "-" || v === "." || v === "-.") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // allow only number typing; optionally allow negative for growth rate
  const sanitizeNumber = (raw, { allowNegative = false } = {}) => {
    let v = raw;

    // remove invalid chars
    v = v.replace(/[^\d.\-]/g, "");

    // only one dot
    const parts = v.split(".");
    if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");

    // handle minus sign
    if (!allowNegative) {
      v = v.replace(/-/g, "");
    } else {
      // only one '-' and only at start
      v = v.replace(/(?!^)-/g, "");
    }

    return v;
  };

  const setField = (key, { allowNegative = false } = {}) => (e) => {
    const v = sanitizeNumber(e.target.value, { allowNegative });
    setInputs((prev) => ({ ...prev, [key]: v }));
  };

  const setNumericState = (setter, { allowNegative = false } = {}) => (e) => {
    const v = sanitizeNumber(e.target.value, { allowNegative });
    setter(v);
  };

  const resetAll = () => {
    setInputs({
      cash_on_hand: "0",
      monthly_revenue: "0",
      monthly_fixed_costs: "0",
      monthly_variable_costs: "0",
      team_size: "0",
      avg_fully_loaded_cost_per_employee: "0",
      revenue_growth_rate_mom: "0",
      planned_hires: "0",
    });
    setProjectionMonths("18");
    setMonteCarloRuns("5000");
    setResult(null);
    setError("");
  };

  // ---------- backend ----------
  const checkBackend = async () => {
    setLoadingHealth(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data?.status === "ok") {
        setBackendStatus("ok");
      } else {
        setBackendStatus("down");
      }
    } catch {
      setBackendStatus("down");
    } finally {
      setLoadingHealth(false);
    }
  };

  // auto-check on load (prevents "down" flash)
  useEffect(() => {
    checkBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE]);

  // ---------- run analysis ----------
  const runAnalysis = async () => {
    setLoadingAnalysis(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        cash_on_hand: toNumber(inputs.cash_on_hand),
        monthly_revenue: toNumber(inputs.monthly_revenue),
        monthly_fixed_costs: toNumber(inputs.monthly_fixed_costs),
        monthly_variable_costs: toNumber(inputs.monthly_variable_costs),
        team_size: Math.max(0, Math.floor(toNumber(inputs.team_size))),
        avg_fully_loaded_cost_per_employee: toNumber(inputs.avg_fully_loaded_cost_per_employee),
        revenue_growth_rate_mom: toNumber(inputs.revenue_growth_rate_mom),
        planned_hires: Math.max(0, Math.floor(toNumber(inputs.planned_hires))),
      };

      const res = await fetch(
        `${API_BASE}/analyze?projection_horizon_months=${toNumber(projectionMonths)}&monte_carlo_runs=${toNumber(monteCarloRuns)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : JSON.stringify(data));
      }

      setResult(data);

      // smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // ---------- build chart data ----------
  const scenarios = useMemo(() => {
    const list = result?.scenarios || [];
    // Expect backend returns scenarios like:
    // [{ name: "Conservative", cash_by_month: [...] }, ...]
    return Array.isArray(list) ? list : [];
  }, [result]);

  const chartData = useMemo(() => {
    if (!scenarios.length) return null;

    // Create x labels: 0..N-1 (months)
    const maxLen = Math.max(...scenarios.map((s) => (s?.cash_by_month?.length || 0)));
    const labels = Array.from({ length: maxLen }, (_, i) => `M${i}`);

    // Use safe fallback
    const safeArr = (a) => (Array.isArray(a) ? a : []);

    const datasets = scenarios.map((s) => {
      const name = s?.name || "Scenario";
      const cash = safeArr(s?.cash_by_month);

      // Gradient fill handled by scriptable backgroundColor
      return {
        label: name,
        data: cash,
        borderWidth: 3,
        tension: 0.32,
        pointRadius: 0,
        fill: true,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(255,255,255,0.06)";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, "rgba(255,255,255,0.22)");
          g.addColorStop(1, "rgba(255,255,255,0.02)");
          return g;
        },
      };
    });

    return { labels, datasets };
  }, [scenarios]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "rgba(255,255,255,0.85)", font: { size: 12, weight: "600" } },
        },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(20, 22, 30, 0.92)",
          borderColor: "rgba(255,255,255,0.12)",
          borderWidth: 1,
          titleColor: "#fff",
          bodyColor: "rgba(255,255,255,0.9)",
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              const formatted = Number.isFinite(v) ? v.toLocaleString() : v;
              return `${ctx.dataset.label}: ${formatted}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.08)" },
          ticks: { color: "rgba(255,255,255,0.7)" },
          title: {
            display: true,
            text: "Months",
            color: "rgba(255,255,255,0.85)",
            font: { weight: "700" },
          },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.08)" },
          ticks: { color: "rgba(255,255,255,0.7)" },
          title: {
            display: true,
            text: "Cash Balance",
            color: "rgba(255,255,255,0.85)",
            font: { weight: "700" },
          },
        },
      },
    };
  }, []);

  // ---------- conclusion builder ----------
  const metrics = result?.metrics || {};
  const riskLevel = (metrics?.risk_level || "—").toString().toUpperCase();
  const pNegative6 = metrics?.p_cash_negative_within_6_months;
  const runwayLabel = metrics?.runway_label ?? "—";
  const runwayP10 = metrics?.runway_p10_months;
  const runwayP50 = metrics?.runway_p50_months;
  const runwayP90 = metrics?.runway_p90_months;

  const riskBadge = useMemo(() => {
    const level = riskLevel;
    const base = {
      padding: "6px 12px",
      borderRadius: 999,
      fontWeight: 800,
      fontSize: 12,
      letterSpacing: "0.08em",
      display: "inline-block",
    };
    if (level === "HIGH") return { ...base, background: "rgba(255,77,79,0.18)", color: "#ffb3b3", border: "1px solid rgba(255,77,79,0.35)" };
    if (level === "MEDIUM") return { ...base, background: "rgba(250,173,20,0.16)", color: "#ffe0a3", border: "1px solid rgba(250,173,20,0.35)" };
    if (level === "LOW") return { ...base, background: "rgba(82,196,26,0.14)", color: "#c8ffb6", border: "1px solid rgba(82,196,26,0.35)" };
    return { ...base, background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.18)" };
  }, [riskLevel]);

  const conclusionText = useMemo(() => {
    if (!result) return null;

    const p = Number.isFinite(pNegative6) ? (pNegative6 * 100).toFixed(1) : null;

    const runwayLine =
      `Runway label: ${runwayLabel}. ` +
      `Runway distribution (months): P10=${runwayP10 ?? "—"}, P50=${runwayP50 ?? "—"}, P90=${runwayP90 ?? "—"}.`;

    let narrative = "";
    if (riskLevel === "HIGH") {
      narrative =
        "Your current burn and/or cost structure is putting cash at risk very quickly. Even small misses in revenue growth or unexpected expenses can push cash negative sooner than expected. The priority is to immediately extend runway and reduce uncertainty.";
    } else if (riskLevel === "MEDIUM") {
      narrative =
        "Your runway looks manageable, but the downside scenarios still matter. You should reduce avoidable burn, improve predictability in revenue collection, and keep contingency plans ready if growth slows.";
    } else if (riskLevel === "LOW") {
      narrative =
        "Your cash position appears resilient across scenarios. The main focus is to sustain growth efficiently—avoid unnecessary fixed-cost expansion and keep monitoring leading indicators (collections, churn, CAC).";
    } else {
      narrative =
        "Review the scenario lines and the runway distribution to understand how sensitive your cash is to growth and costs. Focus on steps that increase runway and reduce downside risk.";
    }

    const actions =
      riskLevel === "HIGH"
        ? [
            "Freeze non-essential hiring and pause discretionary spend for the next 30–60 days.",
            "Negotiate fixed costs (vendors/cloud/office) and cut recurring commitments that don’t drive near-term revenue.",
            "Prioritize short-cycle revenue: collections, renewals, pricing updates, and upsells.",
            "Create a 13-week cash plan and review it weekly (cash-in vs cash-out).",
            "If needed, start fundraising or secure a credit line early (before runway becomes critical).",
          ]
        : riskLevel === "MEDIUM"
        ? [
            "Reduce burn by targeting the biggest recurring cost drivers first.",
            "Tighten forecasting: track pipeline conversion, collections timing, and churn weekly.",
            "Delay irreversible fixed-cost commitments until you see stable growth.",
            "Maintain a contingency plan: ‘what we cut first’ if growth slows.",
          ]
        : [
            "Invest in growth areas with clear ROI, but avoid locking in too much fixed cost too quickly.",
            "Keep monitoring: revenue growth, gross margin, and variable costs as volume scales.",
            "Stress test monthly: ‘What if growth is 50% lower for 2 months?’",
          ];

    const probabilityLine = p !== null ? `Probability of cash going negative within 6 months: ${p}%.` : "";

    return { runwayLine, narrative, probabilityLine, actions };
  }, [
    result,
    pNegative6,
    runwayLabel,
    runwayP10,
    runwayP50,
    runwayP90,
    riskLevel,
  ]);

  // ---------- UI ----------
  const statusPill = useMemo(() => {
    const common = { padding: "8px 12px", borderRadius: 999, fontWeight: 700, fontSize: 12, display: "inline-flex", gap: 8, alignItems: "center" };
    if (backendStatus === "ok") return { ...common, background: "rgba(82,196,26,0.16)", border: "1px solid rgba(82,196,26,0.35)", color: "#d6ffcc" };
    if (backendStatus === "down") return { ...common, background: "rgba(255,77,79,0.14)", border: "1px solid rgba(255,77,79,0.30)", color: "#ffcccc" };
    return { ...common, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.86)" };
  }, [backendStatus]);

  const statusText =
    backendStatus === "ok" ? "Backend: OK" : backendStatus === "down" ? "Backend: Unreachable" : "Backend: Checking…";

  return (
    <>
      <style>{`
        :root {
          --bg1: #0b1020;
          --bg2: #141a35;
          --card: rgba(255,255,255,0.08);
          --card2: rgba(255,255,255,0.06);
          --border: rgba(255,255,255,0.14);
          --text: rgba(255,255,255,0.92);
          --muted: rgba(255,255,255,0.68);
        }
        * { box-sizing: border-box; }
        html, body, #root { height: 100%; margin: 0; }
        body {
          background: radial-gradient(1200px 800px at 20% 10%, rgba(138, 94, 255, 0.28), transparent 55%),
                      radial-gradient(1000px 700px at 80% 20%, rgba(0, 212, 255, 0.18), transparent 55%),
                      linear-gradient(180deg, var(--bg1), var(--bg2));
          color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }
        .page {
          min-height: 100%;
          padding: 22px 22px 28px;
        }
        .topbar {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .brand {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 840px;
        }
        .logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .dot {
          width: 10px; height: 10px; border-radius: 999px;
          background: linear-gradient(135deg, rgba(140, 80, 255, 1), rgba(0, 212, 255, 1));
          box-shadow: 0 0 18px rgba(140, 80, 255, 0.6);
        }
        .title {
          margin: 0;
          font-size: clamp(28px, 3.2vw, 42px);
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1.1;
        }
        .subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.4;
        }
        .actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-end;
          min-width: 280px;
        }
        .btn {
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.10);
          color: var(--text);
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 120ms ease, background 120ms ease;
          width: 100%;
        }
        .btn:hover { transform: translateY(-1px); background: rgba(255,255,255,0.14); }
        .btnPrimary {
          background: linear-gradient(135deg, rgba(140, 80, 255, 0.95), rgba(0, 212, 255, 0.75));
          border: 1px solid rgba(255,255,255,0.18);
        }
        .btnPrimary:hover { background: linear-gradient(135deg, rgba(140, 80, 255, 1), rgba(0, 212, 255, 0.85)); }
        .hint {
          color: rgba(255,255,255,0.72);
          font-size: 12px;
          text-align: right;
          word-break: break-all;
        }
        .grid {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 18px;
        }
        @media (max-width: 980px) {
          .grid { grid-template-columns: 1fr; }
          .actions { align-items: stretch; min-width: unset; }
        }
        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 10px 32px rgba(0,0,0,0.25);
          backdrop-filter: blur(10px);
        }
        .cardTitle {
          margin: 0 0 10px;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: rgba(255,255,255,0.9);
        }
        .inputsGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 520px) {
          .inputsGrid { grid-template-columns: 1fr; }
        }
        .field label {
          display: block;
          font-size: 12px;
          color: rgba(255,255,255,0.72);
          margin-bottom: 6px;
          font-weight: 700;
        }
        .field input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(10, 12, 20, 0.55);
          color: rgba(255,255,255,0.92);
          outline: none;
        }
        .field input:focus {
          border-color: rgba(0, 212, 255, 0.55);
          box-shadow: 0 0 0 4px rgba(0, 212, 255, 0.12);
        }
        .rowActions {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }
        .rowActions .btn { width: auto; flex: 1; }
        .chartWrap {
          height: 340px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 10px;
        }
        .kpis {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin: 12px 0 14px;
        }
        @media (max-width: 920px) {
          .kpis { grid-template-columns: 1fr; }
        }
        .kpi {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 12px 14px;
        }
        .kpi .k {
          color: rgba(255,255,255,0.68);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .kpi .v {
          margin-top: 6px;
          font-size: 18px;
          font-weight: 900;
        }
        .fadeIn {
          animation: fadeUp 260ms ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .footerNote {
          margin-top: 12px;
          color: rgba(255,255,255,0.55);
          font-size: 12px;
          text-align: center;
        }
        .error {
          margin-top: 10px;
          padding: 10px 12px;
          background: rgba(255,77,79,0.12);
          border: 1px solid rgba(255,77,79,0.25);
          border-radius: 12px;
          color: rgba(255,220,220,0.95);
          font-weight: 700;
          white-space: pre-wrap;
        }
        ul { margin: 8px 0 0 18px; color: rgba(255,255,255,0.86); }
        li { margin: 6px 0; }
      `}</style>

      <div className="page">
        <div className="topbar">
          <div className="brand">
            <div className="logo">
              <span className="dot" />
              <div>
                <h1 className="title">CAPITALSENSE</h1>
                <p className="subtitle">
                  Run cash runway & risk simulation. Enter inputs, verify backend health, then run analysis to generate scenario results and recommendations.
                </p>
              </div>
            </div>
          </div>

          <div className="actions">
            <div style={statusPill}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: backendStatus === "ok" ? "#52c41a" : backendStatus === "down" ? "#ff4d4f" : "rgba(255,255,255,0.55)" }} />
              <span>{statusText}</span>
            </div>

            <button className="btn btnPrimary" onClick={checkBackend} disabled={loadingHealth}>
              {loadingHealth ? "Checking…" : "Check Backend"}
            </button>

            <div className="hint">API Base: {API_BASE}</div>
          </div>
        </div>

        <div className="grid">
          {/* Inputs */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h3 className="cardTitle">Inputs</h3>
              <button className="btn" onClick={resetAll}>Reset</button>
            </div>

            <div className="inputsGrid">
              <div className="field">
                <label>Cash On Hand</label>
                <input inputMode="decimal" value={inputs.cash_on_hand} onChange={setField("cash_on_hand")} />
              </div>
              <div className="field">
                <label>Monthly Revenue</label>
                <input inputMode="decimal" value={inputs.monthly_revenue} onChange={setField("monthly_revenue")} />
              </div>

              <div className="field">
                <label>Monthly Fixed Costs</label>
                <input inputMode="decimal" value={inputs.monthly_fixed_costs} onChange={setField("monthly_fixed_costs")} />
              </div>
              <div className="field">
                <label>Monthly Variable Costs</label>
                <input inputMode="decimal" value={inputs.monthly_variable_costs} onChange={setField("monthly_variable_costs")} />
              </div>

              <div className="field">
                <label>Team Size</label>
                <input inputMode="numeric" value={inputs.team_size} onChange={setField("team_size")} />
              </div>
              <div className="field">
                <label>Avg Fully Loaded Cost / Employee</label>
                <input inputMode="decimal" value={inputs.avg_fully_loaded_cost_per_employee} onChange={setField("avg_fully_loaded_cost_per_employee")} />
              </div>

              <div className="field">
                <label>Revenue Growth Rate MoM (can be negative)</label>
                <input inputMode="decimal" value={inputs.revenue_growth_rate_mom} onChange={setField("revenue_growth_rate_mom", { allowNegative: true })} />
              </div>
              <div className="field">
                <label>Planned Hires</label>
                <input inputMode="numeric" value={inputs.planned_hires} onChange={setField("planned_hires")} />
              </div>

              <div className="field">
                <label>Projection Months</label>
                <input inputMode="numeric" value={projectionMonths} onChange={setNumericState(setProjectionMonths)} />
              </div>
              <div className="field">
                <label>Monte Carlo Runs</label>
                <input inputMode="numeric" value={monteCarloRuns} onChange={setNumericState(setMonteCarloRuns)} />
              </div>
            </div>

            <div className="rowActions">
              <button
                className="btn btnPrimary"
                onClick={runAnalysis}
                disabled={loadingAnalysis}
                title={backendStatus === "down" ? "Backend unreachable. Try Check Backend." : "Run analysis"}
              >
                {loadingAnalysis ? "Running Analysis…" : "Run Analysis"}
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="footerNote">
              Frontend: Cloudflare Pages • Backend: Render • API: {API_BASE}
            </div>
          </div>

          {/* Results */}
          <div className="card" ref={resultsRef}>
            <h3 className="cardTitle">Results</h3>

            {!result && (
              <div style={{ color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>
                Output will appear here after you run analysis.
              </div>
            )}

            {result && (
              <div className="fadeIn">
                <div className="kpis">
                  <div className="kpi">
                    <div className="k">Risk Level</div>
                    <div className="v">
                      <span style={riskBadge}>{riskLevel}</span>
                    </div>
                  </div>

                  <div className="kpi">
                    <div className="k">Cash Runway Label</div>
                    <div className="v">{runwayLabel ?? "—"}</div>
                  </div>

                  <div className="kpi">
                    <div className="k">Cash Negative in 6 Months</div>
                    <div className="v">
                      {Number.isFinite(pNegative6) ? `${(pNegative6 * 100).toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>

                <div className="chartWrap">
                  {chartData ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div style={{ color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>No scenario data returned.</div>
                  )}
                </div>

                <div style={{ marginTop: 14 }} id="results-section">
                  <h3 className="cardTitle" style={{ marginBottom: 8 }}>Conclusion</h3>

                  {conclusionText && (
                    <>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>
                        Risk level: <span style={riskBadge}>{riskLevel}</span>{" "}
                        {conclusionText.probabilityLine ? `• ${conclusionText.probabilityLine}` : ""}
                      </div>

                      <div style={{ color: "rgba(255,255,255,0.86)", lineHeight: 1.5 }}>
                        {conclusionText.narrative}
                      </div>

                      <div style={{ marginTop: 10, color: "rgba(255,255,255,0.86)" }}>
                        {conclusionText.runwayLine}
                      </div>

                      <div style={{ marginTop: 10, fontWeight: 900 }}>Recommended actions</div>
                      <ul>
                        {conclusionText.actions.map((a, idx) => (
                          <li key={idx}>{a}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}