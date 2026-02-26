import { useEffect, useMemo, useState } from "react";

/* ---------- Multi-line Chart ---------- */
function LineChart({ scenarios }) {
  const width = 900;
  const height = 350;
  const padding = 40;

  const allValues = scenarios.flatMap((s) => s.data);
  const minY = Math.min(...allValues);
  const maxY = Math.max(...allValues);
  const range = maxY - minY || 1;

  const maxLength = Math.max(...scenarios.map((s) => s.data.length));
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const x = (i) => padding + (i / (maxLength - 1)) * plotW;
  const y = (v) => padding + (1 - (v - minY) / range) * plotH;

  const path = (arr) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%" }}>
      {scenarios.map((s, idx) => (
        <path
          key={idx}
          d={path(s.data)}
          fill="none"
          stroke={s.color}
          strokeWidth="3"
        />
      ))}
    </svg>
  );
}

export default function App() {
  const API_BASE = useMemo(
    () => "https://capitalsense.onrender.com",
    []
  );

  const [backendStatus, setBackendStatus] = useState("checking");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ---------- AUTO CHECK BACKEND ON LOAD ---------- */
  useEffect(() => {
    checkBackend();
  }, []);

  const checkBackend = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setBackendStatus(data.status === "ok" ? "ok" : "down");
    } catch {
      setBackendStatus("down");
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash_on_hand: 100000,
          monthly_revenue: 20000,
          monthly_fixed_costs: 15000,
          monthly_variable_costs: 5000,
          team_size: 5,
          avg_fully_loaded_cost_per_employee: 3000,
          revenue_growth_rate_mom: 0.05,
          planned_hires: 0,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      alert("Error running analysis");
    }
    setLoading(false);
  };

  /* ---------- PREPARE MULTI-SCENARIO GRAPH ---------- */
  let scenariosForGraph = [];
  if (result?.scenarios) {
    scenariosForGraph = result.scenarios.map((s, idx) => ({
      name: s.name,
      data: s.cash_by_month,
      color:
        idx === 0
          ? "#ef4444"
          : idx === 1
          ? "#3b82f6"
          : "#22c55e",
    }));
  }

  /* ---------- GENERATE CONCLUSION ---------- */
  let conclusion = "";
  if (result?.metrics?.risk_level) {
    const risk = result.metrics.risk_level;
    if (risk === "HIGH") {
      conclusion =
        "⚠️ High Risk: Your runway is short. Immediate cost reduction or funding is recommended.";
    } else if (risk === "MEDIUM") {
      conclusion =
        "⚡ Moderate Risk: Monitor burn carefully. Improve revenue growth or reduce expenses.";
    } else {
      conclusion =
        "✅ Low Risk: Business is stable. Continue growth strategy and monitor scaling carefully.";
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 40,
        background:
          "linear-gradient(135deg, #1e293b, #0f172a)",
        color: "white",
        fontFamily: "system-ui",
      }}
    >
      {/* TITLE */}
      <h1
        style={{
          fontSize: 48,
          fontWeight: "900",
          marginBottom: 20,
        }}
      >
        CapitalSense – Cash Runway & Risk Simulation
      </h1>

      {/* BACKEND STATUS */}
      <div style={{ marginBottom: 20 }}>
        <span
          style={{
            padding: "8px 14px",
            borderRadius: 20,
            background:
              backendStatus === "ok"
                ? "#16a34a"
                : backendStatus === "checking"
                ? "#f59e0b"
                : "#dc2626",
          }}
        >
          Backend: {backendStatus}
        </span>
      </div>

      {/* RUN BUTTON */}
      <button
        onClick={runAnalysis}
        style={{
          padding: "12px 20px",
          fontSize: 18,
          borderRadius: 10,
          background: "#3b82f6",
          border: "none",
          cursor: "pointer",
        }}
      >
        {loading ? "Running..." : "Run Analysis"}
      </button>

      {/* GRAPH */}
      {scenariosForGraph.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <LineChart scenarios={scenariosForGraph} />
        </div>
      )}

      {/* CONCLUSION */}
      {conclusion && (
        <div
          style={{
            marginTop: 30,
            padding: 20,
            borderRadius: 10,
            background: "#111827",
            fontSize: 18,
          }}
        >
          <strong>Conclusion:</strong>
          <div style={{ marginTop: 10 }}>{conclusion}</div>
        </div>
      )}
    </div>
  );
}