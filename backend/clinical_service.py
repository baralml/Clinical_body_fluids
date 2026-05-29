import os
import json
import subprocess
import tempfile
import logging

logger = logging.getLogger("clinical_service")

CLINICAL_TRIALS_CLI = os.getenv("CLINICAL_TRIALS_CLI", "/home/sabarno-baral/.gemini/config/plugins/science/skills/clinical_trials_database/scripts/clinical_trials_api.py")
PUBMED_CLI = os.getenv("PUBMED_CLI", "/home/sabarno-baral/.gemini/config/plugins/science/skills/pubmed_database/scripts/pubmed_api.py")

# Ensure temp files go into a dedicated workspace folder to avoid sandbox issues
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TMP_DIR = os.path.join(BASE_DIR, "..", "tmp")
os.makedirs(TMP_DIR, exist_ok=True)

class ClinicalService:
    @staticmethod
    def _run_cmd(cmd: list[str]) -> dict:
        """Helper to execute command and return parsed JSON result."""
        # Ensure uv is in PATH for executing the commands
        env = os.environ.copy()
        env["PATH"] = f"/home/sabarno-baral/.local/bin:{env.get('PATH', '')}"
        
        logger.info(f"Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"Command failed with code {result.returncode}. Stderr: {result.stderr}")
            return {"error": f"CLI command failed: {result.stderr.strip()}"}
        
        # Check if output file was specified and read it
        # The output file is usually the last or near-last argument with --output or positional
        # But we pass the filename explicitly in our wrapper methods, so we'll read and return it directly there.
        return {}

    def search_trials(self, condition: str = None, status: str = None, phase: str = None, 
                      age_group: str = None, location: str = None, limit: int = 10) -> list[dict]:
        """Search trials on ClinicalTrials.gov using CLI wrapper."""
        fd, temp_path = tempfile.mkstemp(suffix=".json", dir=TMP_DIR)
        os.close(fd)
        os.remove(temp_path) # Delete to allow CLI script to write it fresh
        
        try:
            cmd = [
                "uv", "run", CLINICAL_TRIALS_CLI, "search",
                "--output", temp_path,
                "--limit", str(limit),
                # We request essential fields to analyze eligibility
                "--fields", "NCTId,BriefTitle,OverallStatus,Phase,BriefSummary,ConditionsModule,ArmsInterventionsModule,EligibilityModule"
            ]
            
            if condition:
                cmd.extend(["--condition", condition])
            if status:
                cmd.extend(["--status", status])
            if phase:
                cmd.extend(["--phase", phase])
            if age_group:
                cmd.extend(["--age-group", age_group])
            if location:
                cmd.extend(["--location", location])
                
            self._run_cmd(cmd)
            
            if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                return []
                
            with open(temp_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            # ClinicalTrials API v2 search returns {"studies": [...]}
            return data.get("studies", [])
        except Exception as e:
            logger.exception("Error in search_trials")
            return []
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def get_trial_details(self, nct_id: str) -> dict:
        """Fetch full details of a study by NCT ID."""
        fd, temp_path = tempfile.mkstemp(suffix=".json", dir=TMP_DIR)
        os.close(fd)
        os.remove(temp_path) # Delete to allow CLI script to write it fresh
        
        try:
            cmd = [
                "uv", "run", CLINICAL_TRIALS_CLI, "get-study",
                nct_id,
                "--output", temp_path
            ]
            
            self._run_cmd(cmd)
            
            if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                return {}
                
            with open(temp_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.exception(f"Error fetching study details for {nct_id}")
            return {}
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def search_pubmed_articles(self, query: str, max_results: int = 5) -> list[str]:
        """Search PubMed articles and return a list of PMIDs."""
        fd, temp_path = tempfile.mkstemp(suffix=".json", dir=TMP_DIR)
        os.close(fd)
        os.remove(temp_path) # Delete to allow CLI script to write it fresh
        
        try:
            cmd = [
                "uv", "run", PUBMED_CLI, temp_path, "search_pubmed",
                query, str(max_results)
            ]
            
            self._run_cmd(cmd)
            
            if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                return []
                
            with open(temp_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.exception("Error in search_pubmed")
            return []
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def fetch_abstracts(self, pmids: list[str]) -> list[dict]:
        """Fetch metadata and abstracts for PMIDs."""
        if not pmids:
            return []
            
        fd, temp_path = tempfile.mkstemp(suffix=".json", dir=TMP_DIR)
        os.close(fd)
        os.remove(temp_path) # Delete to allow CLI script to write it fresh
        
        try:
            pmid_str = ",".join(pmids)
            cmd = [
                "uv", "run", PUBMED_CLI, temp_path, "fetch_article_abstracts",
                pmid_str
            ]
            
            self._run_cmd(cmd)
            
            if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                return []
                
            with open(temp_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.exception("Error in fetch_abstracts")
            return []
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
