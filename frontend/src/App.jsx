import { useEffect, useMemo, useState } from "react";

export default function App() {
  const API_BASE = useMemo(() => {
    return (import.meta.env.VITE_API_BASE || "https://capitalsense.onrender.com").replace(
      /\/$/,
      ""
    );
  }, []);

  const [inputs, setInputs] = useState({
    cash_on_hand: 0,
    monthly_revenue: 0,
    monthly_fixed_costs: 0,
    monthly_variable_costs: 0,
    team_size: 0,
    avg_fully_loaded_cost_per_employee: 0,
    revenue_growth_rate_mom: 0,
    planned_hires: 0,
  });

  const [projectionMonths, setProjectionMonths] = useState(18);
  const [monteCarloRuns, setMonteCarloRuns] = useState(5000);

  const [backendStatus, setBackendStatus] = useState("unknown");
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const onChange = (key) => (e) => {
    const value = e.target.value;
    setInputs((prev) => ({
      ...prev,
      [key]: Number(value),
    }));
  };

  const checkBackend = async () => {
    setLoadingHealth(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setBackendStatus(data.status);
    } catch (err) {
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

    try {
      const res = await fetch(
        `${API_BASE}/analyze?projection_horizon_months=${projectionMonths}&monte_carlo_runs=${monteCarloRuns}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputs),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(JSON.stringify(data));
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // optional: auto-check backend once on load (doesn't change functionality)
  useEffect(() => {
    checkBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatLabel = (key) =>
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace("Mom", "MoM");

  const statusPillStyle = () => {
    const base = {
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 0.3,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.08)",
      color: "rgba(255,255,255,0.92)",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    };

    if (backendStatus === "ok") {
      return {
        ...base,
        background:
          "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.18))",
        border: "1px solid rgba(34,197,94,0.35)",
      };
    }
    if (backendStatus === "down") {
      return {
        ...base,
        background:
          "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(244,63,94,0.18))",
        border: "1px solid rgba(239,68,68,0.35)",
      };
    }
    return base;
  };

  const cardStyle = {
    borderRadius: 18,
    padding: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 6,
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    outline: "none",
    background: "rgba(0,0,0,0.25)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
  };

  const buttonBase = {
    border: "none",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 800,
    letterSpacing: 0.4,
    color: "white",
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    transition: "transform 120ms ease, filter 120ms ease",
  };

  const primaryBtn = {
    ...buttonBase,
    background: "linear-gradient(135deg, #7c3aed, #22c55e)",
  };

  const secondaryBtn = {
    ...buttonBase,
    background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
  };

  const smallHint = {
    fontSize: 12,
    color: "rgba(255,255,255,0.62)",
    marginTop: 6,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 20,
        background:
          "radial-gradient(1000px 700px at 20% 10%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(900px 600px at 90% 20%, rgba(34,197,94,0.25), transparent 55%), radial-gradient(800px 600px at 50% 90%, rgba(14,165,233,0.18), transparent 55%), linear-gradient(180deg, #070A12 0%, #050710 100%)",
        color: "white",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background:
                    "linear-gradient(135deg, #7c3aed, #22c55e, #0ea5e9)",
                  boxShadow: "0 0 18px rgba(124,58,237,0.45)",
                  display: "inline-block",
                }}
              />
              <span style={{ fontWeight: 800, letterSpacing: 0.4 }}>
                CapitalSense
              </span>
            </div>

            <h1
              style={{
                margin: "12px 0 6px",
                fontSize: 32,
                lineHeight: 1.1,
              }}
            >
              Run a Cash Runway + Risk Simulation
            </h1>
            <div style={{ color: "rgba(255,255,255,0.68)", maxWidth: 720 }}>
              Enter your company inputs, verify backend health, then run analysis to
              generate metrics and scenario outputs.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={statusPillStyle()}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background:
                    backendStatus === "ok"
                      ? "rgba(34,197,94,0.9)"
                      : backendStatus === "down"
                      ? "rgba(239,68,68,0.9)"
                      : "rgba(148,163,184,0.9)",
                  boxShadow:
                    backendStatus === "ok"
                      ? "0 0 14px rgba(34,197,94,0.5)"
                      : backendStatus === "down"
                      ? "0 0 14px rgba(239,68,68,0.5)"
                      : "0 0 12px rgba(148,163,184,0.35)",
                }}
              />
              <span>Backend: {backendStatus}</span>
            </div>

            <button
              onClick={checkBackend}
              style={secondaryBtn}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            >
              {loadingHealth ? "Checking..." : "Check Backend"}
            </button>

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              API Base:{" "}
              <span style={{ color: "rgba(255,255,255,0.85)" }}>{API_BASE}</span>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 16,
          }}
        >
          {/* Inputs card */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Inputs</div>
                <div style={smallHint}>
                  All values start from <b>0</b>. Update them and run analysis.
                </div>
              </div>

              <button
                onClick={() => {
                  setInputs({
                    cash_on_hand: 0,
                    monthly_revenue: 0,
                    monthly_fixed_costs: 0,
                    monthly_variable_costs: 0,
                    team_size: 0,
                    avg_fully_loaded_cost_per_employee: 0,
                    revenue_growth_rate_mom: 0,
                    planned_hires: 0,
                  });
                  setProjectionMonths(18);
                  setMonteCarloRuns(5000);
                  setError("");
                  setResult(null);
                }}
                style={{
                  ...buttonBase,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "none",
                }}
              >
                Reset
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 14,
              }}
            >
              {Object.keys(inputs).map((key) => (
                <div key={key}>
                  <div style={labelStyle}>{formatLabel(key)}</div>
                  <input
                    type="number"
                    value={inputs[key]}
                    onChange={onChange(key)}
                    style={inputStyle}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 14,
              }}
            >
              <div>
                <div style={labelStyle}>Projection Months</div>
                <input
                  type="number"
                  value={projectionMonths}
                  onChange={(e) => setProjectionMonths(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={labelStyle}>Monte Carlo Runs</div>
                <input
                  type="number"
                  value={monteCarloRuns}
                  onChange={(e) => setMonteCarloRuns(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 12 }}>
              <button
                onClick={runAnalysis}
                style={{
                  ...primaryBtn,
                  flex: 1,
                  opacity: loadingAnalysis ? 0.75 : 1,
                  cursor: loadingAnalysis ? "not-allowed" : "pointer",
                }}
                disabled={loadingAnalysis}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.07)")}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
              >
                {loadingAnalysis ? "Running..." : "Run Analysis"}
              </button>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 14,
                  background:
                    "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(244,63,94,0.12))",
                  border: "1px solid rgba(239,68,68,0.35)",
                  color: "rgba(255,255,255,0.92)",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
                {error}
              </div>
            )}
          </div>

          {/* Results card */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Results</div>
            <div style={smallHint}>
              Output will appear here after you run analysis.
            </div>

            {!result && !error && (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 16,
                  padding: 14,
                  border: "1px dashed rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.65)",
                  background: "rgba(0,0,0,0.18)",
                }}
              >
                No results yet. Click <b>Run Analysis</b>.
              </div>
            )}

            {result && (
              <div style={{ marginTop: 14 }}>
                {/* quick highlights if available */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <Stat
                    title="Risk Level"
                    value={
                      result?.risk_level ||
                      result?.risk?.level ||
                      result?.risk?.risk_level ||
                      "—"
                    }
                  />
                  <Stat
                    title="Cash Runway"
                    value={
                      result?.metrics?.runway_months ??
                      result?.runway_months ??
                      "—"
                    }
                  />
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: 14,
                    borderRadius: 16,
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    overflow: "auto",
                    maxHeight: 520,
                    color: "rgba(255,255,255,0.92)",
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 16,
            color: "rgba(255,255,255,0.5)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Frontend: Cloudflare Pages • Backend: Render • API: {API_BASE}
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 12,
        background:
          "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(14,165,233,0.10))",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", fontWeight: 800 }}>
        {title}
      </div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>
        {String(value)}
      </div>
    </div>
  );
}