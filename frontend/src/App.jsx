import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const API_BASE = useMemo(() => {
    return (import.meta.env.VITE_API_BASE || "https://capitalsense.onrender.com").replace(/\/$/, "");
  }, []);

  const FIELDS = useMemo(
    () => [
      { key: "cash_on_hand", label: "Cash On Hand", allowNegative: false },
      { key: "monthly_revenue", label: "Monthly Revenue", allowNegative: false },
      { key: "monthly_fixed_costs", label: "Monthly Fixed Costs", allowNegative: false },
      { key: "monthly_variable_costs", label: "Monthly Variable Costs", allowNegative: false },
      { key: "team_size", label: "Team Size", allowNegative: false, integerOnly: true },
      { key: "avg_fully_loaded_cost_per_employee", label: "Avg Fully Loaded Cost / Employee", allowNegative: false },
      { key: "revenue_growth_rate_mom", label: "Revenue Growth Rate (MoM)", allowNegative: true },
      { key: "planned_hires", label: "Planned Hires", allowNegative: false, integerOnly: true },
    ],
    []
  );

  const [inputs, setInputs] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, "0"])));
  const [projectionMonths, setProjectionMonths] = useState("18");
  const [monteCarloRuns, setMonteCarloRuns] = useState("5000");

  const [backendStatus, setBackendStatus] = useState("checking");
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    checkBackend(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE]);

  const sanitize = (raw, allowNegative, integerOnly) => {
    let s = raw.replace(/[^\d.-]/g, "");
    s = s.replace(/(?!^)-/g, "");
    s = s.replace(/(\..*)\./g, "$1");
    if (!allowNegative) s = s.replace(/-/g, "");
    if (integerOnly) s = s.replace(/\./g, "");
    return s;
  };

  const toNumber = (s) => {
    if (s === "" || s === "-" || s === "." || s === "-.") return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const onFocusSelectAll = (e) => requestAnimationFrame(() => e.target.select());

  const onChangeField = (field) => (e) => {
    const next = sanitize(e.target.value, field.allowNegative, field.integerOnly);
    setInputs((prev) => ({ ...prev, [field.key]: next }));
  };

  const normalizeOnBlur = (key) => (e) => {
    const v = e.target.value;
    if (v === "" || v === "-" || v === "." || v === "-.") {
      setInputs((prev) => ({ ...prev, [key]: "0" }));
      return;
    }
    if (v.endsWith(".")) setInputs((prev) => ({ ...prev, [key]: v.slice(0, -1) }));
  };

  const normalizeMetaOnBlur = (setter) => (e) => {
    const v = e.target.value;
    if (v === "" || v === "-" || v === "." || v === "-.") {
      setter("0");
      return;
    }
    if (v.endsWith(".")) setter(v.slice(0, -1));
  };

  async function checkBackend(silent = false) {
    if (!silent) setLoadingHealth(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      const data = await res.json();
      setBackendStatus(data?.status === "ok" ? "ok" : "down");
    } catch {
      setBackendStatus("down");
    } finally {
      if (!silent) setLoadingHealth(false);
    }
  }

  const buildPayload = () => {
    const payload = {};
    for (const f of FIELDS) payload[f.key] = toNumber(inputs[f.key]);
    payload.team_size = Math.max(0, Math.trunc(payload.team_size));
    payload.planned_hires = Math.max(0, Math.trunc(payload.planned_hires));
    return payload;
  };

  const runAnalysis = async () => {
    setLoadingAnalysis(true);
    setError("");
    setResult(null);

    try {
      const pm = Math.max(1, Math.trunc(toNumber(projectionMonths)));
      const mcr = Math.max(100, Math.trunc(toNumber(monteCarloRuns)));

      const res = await fetch(
        `${API_BASE}/analyze?projection_horizon_months=${pm}&monte_carlo_runs=${mcr}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail ? JSON.stringify(data.detail) : JSON.stringify(data));

      setResult(data);
      setBackendStatus("ok");
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const resetAll = () => {
    setInputs(Object.fromEntries(FIELDS.map((f) => [f.key, "0"])));
    setProjectionMonths("18");
    setMonteCarloRuns("5000");
    setResult(null);
    setError("");
  };

  // ----------- Chart (canvas) -----------
  const canvasRef = useRef(null);

  const cashSeries = useMemo(() => {
    if (!result?.scenarios?.length) return null;

    const scenarios = result.scenarios
      .filter((s) => s && typeof s === "object")
      .slice(0, 3)
      .map((s, idx) => ({
        name: s.name || ["Conservative", "Base", "Optimistic"][idx] || `Scenario ${idx + 1}`,
        values: Array.isArray(s.cash_by_month) ? s.cash_by_month.map((x) => Number(x)) : [],
      }));

    const maxLen = Math.max(...scenarios.map((s) => s.values.length), 0);
    if (!maxLen) return null;

    const months = Array.from({ length: maxLen }, (_, i) => i);
    return { months, scenarios };
  }, [result]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cashSeries) return;

    const parent = canvas.parentElement;
    const width = Math.max(520, parent?.clientWidth || 900);
    const height = 320;

    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    ctx.clearRect(0, 0, width, height);

    const P = { l: 56, r: 18, t: 18, b: 38 };
    const x0 = P.l;
    const x1 = width - P.r;
    const y0 = height - P.b;
    const y1 = P.t;

    const all = cashSeries.scenarios.flatMap((s) => s.values);
    const minY = Math.min(...all, 0);
    const maxY = Math.max(...all, 0);
    const range = maxY - minY || 1;

    const xFor = (i) => x0 + (i * (x1 - x0)) / Math.max(1, cashSeries.months.length - 1);
    const yFor = (v) => y0 - ((v - minY) * (y0 - y1)) / range;

    // grid
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = y1 + (i * (y0 - y1)) / 4;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // axes
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 0 line
    if (minY < 0 && maxY > 0) {
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x0, yFor(0));
      ctx.lineTo(x1, yFor(0));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    const colors = ["#A855F7", "#22C55E", "#60A5FA"];

    cashSeries.scenarios.forEach((s, idx) => {
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 3;
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const x = xFor(i);
        const y = yFor(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // legend
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    cashSeries.scenarios.forEach((s, idx) => {
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(x0 + idx * 150, 8, 12, 12);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(s.name, x0 + idx * 150 + 18, 19);
    });
  }, [cashSeries]);

  // ----------- Conclusion (more detailed) -----------
  const conclusion = useMemo(() => {
    if (!result?.metrics) return null;

    const risk = result.metrics?.risk_level ?? "UNKNOWN";
    const runwayLabel = result.metrics?.runway_label ?? "—";
    const p6 = result.metrics?.p_cash_negative_within_6_months;
    const p10 = result.metrics?.runway_p10_months;
    const p50 = result.metrics?.runway_p50_months;
    const p90 = result.metrics?.runway_p90_months;

    let interpretation = "";
    let recommendations = [];

    if (risk === "HIGH") {
      interpretation =
        "The conservative or base scenario trends suggest cash can turn negative quickly. This indicates burn is too high relative to revenue, and small misses in growth can materially reduce runway.";
      recommendations = [
        "Freeze non-essential hiring and reduce discretionary spend immediately.",
        "Negotiate fixed costs (vendors, cloud spend, offices) to lower burn.",
        "Prioritize short-cycle revenue: collections, renewals, pricing, and upsell.",
        "Raise capital or secure a credit line early (before runway becomes critical).",
      ];
    } else if (risk === "MEDIUM") {
      interpretation =
        "Runway is workable, but downside scenarios still show meaningful risk. The business should stay disciplined because small cost increases or slower growth can push runway down fast.";
      recommendations = [
        "Keep hiring controlled and tie headcount to revenue milestones.",
        "Reduce burn 10–20% by optimizing variable costs and low-ROI spend.",
        "Track runway weekly and rerun scenarios monthly as inputs change.",
        "Improve revenue predictability (pipeline hygiene, retention, collections).",
      ];
    } else {
      interpretation =
        "Your scenarios indicate healthier runway. Even conservative outcomes keep cash relatively stable. This supports planned growth, but you should still monitor burn to avoid sudden runway compression.";
      recommendations = [
        "Scale gradually: hire in stages and measure ROI per hire.",
        "Maintain a cash buffer and set a minimum runway policy (e.g., 9–12 months).",
        "Stress-test scenarios monthly (growth slowdown, cost spikes) to stay prepared.",
        "Keep cost structure flexible to adapt quickly if revenue changes.",
      ];
    }

    const p6Text = typeof p6 === "number" ? `${(p6 * 100).toFixed(1)}%` : "—";
    const runwayText = `Runway label: ${runwayLabel}. Runway distribution (months): P10=${p10 ?? "—"}, P50=${p50 ?? "—"}, P90=${p90 ?? "—"}.`;

    return { risk, interpretation, p6Text, runwayText, recommendations };
  }, [result]);

  // ----------- Styles -----------
  const styles = {
    page: {
      minHeight: "100vh",
      width: "100vw",
      margin: 0,
      padding: "28px 22px",
      boxSizing: "border-box",
      color: "#fff",
      background:
        "radial-gradient(1200px 800px at 10% 10%, rgba(168,85,247,0.26), transparent 60%)," +
        "radial-gradient(1200px 800px at 90% 30%, rgba(34,197,94,0.20), transparent 55%)," +
        "linear-gradient(180deg, #070A12 0%, #0B1020 55%, #070A12 100%)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    },
    headerRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 14,
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 18,
    },
    titleBlock: { maxWidth: 980 },
    brandPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.12)",
      backdropFilter: "blur(10px)",
      marginBottom: 10,
      fontWeight: 800,
      letterSpacing: 0.8,
    },
    h1: {
      margin: 0,
      fontSize: 52,
      lineHeight: 1.03,
      fontWeight: 950,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      background: "linear-gradient(90deg, #A855F7, #60A5FA, #22C55E)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    subtitle: {
      marginTop: 10,
      marginBottom: 0,
      color: "rgba(255,255,255,0.82)",
      fontSize: 15,
      lineHeight: 1.45,
      maxWidth: 980,
    },
    rightControls: { display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" },
    statusPill: (ok) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      fontWeight: 800,
      fontSize: 13,
      background: ok ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
      border: ok ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(239,68,68,0.35)",
      color: ok ? "#BBF7D0" : "#FECACA",
    }),
    button: (variant) => ({
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: 12,
      padding: "12px 14px",
      fontWeight: 900,
      color: "#fff",
      background:
        variant === "primary"
          ? "linear-gradient(90deg, rgba(168,85,247,0.95), rgba(34,197,94,0.95))"
          : "rgba(255,255,255,0.08)",
      boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
      minWidth: 180,
      textAlign: "center",
    }),
    smallText: { fontSize: 12, color: "rgba(255,255,255,0.65)" },

    main: {
      display: "grid",
      gridTemplateColumns: "minmax(340px, 460px) 1fr",
      gap: 18,
      alignItems: "start",
      width: "100%",
    },

    card: {
      borderRadius: 18,
      padding: 16,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
      backdropFilter: "blur(10px)",
      overflow: "hidden",
    },
    cardTitleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 10,
    },
    cardTitle: { margin: 0, fontSize: 16, fontWeight: 950, letterSpacing: 0.4 },

    // ✅ OVERLAP FIX: auto-fit with min width + gap
    inputsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: 12,
    },
    field: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
    label: { fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.88)" },
    input: {
      width: "100%",
      boxSizing: "border-box",
      height: 46,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(10,14,24,0.65)",
      color: "#fff",
      outline: "none",
      fontWeight: 800,
    },

    resultsHeader: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
    statBox: {
      padding: 12,
      borderRadius: 14,
      background: "rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.12)",
      minHeight: 64,
    },
    statLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 900 },
    statValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },

    chartWrap: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      background: "rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.12)",
      overflowX: "auto",
    },

    conclusion: {
      marginTop: 12,
      padding: 14,
      borderRadius: 16,
      background: "rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.12)",
    },
    conclusionTitle: { margin: 0, fontSize: 14, fontWeight: 950, marginBottom: 8 },
    ul: { margin: "10px 0 0 18px", color: "rgba(255,255,255,0.82)", lineHeight: 1.55, fontSize: 13 },
  };

  const ok = backendStatus === "ok";

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div style={styles.titleBlock}>
          <div style={styles.brandPill}>CAPITALSENSE</div>
          <h1 style={styles.h1}>CAPITALSENSE</h1>
          <p style={styles.subtitle}>
            Enter your business inputs, run a 3-scenario simulation, and get a clear runway + risk conclusion with practical next steps.
          </p>
        </div>

        <div style={styles.rightControls}>
          <div style={styles.statusPill(ok)}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: ok ? "#22C55E" : backendStatus === "checking" ? "#60A5FA" : "#EF4444",
                display: "inline-block",
              }}
            />
            {backendStatus === "checking" ? "Backend: Checking…" : ok ? "Backend: OK" : "Backend: Down"}
          </div>

          <button style={styles.button("secondary")} onClick={() => checkBackend(false)} disabled={loadingHealth}>
            {loadingHealth ? "Checking…" : "Check Backend"}
          </button>

          <div style={styles.smallText}>API: {API_BASE}</div>
        </div>
      </div>

      <div style={styles.main}>
        {/* Inputs */}
        <div style={styles.card}>
          <div style={styles.cardTitleRow}>
            <h3 style={styles.cardTitle}>Inputs</h3>
            <button style={styles.button("secondary")} onClick={resetAll}>
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
                  onBlur={normalizeOnBlur(f.key)}
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
                onChange={(e) => setProjectionMonths(sanitize(e.target.value, false, true))}
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
                onChange={(e) => setMonteCarloRuns(sanitize(e.target.value, false, true))}
                onBlur={normalizeMetaOnBlur(setMonteCarloRuns)}
              />
            </div>
          </div>

          <button style={styles.button("primary")} onClick={runAnalysis} disabled={loadingAnalysis}>
            {loadingAnalysis ? "Running…" : "Run Analysis"}
          </button>

          {error ? (
            <div style={{ marginTop: 12, color: "#FECACA", fontWeight: 800, whiteSpace: "pre-wrap" }}>{error}</div>
          ) : null}
        </div>

        {/* Results */}
        <div style={styles.card}>
          <div style={styles.cardTitleRow}>
            <h3 style={styles.cardTitle}>Results</h3>
          </div>

          <div style={styles.resultsHeader}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Risk Level</div>
              <div style={styles.statValue}>{result?.metrics?.risk_level ?? "—"}</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Runway</div>
              <div style={styles.statValue}>{result?.metrics?.runway_label ?? "—"}</div>
            </div>
          </div>

          <div style={styles.chartWrap}>
            {cashSeries ? <canvas ref={canvasRef} /> : <div style={{ color: "rgba(255,255,255,0.7)" }}>Run analysis to show the chart.</div>}
          </div>

          <div style={styles.conclusion}>
            <h4 style={styles.conclusionTitle}>Conclusion</h4>
            {conclusion ? (
              <>
                <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 800 }}>
                  Risk level: {conclusion.risk} • P(cash negative within 6 months): {conclusion.p6Text}
                </div>
                <div style={{ marginTop: 8, color: "rgba(255,255,255,0.82)", lineHeight: 1.5 }}>
                  {conclusion.interpretation}
                </div>
                <div style={{ marginTop: 8, color: "rgba(255,255,255,0.78)" }}>{conclusion.runwayText}</div>
                <ul style={styles.ul}>
                  {conclusion.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.7)" }}>Run analysis to generate a detailed conclusion.</div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .stack { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}