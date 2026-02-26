import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const API_BASE = useMemo(() => {
    return (import.meta.env.VITE_API_BASE || "https://capitalsense.onrender.com").replace(
      /\/$/,
      ""
    );
  }, []);

  // --- Input schema (labels + rules) ---
  const FIELDS = useMemo(
    () => [
      { key: "cash_on_hand", label: "Cash On Hand", allowNegative: false },
      { key: "monthly_revenue", label: "Monthly Revenue", allowNegative: false },
      { key: "monthly_fixed_costs", label: "Monthly Fixed Costs", allowNegative: false },
      { key: "monthly_variable_costs", label: "Monthly Variable Costs", allowNegative: false },
      { key: "team_size", label: "Team Size", allowNegative: false, integerOnly: true },
      {
        key: "avg_fully_loaded_cost_per_employee",
        label: "Avg Fully Loaded Cost Per Employee",
        allowNegative: false,
      },
      {
        key: "revenue_growth_rate_mom",
        label: "Revenue Growth Rate (MoM)",
        allowNegative: true, // this can be negative
      },
      { key: "planned_hires", label: "Planned Hires", allowNegative: false, integerOnly: true },
    ],
    []
  );

  // Store inputs as STRINGS so user can backspace to empty
  const [inputs, setInputs] = useState(() => {
    const obj = {};
    FIELDS.forEach((f) => (obj[f.key] = "0"));
    return obj;
  });

  const [projectionMonths, setProjectionMonths] = useState("18"); // string for backspace behavior
  const [monteCarloRuns, setMonteCarloRuns] = useState("5000");

  // Backend status: "checking" | "ok" | "warming" | "down"
  const [backendStatus, setBackendStatus] = useState("checking");
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // ---------- Numeric input helpers ----------
  const numericRegex = (allowNegative, integerOnly) => {
    if (integerOnly) return allowNegative ? /^-?\d*$/ : /^\d*$/;
    return allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
  };

  const cleanNumeric = (raw, allowNegative, integerOnly) => {
    // allow empty
    if (raw === "") return "";

    // If user typed just "-" or ".", keep it temporarily only if allowed
    if (allowNegative && raw === "-") return "-";
    if (!integerOnly && raw === ".") return "0.";
    if (allowNegative && !integerOnly && raw === "-.") return "-0.";

    // Validate by regex
    if (!numericRegex(allowNegative, integerOnly).test(raw)) return null;

    // prevent leading zeros like 00012 (keep "0", "0.", "0.5")
    // BUT don't fight too hard; just normalize common bad patterns:
    if (!integerOnly) {
      // allow "00.5" -> "0.5"
      if (/^-?0{2,}\d/.test(raw)) {
        raw = raw.replace(/^(-?)0+/, "$10");
      }
    } else {
      if (/^-?0{2,}\d/.test(raw)) {
        raw = raw.replace(/^(-?)0+/, "$10");
      }
    }

    return raw;
  };

  const onChangeField = (field) => (e) => {
    const raw = e.target.value;

    const next = cleanNumeric(raw, field.allowNegative, field.integerOnly);
    if (next === null) return; // reject invalid

    setInputs((prev) => ({ ...prev, [field.key]: next }));
  };

  const onFocusSelectAll = (e) => {
    // Select all so user can type over quickly
    requestAnimationFrame(() => e.target.select());
  };

  const preventBadKeys = (allowNegative, integerOnly) => (e) => {
    // Block scientific notation and plus
    if (["e", "E", "+"].includes(e.key)) e.preventDefault();
    if (!allowNegative && e.key === "-") e.preventDefault();
    if (integerOnly && e.key === ".") e.preventDefault();
  };

  const preventBadPaste = (allowNegative, integerOnly) => (e) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted === "") return;
    if (!numericRegex(allowNegative, integerOnly).test(pasted.trim())) {
      e.preventDefault();
    }
  };

  const normalizeOnBlur = (field) => (e) => {
    const v = e.target.value;

    // empty -> set "0" back only if you want. You asked: backspace should allow typing.
    // We'll keep empty while editing, but on blur we convert empty/"-"/"." to "0".
    if (v === "" || v === "-" || v === "." || v === "-." || v === "0.") {
      setInputs((prev) => ({ ...prev, [field.key]: "0" }));
      return;
    }

    // trim trailing dot "12." -> "12"
    if (!field.integerOnly && v.endsWith(".")) {
      setInputs((prev) => ({ ...prev, [field.key]: v.slice(0, -1) }));
    }
  };

  const normalizeMetaOnBlur = (setter) => (e) => {
    const v = e.target.value;
    if (v === "" || v === "-" || v === "." || v === "-.") {
      setter("0");
      return;
    }
    if (v.endsWith(".")) setter(v.slice(0, -1));
  };

  // Convert string inputs -> numbers for API
  const payloadForApi = () => {
    const obj = {};
    for (const f of FIELDS) {
      const v = inputs[f.key];
      const n = Number(v === "" || v === "-" ? 0 : v);
      obj[f.key] = Number.isFinite(n) ? n : 0;
    }
    return obj;
  };

  // ---------- Backend check (auto on page load + retries) ----------
  const healthAbortRef = useRef(null);

  const checkBackend = async ({ silent = false } = {}) => {
    if (!silent) setLoadingHealth(true);
    setError("");

    // cancel previous
    if (healthAbortRef.current) {
      try {
        healthAbortRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    healthAbortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      const data = await res.json();
      if (data?.status === "ok") {
        setBackendStatus("ok");
      } else {
        // treat non-ok as warming
        setBackendStatus("warming");
      }
    } catch (err) {
      // don't immediately scare user; mark warming first
      setBackendStatus((prev) => (prev === "ok" ? "ok" : "warming"));
    } finally {
      if (!silent) setLoadingHealth(false);
    }
  };

  useEffect(() => {
    // On first load: show "checking" then do quick retries so it becomes green without user clicking.
    let cancelled = false;

    const run = async () => {
      setBackendStatus("checking");
      await checkBackend({ silent: true });

      // Retry a few times if not ok (Render can sleep)
      const retries = [800, 1500, 2500, 4000]; // ms
      for (const wait of retries) {
        if (cancelled) return;
        if (backendStatus === "ok") return;
        await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;
        await checkBackend({ silent: true });
      }

      // If still not ok after retries, mark down (but no scary flash at start)
      if (!cancelled) {
        setBackendStatus((prev) => (prev === "ok" ? "ok" : "down"));
      }
    };

    run();

    return () => {
      cancelled = true;
      if (healthAbortRef.current) {
        try {
          healthAbortRef.current.abort();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE]);

  // ---------- Run analysis ----------
  const runAnalysis = async () => {
    setLoadingAnalysis(true);
    setError("");
    setResult(null);

    try {
      const proj = Number(projectionMonths || 0);
      const runs = Number(monteCarloRuns || 0);

      const res = await fetch(
        `${API_BASE}/analyze?projection_horizon_months=${proj}&monte_carlo_runs=${runs}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadForApi()),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail ? JSON.stringify(data.detail) : JSON.stringify(data));

      setResult(data);
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // ---------- Extract chart data (3 scenarios on one graph) ----------
  const chartData = useMemo(() => {
    if (!result?.scenarios || !Array.isArray(result.scenarios)) return null;

    // Expect scenarios like [{name, cash_by_month:[...]}]
    const scenarios = result.scenarios
      .filter((s) => Array.isArray(s.cash_by_month))
      .map((s) => ({
        name: s.name || "Scenario",
        values: s.cash_by_month.map((x) => Number(x)),
      }));

    if (scenarios.length === 0) return null;

    const maxLen = Math.max(...scenarios.map((s) => s.values.length));
    const months = Array.from({ length: maxLen }, (_, i) => i);

    // find y bounds
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of scenarios) {
      for (const v of s.values) {
        if (Number.isFinite(v)) {
          minY = Math.min(minY, v);
          maxY = Math.max(maxY, v);
        }
      }
    }

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null;

    // Expand range a bit for nicer view
    const pad = (maxY - minY) * 0.08 || 1;
    minY -= pad;
    maxY += pad;

    return { months, scenarios, minY, maxY };
  }, [result]);

  // ---------- Conclusion ----------
  const conclusion = useMemo(() => {
    if (!result?.metrics) return null;

    const risk = result.metrics.risk_level || "Unknown";
    const runwayLabel = result.metrics.runway_label || "—";
    const pNeg6 = result.metrics.p_cash_negative_within_6_months;

    const actions = [];
    if (risk === "HIGH") {
      actions.push("Cut burn immediately (reduce fixed costs), slow hiring, and increase revenue focus.");
      actions.push("Build a 90-day cash plan and raise capital / credit line early.");
    } else if (risk === "MEDIUM") {
      actions.push("Hold hiring, reduce non-essential spend, and track cash weekly.");
      actions.push("Improve revenue predictability (pipeline, pricing, retention).");
    } else if (risk === "LOW") {
      actions.push("You have healthier runway — invest carefully in growth, but keep burn controlled.");
      actions.push("Stress-test costs/revenue changes monthly and keep a cash buffer.");
    } else {
      actions.push("Run analysis again with realistic inputs and verify backend is stable.");
    }

    return {
      title: `Conclusion: Risk = ${risk}`,
      body: `Runway: ${runwayLabel}${
        typeof pNeg6 === "number"
          ? ` • Probability of cash going negative within 6 months: ${(pNeg6 * 100).toFixed(1)}%`
          : ""
      }`,
      actions,
    };
  }, [result]);

  // ---------- UI helpers ----------
  const resetAll = () => {
    const obj = {};
    FIELDS.forEach((f) => (obj[f.key] = "0"));
    setInputs(obj);
    setProjectionMonths("18");
    setMonteCarloRuns("5000");
    setResult(null);
    setError("");
  };

  const statusBadge = () => {
    const base = {
      padding: "10px 14px",
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 700,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      border: "1px solid rgba(255,255,255,0.14)",
      backdropFilter: "blur(8px)",
    };

    if (backendStatus === "ok")
      return (
        <span style={{ ...base, background: "rgba(34,197,94,0.18)", color: "#b9ffcf" }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "#22c55e" }} />
          Backend: OK
        </span>
      );

    if (backendStatus === "checking")
      return (
        <span style={{ ...base, background: "rgba(59,130,246,0.14)", color: "#cfe6ff" }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "#3b82f6" }} />
          Checking backend…
        </span>
      );

    if (backendStatus === "warming")
      return (
        <span style={{ ...base, background: "rgba(245,158,11,0.16)", color: "#ffe3b2" }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "#f59e0b" }} />
          Backend waking up…
        </span>
      );

    return (
      <span style={{ ...base, background: "rgba(239,68,68,0.16)", color: "#ffd1d1" }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "#ef4444" }} />
        Backend: Down
      </span>
    );
  };

  // ---------- SVG chart ----------
  const Chart = ({ data }) => {
    const W = 820;
    const H = 320;
    const P = 40;

    const xScale = (i, n) => {
      if (n <= 1) return P;
      return P + (i * (W - 2 * P)) / (n - 1);
    };

    const yScale = (v, minY, maxY) => {
      if (maxY === minY) return H / 2;
      const t = (v - minY) / (maxY - minY);
      return H - P - t * (H - 2 * P);
    };

    const colors = ["#60a5fa", "#34d399", "#f87171"]; // blue, green, red

    const n = data.months.length;

    const paths = data.scenarios.slice(0, 3).map((s, idx) => {
      const pts = s.values
        .slice(0, n)
        .map((v, i) => `${xScale(i, n)},${yScale(v, data.minY, data.maxY)}`)
        .join(" ");

      return { name: s.name, pts, color: colors[idx % colors.length] };
    });

    // y grid lines
    const gridLines = 5;
    const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
      const t = i / gridLines;
      const v = data.maxY - t * (data.maxY - data.minY);
      const y = P + t * (H - 2 * P);
      return { v, y };
    });

    return (
      <div style={styles.card}>
        <div style={styles.cardHeaderRow}>
          <div>
            <div style={styles.cardTitle}>Cash Runway Graph (3 Scenarios)</div>
            <div style={styles.cardSub}>
              Shows Conservative / Base / Optimistic cash-by-month on the same chart.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {paths.map((p) => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: p.color }} />
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
            {/* Grid */}
            {yTicks.map((t, i) => (
              <g key={i}>
                <line
                  x1={P}
                  y1={t.y}
                  x2={W - P}
                  y2={t.y}
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="1"
                />
                <text
                  x={6}
                  y={t.y + 4}
                  fill="rgba(255,255,255,0.55)"
                  fontSize="11"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {formatCompact(t.v)}
                </text>
              </g>
            ))}

            {/* Zero line (if within range) */}
            {data.minY < 0 && data.maxY > 0 && (
              <line
                x1={P}
                y1={yScale(0, data.minY, data.maxY)}
                x2={W - P}
                y2={yScale(0, data.minY, data.maxY)}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="6 6"
              />
            )}

            {/* Lines */}
            {paths.map((p) => (
              <polyline
                key={p.name}
                points={p.pts}
                fill="none"
                stroke={p.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {/* X axis labels (sparse) */}
            {data.months.map((m, i) => {
              if (n > 18 && i % 3 !== 0) return null;
              const x = xScale(i, n);
              return (
                <text
                  key={m}
                  x={x}
                  y={H - 10}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.45)"
                  fontSize="10"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {m}
                </text>
              );
            })}
          </svg>
        </div>

        <div style={{ marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
          X-axis = months • Y-axis = cash balance
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.brandPill}>CapitalSense</div>
            <h1 style={styles.title}>Run a Cash Runway + Risk Simulation</h1>
            <div style={styles.subtitle}>
              Enter inputs, the app auto-checks backend health, then run analysis to generate metrics,
              a 3-scenario runway graph, and next steps.
            </div>
          </div>

          <div style={styles.headerRight}>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {statusBadge()}
              <button
                style={styles.primaryBtn}
                onClick={() => checkBackend()}
                disabled={loadingHealth}
              >
                {loadingHealth ? "Checking…" : "Check Backend"}
              </button>
            </div>
            <div style={styles.apiText}>API Base: {API_BASE}</div>
          </div>
        </div>

        {/* Main layout */}
        <div style={styles.grid}>
          {/* Inputs */}
          <div style={styles.card}>
            <div style={styles.cardHeaderRow}>
              <div>
                <div style={styles.cardTitle}>Inputs</div>
                <div style={styles.cardSub}>All values start from 0. Click a field to type.</div>
              </div>
              <button style={styles.ghostBtn} onClick={resetAll}>
                Reset
              </button>
            </div>

            <div style={styles.inputsGrid}>
              {FIELDS.map((f) => (
                <div key={f.key} style={styles.field}>
                  <label style={styles.label}>{f.label}</label>
                  <input
                    style={styles.input}
                    type="text"
                    inputMode={f.integerOnly ? "numeric" : "decimal"}
                    value={inputs[f.key]}
                    placeholder="0"
                    onFocus={onFocusSelectAll}
                    onChange={onChangeField(f)}
                    onKeyDown={preventBadKeys(f.allowNegative, f.integerOnly)}
                    onPaste={preventBadPaste(f.allowNegative, f.integerOnly)}
                    onBlur={normalizeOnBlur(f)}
                  />
                </div>
              ))}

              <div style={styles.field}>
                <label style={styles.label}>Projection Months</label>
                <input
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  value={projectionMonths}
                  placeholder="18"
                  onFocus={onFocusSelectAll}
                  onChange={(e) => {
                    const next = cleanNumeric(e.target.value, false, true);
                    if (next === null) return;
                    setProjectionMonths(next);
                  }}
                  onKeyDown={preventBadKeys(false, true)}
                  onPaste={preventBadPaste(false, true)}
                  onBlur={normalizeMetaOnBlur(setProjectionMonths)}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Monte Carlo Runs</label>
                <input
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  value={monteCarloRuns}
                  placeholder="5000"
                  onFocus={onFocusSelectAll}
                  onChange={(e) => {
                    const next = cleanNumeric(e.target.value, false, true);
                    if (next === null) return;
                    setMonteCarloRuns(next);
                  }}
                  onKeyDown={preventBadKeys(false, true)}
                  onPaste={preventBadPaste(false, true)}
                  onBlur={normalizeMetaOnBlur(setMonteCarloRuns)}
                />
              </div>
            </div>

            <button style={styles.runBtn} onClick={runAnalysis} disabled={loadingAnalysis}>
              {loadingAnalysis ? "Running…" : "Run Analysis"}
            </button>

            {error && <div style={styles.errorBox}>{error}</div>}
          </div>

          {/* Results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Summary cards */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Results Summary</div>
              <div style={styles.cardSub}>Shown after you run analysis.</div>

              <div style={styles.metricsRow}>
                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Risk Level</div>
                  <div style={styles.metricValue}>
                    {result?.metrics?.risk_level ? result.metrics.risk_level : "—"}
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Runway</div>
                  <div style={styles.metricValue}>
                    {result?.metrics?.runway_label ? result.metrics.runway_label : "—"}
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Net Burn / Month</div>
                  <div style={styles.metricValue}>
                    {typeof result?.metrics?.net_burn === "number"
                      ? formatCompact(result.metrics.net_burn)
                      : "—"}
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricLabel}>Monthly Cost</div>
                  <div style={styles.metricValue}>
                    {typeof result?.metrics?.monthly_cost === "number"
                      ? formatCompact(result.metrics.monthly_cost)
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            {chartData ? (
              <Chart data={chartData} />
            ) : (
              <div style={styles.card}>
                <div style={styles.cardTitle}>Cash Runway Graph</div>
                <div style={styles.cardSub}>Run analysis to generate the 3-scenario chart.</div>
              </div>
            )}

            {/* Conclusion */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Conclusion</div>
              <div style={styles.cardSub}>
                What the chart means + what the customer should do next.
              </div>

              {conclusion ? (
                <>
                  <div style={styles.conclusionTitle}>{conclusion.title}</div>
                  <div style={styles.conclusionBody}>{conclusion.body}</div>

                  <div style={{ marginTop: 10, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
                    Recommended actions:
                  </div>
                  <ul style={styles.conclusionList}>
                    {conclusion.actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <div style={{ color: "rgba(255,255,255,0.65)" }}>
                  Run analysis to generate a conclusion.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          Frontend: Cloudflare Pages • Backend: Render • API: {API_BASE}
        </div>
      </div>
    </div>
  );
}

// ---------- helpers ----------
function formatCompact(n) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

// ---------- styles ----------
const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background:
      "radial-gradient(1200px 700px at 20% 10%, rgba(124,58,237,0.35), transparent 55%), radial-gradient(900px 600px at 90% 20%, rgba(34,197,94,0.18), transparent 55%), linear-gradient(180deg, #0b1020 0%, #060814 100%)",
    color: "white",
    position: "relative",
    overflow: "hidden",
  },
  bgGlow1: {
    position: "absolute",
    inset: -200,
    background:
      "radial-gradient(600px 350px at 30% 60%, rgba(56,189,248,0.14), transparent 60%)",
    pointerEvents: "none",
  },
  bgGlow2: {
    position: "absolute",
    inset: -200,
    background:
      "radial-gradient(650px 400px at 70% 70%, rgba(244,63,94,0.10), transparent 60%)",
    pointerEvents: "none",
  },
  container: {
    position: "relative",
    maxWidth: 1320,
    margin: "0 auto",
    padding: "28px 18px 26px",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 18,
    alignItems: "start",
    marginBottom: 16,
  },
  brandPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.90)",
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 10,
    backdropFilter: "blur(8px)",
  },
  title: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    marginTop: 10,
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    maxWidth: 820,
  },
  headerRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 10,
  },
  apiText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "460px 1fr",
    gap: 16,
    alignItems: "start",
  },
  card: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 20px 70px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: "-0.01em",
  },
  cardSub: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    marginTop: 4,
  },
  inputsGrid: {
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
  label: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
    fontSize: 14,
  },
  runBtn: {
    width: "100%",
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(90deg, rgba(168,85,247,0.95) 0%, rgba(59,130,246,0.95) 50%, rgba(34,197,94,0.95) 100%)",
    color: "#061018",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  primaryBtn: {
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(180deg, rgba(96,165,250,0.95), rgba(59,130,246,0.9))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    minWidth: 150,
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#ffd1d1",
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },
  metricsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginTop: 12,
  },
  metricCard: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.20)",
  },
  metricLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    fontWeight: 700,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 900,
    marginTop: 6,
  },
  conclusionTitle: {
    marginTop: 12,
    fontWeight: 900,
    fontSize: 16,
    color: "rgba(255,255,255,0.95)",
  },
  conclusionBody: {
    marginTop: 6,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 1.4,
  },
  conclusionList: {
    marginTop: 8,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 1.5,
    paddingLeft: 18,
  },
  footer: {
    marginTop: 16,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    textAlign: "center",
  },
};