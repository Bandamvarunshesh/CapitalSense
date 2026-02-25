import { useMemo, useState } from "react";

export default function App() {
  const API_BASE = useMemo(() => {
    return (import.meta.env.VITE_API_BASE || "https://capitalsense.onrender.com").replace(/\/$/, "");
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

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "auto" }}>
      <h1>CapitalSense</h1>

      <div style={{ marginBottom: 20 }}>
        <button onClick={checkBackend}>
          {loadingHealth ? "Checking..." : "Check Backend"}
        </button>
        <span style={{ marginLeft: 10 }}>
          Status: {backendStatus}
        </span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {Object.keys(inputs).map((key) => (
          <div key={key}>
            <label>{key}</label>
            <input
              type="number"
              value={inputs[key]}
              onChange={onChange(key)}
              style={{ width: "100%", padding: 8 }}
            />
          </div>
        ))}

        <div>
          <label>Projection Months</label>
          <input
            type="number"
            value={projectionMonths}
            onChange={(e) => setProjectionMonths(Number(e.target.value))}
          />
        </div>

        <div>
          <label>Monte Carlo Runs</label>
          <input
            type="number"
            value={monteCarloRuns}
            onChange={(e) => setMonteCarloRuns(Number(e.target.value))}
          />
        </div>

        <button onClick={runAnalysis}>
          {loadingAnalysis ? "Running..." : "Run Analysis"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 20, color: "red" }}>
          {error}
        </div>
      )}

      {result && (
        <pre style={{ marginTop: 20 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}