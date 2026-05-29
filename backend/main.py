import os
import logging
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.clinical_service import ClinicalService
from backend.llm_service import LLMService
from backend.model_service import ModelService

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

app = FastAPI(
    title="ClinicalTrialInsight AI API",
    description="Backend services for trial search, LLM patient matching, and literature synthesis.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services initialization
clinical_service = ClinicalService()
llm_service = LLMService()
model_service = ModelService()

# API Schemas
class MatchRequest(BaseModel):
    patient_profile: dict
    trial_details: dict

class PredictRequest(BaseModel):
    patient_profile: dict

@app.get("/api/status")
async def get_status():
    """Check if Gemini API is active or simulated."""
    return {"gemini_active": llm_service.client is not None}

@app.get("/api/search")
async def search_trials(
    condition: str = Query(None, description="Primary condition to search"),
    status: str = Query(None, description="Recruitment status (e.g. RECRUITING, COMPLETED)"),
    phase: str = Query(None, description="Trial phase (e.g. PHASE1, PHASE2, PHASE3, PHASE4)"),
    age_group: str = Query(None, description="Target age group (e.g. CHILD, ADULT, OLDER_ADULT)"),
    location: str = Query(None, description="Geographic location query"),
    limit: int = Query(10, description="Maximum number of records to return")
):
    """Search clinical trials on ClinicalTrials.gov."""
    try:
        logger.info(f"Searching trials: cond={condition}, status={status}, phase={phase}, limit={limit}")
        studies = clinical_service.search_trials(
            condition=condition,
            status=status,
            phase=phase,
            age_group=age_group,
            location=location,
            limit=limit
        )
        return {"status": "success", "results": studies}
    except Exception as e:
        logger.exception("Error in search_trials endpoint")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trial/{nct_id}")
async def get_trial(nct_id: str):
    """Retrieve full details of a single trial by its NCT ID."""
    try:
        logger.info(f"Fetching trial details for {nct_id}")
        study = clinical_service.get_trial_details(nct_id)
        if not study:
            raise HTTPException(status_code=404, detail=f"Trial {nct_id} not found")
        return {"status": "success", "trial": study}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching trial {nct_id}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/match")
async def match_patient(request: MatchRequest):
    """Run LLM eligibility criteria matching against patient profile."""
    try:
        logger.info("Evaluating patient eligibility")
        evaluation = llm_service.evaluate_eligibility(
            patient_profile=request.patient_profile,
            trial_details=request.trial_details
        )
        return {"status": "success", "evaluation": evaluation}
    except Exception as e:
        logger.exception("Error in match_patient endpoint")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predict")
async def predict_diagnosis(request: PredictRequest):
    """Evaluate patient CSF metrics using the trained ML classifier model."""
    try:
        logger.info("Predicting patient diagnosis using ML model")
        prediction = model_service.predict_diagnosis(request.patient_profile)
        return prediction
    except Exception as e:
        logger.exception("Error in predict_diagnosis endpoint")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/similar-cases")
async def find_similar_cases(request: PredictRequest):
    """Find top similar patient cases in the database, protecting patient privacy by masking names."""
    try:
        logger.info("Finding similar patient cases in the database")
        matches = model_service.find_similar_cases(request.patient_profile)
        return {"status": "success", "results": matches}
    except Exception as e:
        logger.exception("Error in similar_cases endpoint")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/literature")
async def get_literature(
    query: str = Query(..., description="The medical intervention/drug query"),
    limit: int = Query(5, description="Number of PubMed papers to summarize")
):
    """Retrieve PubMed research papers for an intervention and synthesize a summary using Gemini."""
    try:
        logger.info(f"Searching literature and summarizing for: {query}")
        # Step 1: Search PMIDs
        pmids = clinical_service.search_pubmed_articles(query, max_results=limit)
        
        # Step 2: Fetch article abstracts
        articles = []
        if pmids:
            articles = clinical_service.fetch_abstracts(pmids)
            
        # Step 3: Run Gemini to synthesize summary
        summary = llm_service.summarize_literature(query, articles)
        
        return {
            "status": "success",
            "query": query,
            "articles": articles,
            "summary": summary
        }
    except Exception as e:
        logger.exception("Error in literature endpoint")
        raise HTTPException(status_code=500, detail=str(e))

# Mount the static frontend directory.
# This must be mounted last so that it doesn't block the API routes.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(BASE_DIR, "..", "frontend")
os.makedirs(frontend_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
