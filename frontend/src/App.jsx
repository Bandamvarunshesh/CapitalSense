import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const API_BASE = "http://127.0.0.1:8000";

// ===== helpers =====
const fmtMoney = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const fmtNum = (n, digits = 2) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return Number(n).toFixed(digits);
};

// Compact Y-axis formatter: 1K / 1M / 1B (clean)
const fmtCompact = (v) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(v) || 0);

export default function App() {
  const [status, setStatus] = useState("unknown");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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

  const [projectionHorizonMonths, setProjectionHorizonMonths] = useState("18");
  const [monteCarloRuns, setMonteCarloRuns] = useState("5000");

  const onChangeField = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const payload = useMemo(() => {
    const toFloat = (v) => Number(v);
    const toInt = (v) => parseInt(v, 10);
    return {
      cash_on_hand: toFloat(inputs.cash_on_hand),
      monthly_revenue: toFloat(inputs.monthly_revenue),
      monthly_fixed_costs: toFloat(inputs.monthly_fixed_costs),
      monthly_variable_costs: toFloat(inputs.monthly_variable_costs),
      team_size: toInt(inputs.team_size),
      avg_fully_loaded_cost_per_employee: toFloat(
        inputs.avg_fully_loaded_cost_per_employee
      ),
      revenue_growth_rate_mom: toFloat(inputs.revenue_growth_rate_mom),
      planned_hires: toInt(inputs.planned_hires),
    };
  }, [inputs]);

  async function checkBackend() {
    try {
      const r = await fetch(`${API_BASE}/health`);
      const j = await r.json();
      setStatus(j.status ?? "ok");
    } catch {
      setStatus("down");
    }
  }

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const url = `${API_BASE}/analyze?projection_horizon_months=${projectionHorizonMonths}&monte_carlo_runs=${monteCarloRuns}`;

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t}`);
      }

      const j = await r.json();
      setResult(j);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkBackend();
  }, []);

  // ===== chart data =====
  const chartData = useMemo(() => {
    const scenarios = result?.scenarios ?? [];
    if (!Array.isArray(scenarios) || scenarios.length === 0) return [];

    const maxLen = Math.max(
      ...scenarios.map((s) => (Array.isArray(s.cash_by_month) ? s.cash_by_month.length : 0))
    );

    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      const row = { month: i };
      for (const s of scenarios) {
        const key = (s?.name || "Scenario").toString();
        const arr = Array.isArray(s?.cash_by_month) ? s.cash_by_month : [];
        row[key] = arr[i] ?? null;
      }
      rows.push(row);
    }
    return rows;
  }, [result]);

  const scenarioNames = useMemo(() => {
    const scenarios = result?.scenarios ?? [];
    return (Array.isArray(scenarios) ? scenarios : [])
      .map((s) => (s?.name || "").toString())
      .filter(Boolean);
  }, [result]);

  const metrics = result?.metrics;

  const styles = {
    page: {
      minHeight: "100vh",
      width: "100vw",
      overflowX: "hidden",
      background:
        "linear-gradient(-45deg, #0f172a, #1e293b, #0b1020, #1e1b4b)",
      backgroundSize: "400% 400%",
      animation: "gradientMove 12s ease infinite",
      color: "#e9eefc",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
      padding: 20,
      boxSizing: "border-box",
      position: "relative",
    },
    container: {
      width: "100%",
      maxWidth: 1200,
      margin: "0 auto",
      animation: "fadeIn 0.8s ease forwards",
      position: "relative",
      zIndex: 1,
    },
    title: {
      fontSize: 48,
      fontWeight: 900,
      margin: 0,
      letterSpacing: "-0.5px",
      background:
        "linear-gradient(90deg, #60a5fa, #ec4899, #22c55e, #60a5fa)",
      backgroundSize: "300%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: "textGlow 6s linear infinite",
    },
    subtitle: {
      opacity: 0.9,
      marginTop: 8,
      marginBottom: 18,
      fontSize: 14,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1.05fr 1.25fr",
      gap: 16,
      alignItems: "start",
    },
    card: {
      background: "rgba(255,255,255,0.06)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 16,
      padding: 16,
      transition: "transform 0.2s ease, border-color 0.2s ease",
    },
    cardTitle: {
      margin: 0,
      fontSize: 14,
      opacity: 0.9,
      fontWeight: 800,
      letterSpacing: "0.2px",
    },
    row: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginTop: 12,
    },
    field: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    label: { fontSize: 12, opacity: 0.85, fontWeight: 700 },
    input: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(10, 15, 30, 0.35)",
      color: "#e9eefc",
      outline: "none",
      fontSize: 14,
    },
    actions: {
      display: "flex",
      gap: 12,
      alignItems: "center",
      marginTop: 14,
      flexWrap: "wrap",
    },
    buttonPrimary: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      fontWeight: 900,
      background: "linear-gradient(90deg, #3b82f6, #ec4899)",
      color: "#0b1020",
      transition: "transform 0.15s ease",
    },
    buttonSecondary: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.18)",
      cursor: "pointer",
      fontWeight: 900,
      background: "rgba(255,255,255,0.06)",
      color: "#e9eefc",
    },
    badge: (ok) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontWeight: 800,
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.06)",
      color: ok ? "#86efac" : "#fca5a5",
    }),
    dot: (ok) => ({
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: ok ? "#22c55e" : "#ef4444",
      boxShadow: ok ? "0 0 10px rgba(34,197,94,.5)" : "0 0 10px rgba(239,68,68,.5)",
    }),
    metricsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 12,
      marginTop: 12,
    },
    metricCard: {
      padding: 12,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.05)",
    },
    metricLabel: { fontSize: 12, opacity: 0.85, fontWeight: 800 },
    metricValue: { fontSize: 18, fontWeight: 900, marginTop: 6 },
    error: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.25)",
      color: "#fecaca",
      fontWeight: 700,
      whiteSpace: "pre-wrap",
    },
    chartWrap: {
      marginTop: 14,
      height: 380,
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
      overflow: "hidden",
    },
  };

  const statusOk = status === "ok" || status === "unknown";

  return (
    <div style={styles.page}>
      {/* floating glow blobs */}
      <div
        style={{
          position: "absolute",
          top: -150,
          left: -150,
          width: 420,
          height: 420,
          background: "#ec4899",
          filter: "blur(120px)",
          opacity: 0.22,
          borderRadius: "50%",
          animation: "float 10s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -160,
          right: -160,
          width: 460,
          height: 460,
          background: "#3b82f6",
          filter: "blur(140px)",
          opacity: 0.22,
          borderRadius: "50%",
          animation: "float 12s ease-in-out infinite",
        }}
      />

      <div style={styles.container}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={styles.title}>CapitalSense</h1>
            <p style={styles.subtitle}>
              Financial decision engine for runway modeling, hiring strategy and risk analysis
            </p>
          </div>

          <div style={styles.badge(statusOk)}>
            <span style={styles.dot(statusOk)} />
            API: {status}
          </div>
        </div>

        <div style={styles.grid}>
          {/* LEFT: INPUTS */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <p style={styles.cardTitle}>Inputs</p>
              <span style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>
                Enter values manually, then run analysis.
              </span>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <div style={styles.label}>Cash on hand</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="e.g., 500000"
                  value={inputs.cash_on_hand}
                  onChange={(e) => onChangeField("cash_on_hand", e.target.value)}
                />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Monthly revenue</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="e.g., 100000"
                  value={inputs.monthly_revenue}
                  onChange={(e) => onChangeField("monthly_revenue", e.target.value)}
                />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Monthly fixed costs</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="e.g., 60000"
                  value={inputs.monthly_fixed_costs}
                  onChange={(e) => onChangeField("monthly_fixed_costs", e.target.value)}
                />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Monthly variable costs</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="e.g., 25000"
                  value={inputs.monthly_variable_costs}
                  onChange={(e) => onChangeField("monthly_variable_costs", e.target.value)}
                />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Team size</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="e.g., 6"
                  value={inputs.team_size}
                  onChange={(e) => onChangeField("team_size", e.target.value)}
                />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Avg fully-loaded cost / employee</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="e.g., 7000"
                  value={inputs.avg_fully_loaded_cost_per_employee}
                  onChange={(e) =>
                    onChangeField("avg_fully_loaded_cost_per_employee", e.target.value)
                  }
                />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Revenue growth rate (MoM)</div>
                <input
                  style={styles.input}
                  inputMode="decimal"
                  placeholder="e.g., 0.04"
                  value={inputs.revenue_growth_rate_mom}
                  onChange={(e) => onChangeField("revenue_growth_rate_mom", e.target.value)}
                />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Planned hires</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="e.g., 1"
                  value={inputs.planned_hires}
                  onChange={(e) => onChangeField("planned_hires", e.target.value)}
                />
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <div style={styles.label}>Projection horizon (months)</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="18"
                  value={projectionHorizonMonths}
                  onChange={(e) => setProjectionHorizonMonths(e.target.value)}
                />
              </div>

              <div style={styles.field}>
                <div style={styles.label}>Monte Carlo runs</div>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  placeholder="5000"
                  value={monteCarloRuns}
                  onChange={(e) => setMonteCarloRuns(e.target.value)}
                />
              </div>
            </div>

            <div style={styles.actions}>
              <button style={styles.buttonSecondary} onClick={checkBackend}>
                Check Backend
              </button>
              <button
                style={styles.buttonPrimary}
                onClick={runAnalysis}
                disabled={loading}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {loading ? "Running..." : "Run Analysis"}
              </button>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
          </div>

          {/* RIGHT: RESULTS */}
          <div style={styles.card}>
            <p style={styles.cardTitle}>Results</p>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>
                Executive summary
              </div>
              <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.45 }}>
                {result?.executive_summary ? result.executive_summary : "Run analysis to see summary."}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>
                Key metrics
              </div>

              <div style={styles.metricsGrid}>
                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Monthly cost</div>
                  <div style={styles.metricValue}>
                    {metrics ? fmtMoney(metrics.monthly_cost) : "-"}
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Net burn</div>
                  <div style={styles.metricValue}>
                    {metrics ? fmtMoney(metrics.net_burn) : "-"}
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Runway</div>
                  <div style={styles.metricValue}>
                    {metrics ? metrics.runway_label : "-"}
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Risk level</div>
                  <div style={styles.metricValue}>
                    {metrics ? metrics.risk_level : "-"}
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>P(cash negative within 6 months)</div>
                  <div style={styles.metricValue}>
                    {metrics ? fmtNum(metrics.p_cash_negative_within_6_months, 2) : "-"}
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>P10 / P50 / P90 runway</div>
                  <div style={styles.metricValue}>
                    {metrics
                      ? `${fmtMoney(metrics.runway_p10_months)} / ${fmtMoney(
                          metrics.runway_p50_months
                        )} / ${fmtMoney(metrics.runway_p90_months)}`
                      : "-"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>
                Scenario Projection (Cash by month)
              </div>

              <div style={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 18, right: 18, left: 10, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.10)" />
                    <XAxis
                      dataKey="month"
                      stroke="rgba(255,255,255,0.7)"
                      tick={{ fill: "rgba(255,255,255,0.8)", fontSize: 12 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
                      label={{
                        value: "Month",
                        position: "insideBottomRight",
                        offset: -6,
                        fill: "rgba(255,255,255,0.7)",
                      }}
                    />

                    {/* ✅ Y axis change: compact formatting (K/M/B) */}
                    <YAxis
                      stroke="rgba(255,255,255,0.7)"
                      tick={{ fill: "rgba(255,255,255,0.8)", fontSize: 12 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
                      tickFormatter={fmtCompact}
                      width={52}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "rgba(10,15,30,0.95)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        color: "#e9eefc",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.85)", fontWeight: 800 }}
                      formatter={(value, name) => [fmtMoney(value), name]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />

                    <Legend
                      wrapperStyle={{ color: "rgba(255,255,255,0.85)" }}
                    />

                    {/* Different colors for lines */}
                    {scenarioNames.map((name, idx) => {
                      const colors = ["#22c55e", "#60a5fa", "#ec4899", "#f59e0b"];
                      return (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={3}
                          dot={false}
                          isAnimationActive
                          animationDuration={900}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>
        {`
          @keyframes gradientMove {
            0% {background-position: 0% 50%}
            50% {background-position: 100% 50%}
            100% {background-position: 0% 50%}
          }

          @keyframes fadeIn {
            from {opacity: 0; transform: translateY(10px);}
            to {opacity: 1; transform: translateY(0);}
          }

          @keyframes textGlow {
            0% {background-position: 0%;}
            100% {background-position: 300%;}
          }

          @keyframes float {
            0% {transform: translateY(0px);}
            50% {transform: translateY(30px);}
            100% {transform: translateY(0px);}
          }

          /* small responsive tweak */
          @media (max-width: 980px) {
            .grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>

      {/* tiny helper to make responsive grid work with inline styles */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              const apply = () => {
                const el = document.querySelector('[data-grid]');
                if(!el) return;
                if(window.innerWidth < 980) el.style.gridTemplateColumns = '1fr';
                else el.style.gridTemplateColumns = '1.05fr 1.25fr';
              };
              window.addEventListener('resize', apply);
              setTimeout(apply, 0);
            })();
          `,
        }}
      />
    </div>
  );
}