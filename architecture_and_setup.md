# Architecture and Free Tier Setup Guide

## 1. Free Tier Feasibility

Yes, you can absolutely build this application using entirely free tiers, but we need to choose the right platforms based on your requirements (specifically, running Python Selenium scripts).

### Frontend (React)
*   **Netlify / GitHub Pages / Vercel:** All provide excellent, 100% free hosting for React (Vite) applications. 
*   *Recommendation:* **Netlify** or **Vercel** are the easiest for React apps, offering continuous deployment from GitHub.

### Backend (Python + Selenium)
*   **Vercel (Serverless Python):** While Vercel has a free tier for Python, it has a **10-second execution timeout** and size limits. Selenium scripts usually take longer than 10 seconds and the Chromium binary is large. Therefore, Vercel is *not recommended* for the Selenium backend.
*   **Supabase:** Supabase provides an excellent free tier for Postgres Database and Authentication, but it does *not* host Python applications.
*   **Render.com / Koyeb:** These platforms offer free tiers that can run Dockerized Python applications (which is needed for Selenium + Chrome). Render's free web services spin down after 15 minutes of inactivity, but they can handle long-running tasks better than Vercel.
*   *Recommendation:* Use **Render.com** for the Python backend (using FastAPI to wrap your scripts) and **Supabase** if you need a database to store user preferences or login history.

---

## 2. System Architecture

### Backend (Python/FastAPI)
The backend will wrap your existing `app.py` and `report.py` scripts into API endpoints.
*   **Endpoints:**
    *   `/api/login`: Triggers the login sequence (running a modified `app.py`).
    *   `/api/logout`: Triggers the logout sequence.
    *   `/api/report`: Accepts report text and triggers `report.py`.
*   **Always-On Requirement:** To keep the backend "alive all the time" on a free tier like Render (which spins down), you can set up a free cron job (e.g., using cron-job.org) to ping the backend every 14 minutes, preventing it from sleeping.

### Frontend (React/Vite)
The frontend will be a mobile-first, responsive Progressive Web App (PWA) style interface.
*   **State Management:** Stores user settings (reminder times, existing reports).
*   **Logic & Timing Rules:**
    *   **Weekdays (Mon-Fri):** 9 hours after login, trigger 2 reminders. If no response, auto-logout.
    *   **Saturday:** 4 hours after login, trigger reminders. If no response, auto-logout.
    *   **Sunday:** No restrictions, manual logout only.
    *   **Holidays:** Morning prompt shows "Login Now", "Today Holiday", "Later".
*   **Report Options:** Provide UI to select an "existing report", "write a new report", or "do it later".

---

## 3. Setup Instructions

### Backend Setup (FastAPI)
1. Navigate to the `backend` directory.
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
4. Install requirements: `pip install fastapi uvicorn selenium webdriver-manager pydantic`
5. Run the server locally: `uvicorn main:app --reload`

### Frontend Setup (React/Vite)
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. The frontend will be available at `http://localhost:5173`
