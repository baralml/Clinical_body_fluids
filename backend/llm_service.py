import os
import json
import logging
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

logger = logging.getLogger("llm_service")

# Pydantic schemas for structured LLM outputs
class EligibilityEvaluation(BaseModel):
    status: str = Field(description="Exactly one of: 'ELIGIBLE', 'POTENTIALLY_ELIGIBLE', 'EXCLUDED'")
    matching_score: int = Field(description="Matching percentage score from 0 (completely unmatched) to 100 (perfect match)")
    reasoning: str = Field(description="Concise summary explanation of the evaluation")
    inclusion_analysis: list[str] = Field(description="Bullet points analyzing which inclusion criteria are met or unmet")
    exclusion_analysis: list[str] = Field(description="Bullet points analyzing whether any exclusion criteria are met")
    next_steps: str = Field(description="Recommended next steps for the physician or patient")

class LiteratureSummary(BaseModel):
    clinical_summary: str = Field(description="High-level executive summary of what the clinical research shows")
    efficacy: str = Field(description="Summary of the treatment efficacy findings")
    safety_adverse_events: str = Field(description="Summary of any adverse events, side effects or safety profiles reported")
    conclusion: str = Field(description="Overall consensus conclusion of the publications")

class LLMService:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if self.api_key:
            try:
                # Initialize GenAI client with key
                self.client = genai.Client(api_key=self.api_key)
                self.model = "gemini-2.5-flash"
                logger.info(f"Gemini client initialized successfully with model {self.model}")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                self.client = None
        else:
            logger.warning("GEMINI_API_KEY not found in environment. Running in SIMULATED mode.")
            self.client = None

    def evaluate_eligibility(self, patient_profile: dict, trial_details: dict) -> EligibilityEvaluation:
        """Evaluate patient eligibility against trial criteria using Gemini."""
        if not self.client:
            return self._mock_eligibility(patient_profile, trial_details)
            
        protocol = trial_details.get("protocolSection", {})
        id_mod = protocol.get("identificationModule", {})
        brief_title = id_mod.get("briefTitle", "Unknown Trial")
        nct_id = id_mod.get("nctId", "Unknown NCT ID")
        
        elig_mod = protocol.get("eligibilityModule", {})
        criteria = elig_mod.get("eligibilityCriteria", "No explicit criteria listed.")
        std_ages = elig_mod.get("stdAges", [])
        sex = elig_mod.get("sex", "ALL")
        
        prompt = f"""
        You are an advanced clinical oncology and general medicine AI assistant. Your task is to evaluate a patient's eligibility for a specific clinical trial based on the trial's official eligibility criteria.
        
        TRIAL DETAILS:
        - NCT ID: {nct_id}
        - Title: {brief_title}
        - Accepted Age Groups: {', '.join(std_ages)}
        - Accepted Sex: {sex}
        - Official Criteria:
        {criteria}
        
        PATIENT PROFILE:
        - Age: {patient_profile.get('age', 'Unknown')}
        - Sex: {patient_profile.get('sex', 'Unknown')}
        - Primary Condition: {patient_profile.get('condition', 'Unknown')}
        - Current Medications: {patient_profile.get('medications', 'None')}
        - Medical History & Co-morbidities: {patient_profile.get('history', 'None')}
        - Lab/Clinical Metrics: {patient_profile.get('labs', 'None')}
        
        INSTRUCTIONS:
        1. Compare the patient's characteristics against the trial's inclusion and exclusion criteria.
        2. Determine if the patient is 'ELIGIBLE', 'POTENTIALLY_ELIGIBLE' (some criteria need verification/unspecified), or 'EXCLUDED' (violates at least one exclusion criterion or fails a key inclusion criterion).
        3. Formulate a structured assessment.
        """
        
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=EligibilityEvaluation,
                    temperature=0.1,  # Low temperature for highly deterministic analytical reasoning
                )
            )
            # Parse the JSON response
            data = json.loads(response.text)
            return EligibilityEvaluation(**data)
        except Exception as e:
            logger.exception("Error evaluating eligibility with Gemini")
            return self._mock_eligibility(patient_profile, trial_details, error_message=str(e))

    def summarize_literature(self, query: str, articles: list[dict]) -> LiteratureSummary:
        """Summarize PubMed articles related to the intervention query using Gemini."""
        if not self.client:
            return self._mock_literature(query)
            
        articles_text = ""
        for i, art in enumerate(articles):
            title = art.get("title", "No Title")
            authors = ", ".join(art.get("authors", []))
            journal = art.get("journal", "Unknown Journal")
            date = art.get("pubdate", "Unknown Date")
            abstract = art.get("abstract", "No abstract available.")
            articles_text += f"\n--- PAPER {i+1} ---\nTitle: {title}\nAuthors: {authors}\nJournal: {journal} ({date})\nAbstract: {abstract}\n"
            
        prompt = f"""
        You are a medical literature intelligence agent. Synthesize a concise, evidence-based review of the following publications regarding the treatment/intervention query: '{query}'.
        
        PUBLICATIONS TO SUMMARIZE:
        {articles_text}
        
        INSTRUCTIONS:
        1. Synthesize the findings across these papers.
        2. Outline the clinical summary, efficacy outcomes, safety profiles/adverse events, and write a unified clinical conclusion.
        3. Ensure your findings are strictly grounded in the provided abstracts. Do not extrapolate beyond what is reported.
        """
        
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=LiteratureSummary,
                    temperature=0.2,
                )
            )
            data = json.loads(response.text)
            return LiteratureSummary(**data)
        except Exception as e:
            logger.exception("Error summarizing literature with Gemini")
            return self._mock_literature(query, error_message=str(e))

    def _mock_eligibility(self, patient_profile: dict, trial_details: dict, error_message: str = None) -> EligibilityEvaluation:
        """Generates a mock evaluation when API key is missing or calls fail."""
        status = "POTENTIALLY_ELIGIBLE"
        score = 75
        reasoning = "[DEMO MODE] Showing simulated eligibility evaluation."
        
        if error_message:
            reasoning += f" (Gemini Error: {error_message})"
        else:
            reasoning += " To run live LLM matching, please set a valid GEMINI_API_KEY in your .env file."
            
        p_cond = patient_profile.get("condition", "").lower()
        t_conds = str(trial_details.get("protocolSection", {}).get("conditionsModule", {}).get("conditions", [])).lower()
        
        inc = ["Patient condition aligns with trial scope.", "Patient age/sex constraints appear compatible."]
        exc = ["No immediate contraindications found in profile."]
        
        # Simple rule-based mock matching
        if p_cond and t_conds and p_cond not in t_conds:
            status = "EXCLUDED"
            score = 30
            reasoning = "[DEMO MODE] Primary condition does not appear to match the trial's target conditions."
            inc = ["Unmatched target condition."]
            exc = ["Fails core inclusion criterion for patient primary disease matching."]
            
        return EligibilityEvaluation(
            status=status,
            matching_score=score,
            reasoning=reasoning,
            inclusion_analysis=inc,
            exclusion_analysis=exc,
            next_steps="Configure the GEMINI_API_KEY in your .env file to enable precise criteria evaluation."
        )

    def _mock_literature(self, query: str, error_message: str = None) -> LiteratureSummary:
        """Generates a mock summary when API key is missing or calls fail."""
        info = ""
        if error_message:
            info = f" (Gemini Error: {error_message})"
            
        return LiteratureSummary(
            clinical_summary=f"[DEMO MODE] Summarizing literature for '{query}'{info}.",
            efficacy="Simulated Efficacy: Literature indicates standard therapeutic benefit with expected variance across patient cohorts.",
            safety_adverse_events="Simulated Safety: Most common adverse events include mild nausea, fatigue, and headaches. Low incidence of grade 3/4 toxicities.",
            conclusion="To see actual, live summaries synthesized from PubMed research abstracts, please enter a valid GEMINI_API_KEY in your .env file."
        )
