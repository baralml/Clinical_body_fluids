# Clinical CSF Diagnostics & Case Matcher 🧪🔬

An advanced, premium dark-themed clinical decision support system designed to assist healthcare professionals in evaluating cerebrospinal fluid (CSF) diagnostic profiles. The platform uses a tuned Random Forest classifier to predict central nervous system (CNS) infections and aligns patients with similar historical cases while strictly enforcing patient privacy.

---

## 🌟 Key Features

1. **Random Forest Meningitis Predictor**
   - Automatically classifies CSF profiles into 6 targets: *Normal CSF*, *Bacterial Meningitis*, *Viral Meningitis*, *Tuberculous Meningitis (TBM)*, *Fungal Meningitis*, or *Encephalitis*.
   - Balanced class models trained using synthetic Gaussian noise augments to prevent cell-count bias and enable high sensitivity to continuous values like microprotein and glucose.
   - Interactive diagnostic templates (*Normal, Bacterial, Viral, TBM, Fungal*) for instant baseline evaluations.

2. **Early CSF Case Matcher & Privacy Guard**
   - Calculates clinical similarity matching using a normalized weighted distance metrics engine.
   - Automatically hides patient names and exposes only randomized **Patient IDs (PIDs)** to remain strictly compliant with healthcare privacy standards.
   - Provides side-by-side comparative parameter tables (green highlights for close matches) and expandable medical course histories.

3. **Bi-Directional CSV Upload & Sync**
   - Drag-and-drop CSV patient files onto either dashboard page to import patient profiles.
   - Normalizes columns automatically from both structured databases (`csfdata.csv`) and unstructured logs.
   - Selectors are synchronized bi-directionally; changing patients on one screen automatically updates inputs and predictions on the other.

4. **Robust Text Notes Lab Parser**
   - Regex-based text extraction translates unstructured lab copy-pastes into structured values.
   - Translates literal descriptors (e.g. `Straw/Yellow`, `Slightly Hazy`, `Predominantly Lymphocytes`, `Present`) into the model's corresponding category codes.

5. **LLM Consultation (Optional)**
   - Integrates with the Google Gemini API to extract narrative summaries from case histories and generate clinical patient briefs.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, ES6 JavaScript, and Vanilla CSS3 custom-themed with glowing radial background gradients, glassmorphism, and smooth transitions.
- **Backend**: FastAPI (Python), Uvicorn server, and `scikit-learn` for machine learning inference.

---

## 📁 Project Structure

```text
Clinical_body_fluids/
├── backend/
│   ├── main.py                 # FastAPI Application routes & Static mounting
│   ├── train_model.py          # Machine learning model training pipeline
│   ├── model_service.py        # ML Prediction & Clinical Similarity Matcher
│   ├── llm_service.py          # LLM Consultations & Env integration
│   ├── clinical_service.py     # PubMed & Trial Matcher operations
│   ├── cns_model.joblib        # Trained Random Forest Model
│   └── model_features.json     # Feature list & target configurations
├── frontend/
│   ├── index.html              # Dashboard interface (Tabs, forms, widgets)
│   ├── app.js                  # Frontend logic, parsing, and page rendering
│   └── style.css               # Premium dark glassmorphic design system
├── Dockerfile                  # Containerized deployment settings
├── Procfile                    # Render/Heroku startup file
├── requirements.txt            # Python dependencies
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started (Local Setup)

### Prerequisites
- Python 3.11 or later
- Pip package manager

### 1. Install Dependencies
Set up a virtual environment and install the required libraries:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. (Optional) Retrain the Model
If you modify the training dataset or distributions, you can retrain the Random Forest model:
```bash
python backend/train_model.py
```

### 3. Run the Server
Start the development server:
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser to view the application.

---

## ☁️ Deployment Guide

### Option A: Render (Recommended - Free Tier)
Render supports automatic deployments from your GitHub repository using the [Procfile](file:///home/sabarno-baral/Documents/Antigravity/Procfile):
1. Create a **Web Service** on [Render](https://dashboard.render.com).
2. Connect your repository `Clinical_body_fluids`.
3. Render will auto-detect the python configuration. Set the start command to:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
4. Set your `GEMINI_API_KEY` in the **Environment** settings.

### Option B: Hugging Face Spaces (Docker Sandbox - Free)
Builds and deploys the app via the [Dockerfile](file:///home/sabarno-baral/Documents/Antigravity/Dockerfile):
1. Create a **Space** on [Hugging Face](https://huggingface.co/spaces) and choose **Docker** (Blank SDK).
2. Push this repository to your Space.
3. Add your `GEMINI_API_KEY` as a secret variable in **Settings**.
