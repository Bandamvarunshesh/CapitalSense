import { useMemo, useState } from "react";

/**
 * Lightweight SVG line chart (no libraries)
 */
function LineChart({
  series,
  height = 260,
  padding = 24,
  yLabel = "Cash",
  xLabel = "Month",
}) {
  // series: [{ name, data: number[] }]
  const width = 820; // internal SVG width (scales via viewBox)

  const all = series.flatMap((s) => s.data);
  const hasData = all.length > 1;

  const minY = hasData ? Math.min(...all) : 0;
  const maxY = hasData ? Math.max(...all) : 1;

  const yRange = maxY - minY || 1;

  const maxLen = Math.max(...series.map((s) => s.data.length), 0);
  const n = Math.max(maxLen, 2);

  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const x = (i) => padding + (i / (n - 1)) * plotW;
  const y = (v) => padding + (1 - (v - minY) / yRange) * plotH;

  const gridLines = 5;
  const grid = Array.from({ length: gridLines + 1 }, (_, i) => i);

  const fmt = (num) => {
    if (!Number.isFinite(num)) return "-";
    const abs = Math.abs(num);
    if (abs >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return `${num.toFixed(2)}`;
  };

  const pathFor = (arr) => {
    if (!arr || arr.length < 2) return "";
    return arr
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
      .join(" ");
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {yLabel} vs {xLabel}
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Range: {fmt(minY)} → {fmt(maxY)}
        </div>
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* grid */}
          {grid.map((g) => {
            const yy = padding + (g / gridLines) * plotH;
            const val = maxY - (g / gridLines) * yRange;
            return (
              <g key={g}>
                <line
                  x1={padding}
                  y1={yy}
                  x2={width - padding}
                  y2={yy}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
                <text
                  x={padding}
                  y={yy - 6}
                  fontSize="11"
                  fill="rgba(255,255,255,0.55)"
                >
                  {fmt(val)}
                </text>
              </g>
            );
          })}

          {/* axes */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="rgba(255,255,255,0.18)"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="rgba(255,255,255,0.18)"
          />

          {/* 0-line if within range */}
          {minY < 0 && maxY > 0 && (
            <line
              x1={padding}
              y1={y(0)}
              x2={width - padding}
              y2={y(0)}
              stroke="rgba(239,68,68,0.35)"
              strokeDasharray="6 6"
            />
          )}

          {/* series lines */}
          {series.map((s, idx) => (
            <path
              key={s.name || idx}
              d={pathFor(s.data)}
              fill="none"
              stroke={`hsl(${(idx * 110) % 360} 90% 65%)`}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.95"
            />
          ))}
        </svg>
      </div>

      {/* legend */}
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        {series.map((s, idx) => (
          <div
            key={s.name || idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: `hsl(${(idx * 110) % 360} 90% 65%)`,
              }}
            />
            <span style={{ fontSize: 12, opacity: 0.9 }}>
              {s.name || `Series ${idx + 1}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const API_BASE = useMemo(() => {
    return (import.meta.env.VITE_API_BASE || "https://capitalsense.onrender.com").replace(/\/$/, "");
  }, []);

  // Keep as strings so backspace clears
  const [inputs, setInputs] = useState({
    cash_on_hand: "",
    monthly_revenue: "",
    monthly_fixed_costs: "",
    monthly_variable_costs: "",
    team_size: "",
    avg_fully_loaded_cost_per_employee: "",
    revenue_growth_rate_mom: "",
    planned_hires: "",
  });

  const [projectionMonths, setProjectionMonths] = useState(18);
  const [monteCarloRuns, setMonteCarloRuns] = useState(5000);

  const [backendStatus, setBackendStatus] = useState("unknown");
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState(null);
  const [activeScenario, setActiveScenario] = useState("auto"); // name or auto

  const onChange = (key) => (e) => {
    setInputs((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const checkBackend = async () => {
    setLoadingHealth(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setBackendStatus(data.status ?? "unknown");
    } catch {
      setBackendStatus("down");
      setError("Backend not reachable");
    } finally {
      setLoadingHealth(false);
    }
  };

  const runAnalysis = async () => {
    setLoadingAnalysis(true);
    setError("");
    setResult(null);

    const payload = {
      cash_on_hand: Number(inputs.cash_on_hand || 0),
      monthly_revenue: Number(inputs.monthly_revenue || 0),
      monthly_fixed_costs: Number(inputs.monthly_fixed_costs || 0),
      monthly_variable_costs: Number(inputs.monthly_variable_costs || 0),
      team_size: Number(inputs.team_size || 0),
      avg_fully_loaded_cost_per_employee: Number(inputs.avg_fully_loaded_cost_per_employee || 0),
      revenue_growth_rate_mom: Number(inputs.revenue_growth_rate_mom || 0),
      planned_hires: Number(inputs.planned_hires || 0),
    };

    try {
      const res = await fetch(
        `${API_BASE}/analyze?projection_horizon_months=${projectionMonths}&monte_carlo_runs=${monteCarloRuns}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));

      setResult(data);
      setActiveScenario("auto");
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const resetAll = () => {
    setInputs({
      cash_on_hand: "",
      monthly_revenue: "",
      monthly_fixed_costs: "",
      monthly_variable_costs: "",
      team_size: "",
      avg_fully_loaded_cost_per_employee: "",
      revenue_growth_rate_mom: "",
      planned_hires: "",
    });
    setProjectionMonths(18);
    setMonteCarloRuns(5000);
    setError("");
    setResult(null);
    setActiveScenario("auto");
  };

  // --- Extract what we need from backend response safely ---
  const riskLevel =
    result?.risk_level ??
    result?.metrics?.risk_level ??
    result?.metrics?.risk ??
    result?.risk ??
    null;

  const runwayMonths =
    result?.runway_months ??
    result?.metrics?.runway_months ??
    result?.metrics?.runway ??
    null;

  const scenariosRaw = Array.isArray(result?.scenarios) ? result.scenarios : [];
  const scenarioNames = scenariosRaw.map((s) => s?.name).filter(Boolean);

  const pickedName =
    activeScenario === "auto"
      ? scenarioNames[0] || null
      : scenarioNames.includes(activeScenario)
      ? activeScenario
      : scenarioNames[0] || null;

  const pickedScenario =
    pickedName ? scenariosRaw.find((s) => s?.name === pickedName) : null;

  const cashByMonth =
    pickedScenario?.cash_by_month ||
    pickedScenario?.cashByMonth ||
    pickedScenario?.cash ||
    null;

  const cashSeries = Array.isArray(cashByMonth) ? cashByMonth.map((v) => Number(v)) : [];

  const page = {
    minHeight: "100vh",
    padding: "28px 16px",
    background:
      "radial-gradient(1200px 700px at 15% 10%, rgba(124, 58, 237, 0.45), transparent 60%)," +
      "radial-gradient(900px 600px at 85% 20%, rgba(34, 197, 94, 0.35), transparent 55%)," +
      "linear-gradient(135deg, #0b1020 0%, #0a0f1a 55%, #070b12 100%)",
    color: "#e5e7eb",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
    display: "flex",
    justifyContent: "center",
  };

  const container = { width: "min(1250px, 100%)" };

  const card = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    backdropFilter: "blur(12px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "#e5e7eb",
    outline: "none",
  };

  const btn = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "#e5e7eb",
    cursor: "pointer",
  };

  const btnPrimary = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg, rgba(124,58,237,0.95), rgba(34,197,94,0.9))",
    color: "#0b1020",
    fontWeight: 800,
    cursor: "pointer",
    width: "100%",
  };

  const fieldMeta = [
    { key: "cash_on_hand", label: "Cash On Hand" },
    { key: "monthly_revenue", label: "Monthly Revenue" },
    { key: "monthly_fixed_costs", label: "Monthly Fixed Costs" },
    { key: "monthly_variable_costs", label: "Monthly Variable Costs" },
    { key: "team_size", label: "Team Size" },
    { key: "avg_fully_loaded_cost_per_employee", label: "Avg Fully Loaded Cost / Employee" },
    { key: "revenue_growth_rate_mom", label: "Revenue Growth Rate MoM" },
    { key: "planned_hires", label: "Planned Hires" },
  ];

  const ok = backendStatus === "ok";

  return (
    <div style={page}>
      <div style={container}>
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span style={{ fontWeight: 800 }}>CapitalSense</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: ok ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)",
                  boxShadow: ok
                    ? "0 0 0 4px rgba(34,197,94,0.15)"
                    : "0 0 0 4px rgba(239,68,68,0.15)",
                }}
              />
              <span style={{ fontSize: 13 }}>
                Backend: <b>{backendStatus}</b>
              </span>
            </div>

            <button style={btn} onClick={checkBackend} disabled={loadingHealth}>
              {loadingHealth ? "Checking..." : "Check Backend"}
            </button>
          </div>
        </div>

        <h1 style={{ fontSize: 34, margin: "8px 0 6px", letterSpacing: "-0.02em" }}>
          Run a Cash Runway + Risk Simulation
        </h1>
        <p style={{ opacity: 0.85, marginTop: 0, marginBottom: 16, maxWidth: 980 }}>
          Enter your company inputs, verify backend health, then run analysis to generate metrics and a
          cash runway graph (no raw JSON).
        </p>

        {/* Main grid */}
        <div
          className="_grid"
          style={{
            display: "grid",
            gridTemplateColumns: "420px 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* Inputs card */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Inputs</h3>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                  Empty while typing is allowed. Empty = 0 when analyzing.
                </div>
              </div>
              <button style={btn} onClick={resetAll}>
                Reset
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              {fieldMeta.map(({ key, label }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, opacity: 0.85 }}>{label}</label>
                  <input
                    type="number"
                    value={inputs[key]}
                    onChange={onChange(key)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.85 }}>Projection Months</label>
                <input
                  type="number"
                  value={projectionMonths}
                  onChange={(e) => setProjectionMonths(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.85 }}>Monte Carlo Runs</label>
                <input
                  type="number"
                  value={monteCarloRuns}
                  onChange={(e) => setMonteCarloRuns(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button style={btnPrimary} onClick={runAnalysis} disabled={loadingAnalysis}>
                {loadingAnalysis ? "Running..." : "Run Analysis"}
              </button>
            </div>

            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
              API Base: <span style={{ opacity: 0.9 }}>{API_BASE}</span>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#fecaca",
                  whiteSpace: "pre-wrap",
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Results card */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Results</h3>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                  Risk + runway summary and cash-by-month chart.
                </div>
              </div>

              {/* Scenario selector */}
              {scenarioNames.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {scenarioNames.map((name) => {
                    const selected = (activeScenario === "auto" && name === pickedName) || activeScenario === name;
                    return (
                      <button
                        key={name}
                        onClick={() => setActiveScenario(name)}
                        style={{
                          ...btn,
                          padding: "8px 12px",
                          background: selected ? "rgba(124,58,237,0.22)" : "rgba(255,255,255,0.08)",
                          border: selected
                            ? "1px solid rgba(124,58,237,0.55)"
                            : "1px solid rgba(255,255,255,0.14)",
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary chips */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 14,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(0,0,0,0.20))",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>Risk Level</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  {riskLevel ?? "—"}
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(0,0,0,0.20))",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>Cash Runway (months)</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  {runwayMonths ?? "—"}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div style={{ marginTop: 14 }}>
              {!result && (
                <div style={{ fontSize: 13, opacity: 0.8, padding: 6 }}>
                  No results yet. Click <b>Run Analysis</b>.
                </div>
              )}

              {result && cashSeries.length > 1 && (
                <LineChart
                  series={[
                    {
                      name: pickedName || "Scenario",
                      data: cashSeries,
                    },
                  ]}
                  yLabel="Cash"
                  xLabel="Month"
                />
              )}

              {result && cashSeries.length <= 1 && (
                <div style={{ fontSize: 13, opacity: 0.8, padding: 6 }}>
                  I didn’t find <code>cash_by_month</code> in the response for this scenario. If you want,
                  paste the response keys (top-level) and I’ll map it correctly.
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, opacity: 0.65 }}>
              Frontend: Cloudflare Pages · Backend: Render · API: {API_BASE}
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 980px) {
            ._grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}