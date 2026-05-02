from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import os
import sys

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ReportRequest(BaseModel):
    report_message: str

def run_script(script_name, args=[]):
    """Helper to run a selenium script from the parent directory."""
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script_path = os.path.join(parent_dir, script_name)
    try:
        command = [sys.executable, script_path] + args
        subprocess.run(command, check=True, cwd=parent_dir)
    except subprocess.CalledProcessError as e:
        print(f"Error running {script_name}: {e}")
        raise e

@app.post("/api/login")
def login_trigger(background_tasks: BackgroundTasks):
    try:
        # We run the script in the background to avoid blocking the HTTP response
        background_tasks.add_task(run_script, "app.py")
        return {"status": "success", "message": "Login sequence initiated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/logout")
def logout_trigger(background_tasks: BackgroundTasks):
    # This assumes you create a logout.py similar to app.py
    # background_tasks.add_task(run_script, "logout.py")
    return {"status": "success", "message": "Logout sequence initiated"}

@app.post("/api/report")
def submit_report(request: ReportRequest, background_tasks: BackgroundTasks):
    try:
        # Pass the report message to report.py
        background_tasks.add_task(run_script, "report.py", ["-r", request.report_message])
        return {"status": "success", "message": "Report submission initiated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health_check():
    return {"status": "alive"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
