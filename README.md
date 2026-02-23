# CapitalSense

**CapitalSense** is a financial decision engine for **runway modeling, hiring strategy, and risk analysis**.  
It combines a FastAPI backend for simulation/analysis with a React frontend for interactive inputs and visualization.

---

## Features

- Manual input entry for core financial assumptions (cash, revenue, costs, team size, hiring, growth)
- Runway and burn calculation
- Scenario-based projections (Conservative / Base / Optimistic)
- Risk indicators (e.g., probability of cash going negative)
- Interactive chart visualization (React + Recharts)

---

## Tech Stack

- **Backend:** FastAPI (Python)
- **Frontend:** React (Vite) + Recharts
- **API:** JSON over HTTP

---

## Project Structure
capitalSense/
api.py
requirements.txt
frontend/
src/
App.jsx
package.json
---

## Setup (Local)

### 1) Backend (FastAPI)

Create a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt