# CapitalSense

CapitalSense is a financial simulation engine designed to help founders and operators make disciplined decisions around runway, hiring, burn management, and insolvency risk.

It transforms core business inputs into structured projections using deterministic financial modeling and Monte Carlo simulation.

---

## Overview

Early-stage companies often rely on static spreadsheets and single-point forecasts. CapitalSense introduces probabilistic modeling to quantify uncertainty and evaluate downside risk in a structured way.

The platform converts startup inputs into actionable financial intelligence.

---

## What It Does

CapitalSense calculates:

- Cash runway duration  
- Net burn rate  
- Break-even probability  
- Short-term insolvency probability  
- Hiring safety threshold  
- Revenue sensitivity analysis  
- Multi-scenario cash projections  

The output includes dynamic projections and an executive-level conclusion to support decision-making.

---

## Why It Is Used

CapitalSense helps answer critical operational questions:

- How long will our cash last?
- Is it safe to hire right now?
- What happens if revenue growth slows?
- What is our short-term insolvency risk?
- When should we prepare for fundraising?

Instead of relying on a single forecast, CapitalSense models multiple possible futures and quantifies financial risk exposure.

---

## Tech Stack

- Python  
- Streamlit  
- Pandas  
- NumPy  
- Matplotlib  
- Monte Carlo simulation logic  

No external APIs.  
No paid services.  
Runs fully locally or deployable via Streamlit Cloud.

---

## Project Structure

```
CapitalSense/
│
├── app/
│   ├── __init__.py
│   ├── engine.py
│   └── main.py
│
├── ui.py
├── requirements.txt
└── README.md
```

---

## Installation

Clone the repository:

```
git clone https://github.com/your-username/CapitalSense.git
cd CapitalSense
```

Create a virtual environment:

```
python -m venv .venv
source .venv/bin/activate   # Mac/Linux
```

Install dependencies:

```
pip install -r requirements.txt
```

Run the application:

```
streamlit run ui.py
```

---

## Example Input

- Cash on hand  
- Monthly revenue  
- Fixed and variable costs  
- Team size  
- Revenue growth rate  
- Hiring plans  

---

## Example Output

- Runway months  
- Risk classification  
- Cash projection chart  
- Executive conclusion summary  

---

## Deployment

CapitalSense can be deployed publicly using:

- Streamlit Community Cloud  
- Render  
- Railway  
- Docker  

---

## License

MIT License

---

## Author

Varun Shesh Bandam  
Financial simulation and startup decision tooling.
