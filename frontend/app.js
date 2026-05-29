// ClinicalTrialInsight AI - Frontend Logic

document.addEventListener("DOMContentLoaded", () => {
    // State management
    const state = {
        trials: [],
        selectedTrial: null,
        geminiActive: false,
        activeTab: "tab-overview",
        patientProfile: {},
        parsedPatients: []
    };

    // DOM Elements
    const themeToggle = document.getElementById("themeToggle");
    const llmStatusDot = document.querySelector(".status-dot");
    const llmStatusLabel = document.getElementById("llmStatusLabel");
    
    const searchForm = document.getElementById("searchForm");
    const patientForm = document.getElementById("patientForm");
    
    // Quick templates
    const loadOncoTemplateBtn = document.getElementById("loadOncoTemplate");
    const loadCardioTemplateBtn = document.getElementById("loadCardioTemplate");
    const loadDiabetesTemplateBtn = document.getElementById("loadDiabetesTemplate");
    
    // Patient Profile inputs
    const patientAge = document.getElementById("patientAge");
    const patientSex = document.getElementById("patientSex");
    const patientCondition = document.getElementById("patientCondition");
    const patientMeds = document.getElementById("patientMeds");
    const patientHistory = document.getElementById("patientHistory");
    const patientLabs = document.getElementById("patientLabs");

    // CSV elements
    const csvFileInput = document.getElementById("csvFileInput");
    const uploadCsvBtn = document.getElementById("uploadCsvBtn");
    const downloadSampleBtn = document.getElementById("downloadSampleBtn");
    const csvPatientSelector = document.getElementById("csvPatientSelector");
    const csvPatientDropdown = document.getElementById("csvPatientDropdown");

    // Page 2 CSV elements
    const csfUploadCsvBtn = document.getElementById("csfUploadCsvBtn");
    const csfDownloadSampleBtn = document.getElementById("csfDownloadSampleBtn");
    const csfCsvPatientSelector = document.getElementById("csfCsvPatientSelector");
    const csfCsvPatientDropdown = document.getElementById("csfCsvPatientDropdown");

    // ML Prediction elements
    const mlModeBadge = document.getElementById("mlModeBadge");
    const mlPredictionValue = document.getElementById("mlPredictionValue");
    const mlConfidenceValue = document.getElementById("mlConfidenceValue");
    const mlProbabilitiesList = document.getElementById("mlProbabilitiesList");

    // UI States
    const loadingState = document.getElementById("loadingState");
    const emptyState = document.getElementById("emptyState");
    const trialsGrid = document.getElementById("trialsGrid");
    const resultsCount = document.getElementById("resultsCount");
    
    // Drawer/Modal Elements
    const drawerOverlay = document.getElementById("drawerOverlay");
    const closeDrawerBtn = document.getElementById("closeDrawer");
    const drawerTabs = document.querySelectorAll(".tab-btn");
    
    // Drawer Overview Elements
    const drawerNctId = document.getElementById("drawerNctId");
    const drawerTitle = document.getElementById("drawerTitle");
    const drawerPhase = document.getElementById("drawerPhase");
    const drawerStatus = document.getElementById("drawerStatus");
    const drawerBriefSummary = document.getElementById("drawerBriefSummary");
    const drawerConditions = document.getElementById("drawerConditions");
    const drawerInterventions = document.getElementById("drawerInterventions");
    const drawerRawCriteria = document.getElementById("drawerRawCriteria");
    
    // Drawer Match Elements
    const drawerMatchHero = document.getElementById("drawerMatchHero");
    const drawerMatchStatus = document.getElementById("drawerMatchStatus");
    const drawerMatchScore = document.getElementById("drawerMatchScore");
    const drawerScoreFill = document.getElementById("drawerScoreFill");
    const matchCardIcon = document.getElementById("matchCardIcon");
    const matchStatusHeadline = document.getElementById("matchStatusHeadline");
    const matchReasoning = document.getElementById("matchReasoning");
    const inclusionCriteriaList = document.getElementById("inclusionCriteriaList");
    const exclusionCriteriaList = document.getElementById("exclusionCriteriaList");
    const matchNextSteps = document.getElementById("matchNextSteps");
    
    // Drawer Literature Elements
    const litLoading = document.getElementById("litLoading");
    const litContent = document.getElementById("litContent");
    const litSummaryText = document.getElementById("litSummaryText");
    const litEfficacyText = document.getElementById("litEfficacyText");
    const litSafetyText = document.getElementById("litSafetyText");
    const litConclusionText = document.getElementById("litConclusionText");
    const litPapersList = document.getElementById("litPapersList");

    // Theme Toggle Handler
    themeToggle.addEventListener("click", () => {
        if (document.body.classList.contains("dark-theme")) {
            document.body.classList.replace("dark-theme", "light-theme");
            localStorage.setItem("theme", "light-theme");
        } else {
            document.body.classList.replace("light-theme", "dark-theme");
            localStorage.setItem("theme", "dark-theme");
        }
    });

    // Restore Theme Choice
    const savedTheme = localStorage.getItem("theme") || "dark-theme";
    document.body.className = savedTheme;

    // Check Backend API Key Status
    async function checkApiStatus() {
        try {
            const res = await fetch("/api/status");
            const data = await res.json();
            state.geminiActive = data.gemini_active;
            
            if (state.geminiActive) {
                llmStatusDot.className = "status-dot active";
                llmStatusLabel.textContent = "API: Gemini Active";
            } else {
                llmStatusDot.className = "status-dot simulated";
                llmStatusLabel.textContent = "API: Simulated Mode";
            }
        } catch (e) {
            console.error("Error fetching status:", e);
        }
    }
    checkApiStatus();

    // Patient Profiles Templates
    const templates = {
        oncology: {
            age: 54,
            sex: "Male",
            condition: "Stage III Non-Small Cell Lung Cancer (NSCLC)",
            medications: "Amlodipine 5mg daily, Metformin 500mg BID",
            history: "Type 2 Diabetes, Hypertension. Prior left lower lobectomy (12 months ago). No prior immunotherapy.",
            labs: "ECOG Performance Status: 1. EGFR mutation: Negative. ALK translocation: Negative. Platelets: 160,000. CrCl: 75 mL/min."
        },
        cardiology: {
            age: 68,
            sex: "Female",
            condition: "Congestive Heart Failure (NYHA Class III, HFrEF)",
            medications: "Lisinopril 20mg, Carvedilol 12.5mg BID, Spironolactone 25mg daily, Furosemide 40mg daily",
            history: "Ischemic cardiomyopathy (EF 30%). History of MI (3 years ago) with stenting. Prior stroke without residual deficits.",
            labs: "NT-proBNP: 1850 pg/mL. Potassium: 4.2 mEq/L. Serum Creatinine: 1.4 mg/dL. BP: 112/68 mmHg."
        },
        diabetes: {
            age: 42,
            sex: "Female",
            condition: "Type 2 Diabetes Mellitus with Diabetic Nephropathy",
            medications: "Metformin 1000mg BID, Glipizide 5mg daily, Atorvastatin 20mg daily",
            history: "Diabetic neuropathy, chronic kidney disease (CKD) Stage 3a.",
            labs: "HbA1c: 8.4%. eGFR: 48 mL/min/1.73m². Urine Albumin-to-Creatinine Ratio (UACR): 150 mg/g."
        }
    };
    function loadTemplate(name) {
        const tmpl = templates[name];
        if (!tmpl) return;
        
        patientAge.value = tmpl.age;
        patientSex.value = tmpl.sex;
        patientCondition.value = tmpl.condition;
        patientMeds.value = tmpl.medications;
        patientHistory.value = tmpl.history;
        patientLabs.value = tmpl.labs;
        
        // Cache the template profile and clear raw_features to let backend regex parser handle it
        state.patientProfile = {
            age: parseInt(tmpl.age),
            sex: tmpl.sex,
            condition: tmpl.condition,
            medications: tmpl.medications,
            history: tmpl.history,
            labs: tmpl.labs,
            raw_features: null
        };

        // Add dynamic highlight glow to inputs briefly
        const fields = [patientAge, patientSex, patientCondition, patientMeds, patientHistory, patientLabs];
        fields.forEach(f => {
            f.style.borderColor = "var(--accent)";
            f.style.boxShadow = "0 0 8px var(--accent-glow)";
            setTimeout(() => {
                f.style.borderColor = "";
                f.style.boxShadow = "";
            }, 1000);
        });

        // Trigger prediction immediately
        getMLPrediction();
    }

    // Call backend API to predict CNS diagnosis using trained ML model
    async function getMLPrediction() {
        // Update patient profile object state
        state.patientProfile = {
            age: parseInt(patientAge.value) || 45,
            sex: patientSex.value,
            condition: patientCondition.value,
            medications: patientMeds.value,
            history: patientHistory.value,
            labs: patientLabs.value,
            raw_features: state.patientProfile.raw_features || null
        };

        mlModeBadge.className = "badge badge-ml-status loading";
        mlModeBadge.textContent = "ML: Running...";

        try {
            const res = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patient_profile: state.patientProfile })
            });
            const data = await res.json();

            if (data.status !== "success") {
                throw new Error("Inference failed");
            }

            const pred = data.prediction;
            const probs = data.probabilities || [];
            const mode = data.mode || "live";

            // Update badge status based on live or simulated prediction
            if (mode.startsWith("live")) {
                mlModeBadge.className = "badge badge-ml-status live";
                mlModeBadge.textContent = "ML: Live Model";
            } else {
                mlModeBadge.className = "badge badge-ml-status simulated";
                mlModeBadge.textContent = "ML: Simulated";
            }

            // Update primary values
            mlPredictionValue.textContent = pred.label;
            mlConfidenceValue.textContent = `${pred.confidence}%`;

            // Update probabilities progress bars
            mlProbabilitiesList.innerHTML = "";
            probs.forEach(([label, percent]) => {
                const item = document.createElement("div");
                item.className = "ml-probability-item";
                item.innerHTML = `
                    <span class="ml-class-label" title="${label}">${label}</span>
                    <div class="ml-progress-bg">
                        <div class="ml-progress-fill" style="width: 0%;"></div>
                    </div>
                    <span class="ml-class-percent">${percent}%</span>
                `;
                mlProbabilitiesList.appendChild(item);
                
                // Animate width transition
                setTimeout(() => {
                    const fill = item.querySelector(".ml-progress-fill");
                    if (fill) fill.style.width = `${percent}%`;
                }, 50);
            });

        } catch (error) {
            console.error("ML prediction error:", error);
            mlModeBadge.className = "badge badge-ml-status simulated";
            mlModeBadge.textContent = "ML: Error";
            mlPredictionValue.textContent = "Prediction Error";
            mlConfidenceValue.textContent = "--";
        }
    }

    loadOncoTemplateBtn.addEventListener("click", () => loadTemplate("oncology"));
    loadCardioTemplateBtn.addEventListener("click", () => loadTemplate("cardiology"));
    loadDiabetesTemplateBtn.addEventListener("click", () => loadTemplate("diabetes"));

    // Add event listeners to input changes to recalculate ML prediction
    [patientAge, patientSex, patientCondition, patientMeds, patientHistory, patientLabs].forEach(input => {
        if (!input) return;
        input.addEventListener("change", () => {
            // User manually updated values, clear the cached raw CSV features
            state.patientProfile.raw_features = null;
            getMLPrediction();
        });
        // Also trigger on input event (keystroke) for smoother real-time typing response
        input.addEventListener("input", () => {
            state.patientProfile.raw_features = null;
            getMLPrediction();
        });
    });

    // ==========================================
    // CSV Upload & Parsing Logic
    // ==========================================

    // RFC-compliant CSV parser
    function parseCSV(text) {
        const lines = [];
        let row = [""];
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            const next = text[i + 1];

            if (c === '"') {
                if (inQuotes && next === '"') {
                    row[row.length - 1] += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ',' && !inQuotes) {
                row.push('');
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') {
                    i++;
                }
                lines.push(row);
                row = [''];
            } else {
                row[row.length - 1] += c;
            }
        }
        if (row.length > 1 || row[0] !== '') {
            lines.push(row);
        }
        return lines;
    }

    // Helper to parse age string (handles days, months, and years)
    function parseAgeValue(val) {
        if (!val) return "45";
        val = val.toString().trim().toLowerCase();
        
        // Days conversion
        if (val.includes("day") || val.includes("d")) {
            const num = parseFloat(val.replace(/[^0-9.]/g, ''));
            if (!isNaN(num)) {
                return (num / 365).toFixed(2);
            }
        }
        
        // Months conversion
        if (val.includes("m") || val.includes("month")) {
            const num = parseFloat(val.replace(/[^0-9.]/g, ''));
            if (!isNaN(num)) {
                return (num / 12).toFixed(2);
            }
        }
        
        // Default plain number
        const num = parseFloat(val);
        return isNaN(num) ? "45" : num.toString();
    }

    // Helper to parse numerical clinical values (protein, glucose, ada, ldh, etc.)
    function parseNumericValue(val, type) {
        if (!val) return 0;
        val = val.toString().trim().toLowerCase();
        
        if (val === "nil" || val === "absent" || val === "none" || val === "") {
            return 0;
        }
        
        if (val === "low") {
            return 1;
        }
        
        if (val === "<25" && type === "ldh") {
            return 1;
        }
        
        if (val.startsWith("<")) {
            const num = parseFloat(val.replace(/[^0-9.]/g, ''));
            if (!isNaN(num)) {
                return parseFloat((num / 2).toFixed(2));
            }
        }
        
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    }

    // Helper to parse colour_encoded
    function parseColourValue(val) {
        if (!val) return 0;
        val = val.toString().trim().toLowerCase();
        
        if (val.includes("watery") || val.includes("colourless") || val.includes("colorless")) {
            return 0;
        }
        if (val.includes("straw") || val.includes("pale yellow") || val.includes("yellow")) {
            return 1;
        }
        if (val.includes("whitish") || val.includes("grayish") || val.includes("greyish") || val.includes("xanthochromic") || val.includes("white") || val.includes("gray") || val.includes("grey")) {
            return 2;
        }
        if (val.includes("reddish") || val.includes("pinkish") || val.includes("pink") || val.includes("red") || val.includes("blood")) {
            return 3;
        }
        
        const num = parseInt(val);
        return isNaN(num) ? 0 : num;
    }

    // Helper to parse ph_encoded
    function parsePhValue(val) {
        if (!val) return 1;
        val = val.toString().trim().toLowerCase();
        
        if (val.includes("neutral") || val.includes("7.0") || val === "7") {
            return 1;
        }
        if (val.includes("alkaline") || val.includes("7.5") || val.includes("8")) {
            return 2;
        }
        
        const num = parseInt(val);
        return isNaN(num) ? 1 : num;
    }

    // Helper to parse appearance_encoded
    function parseAppearanceValue(val) {
        if (!val) return 0;
        val = val.toString().trim().toLowerCase();
        
        if (val.includes("clear")) {
            return 0;
        }
        if (val.includes("slight")) {
            return 1;
        }
        if (val.includes("hazy")) {
            return 2;
        }
        if (val.includes("turbid")) {
            return 3;
        }
        
        const num = parseInt(val);
        return isNaN(num) ? 0 : num;
    }

    // Helper to parse binary values (coagulum, deposit, etc.)
    function parseBinaryValue(val) {
        if (!val) return 0;
        val = val.toString().trim().toLowerCase();
        
        if (val === "absent" || val === "nil" || val === "0" || val === "no") {
            return 0;
        }
        if (val === "present" || val === "1" || val === "yes") {
            return 1;
        }
        
        const num = parseInt(val);
        return isNaN(num) ? 0 : (num > 0 ? 1 : 0);
    }

    // Helper to parse specific gravity (sg_val)
    function parseSgValue(val) {
        if (!val) return "1.000";
        const num = parseFloat(val);
        return isNaN(num) ? "1.000" : num.toFixed(3);
    }

    // Helper to parse cell type / symptoms (cns_symptom_encoded)
    function parseCellTypeValue(val) {
        if (!val) return 0;
        val = val.toString().trim().toLowerCase();
        
        if (val.includes("only") || val.includes("100% lympho") || val.includes("lymphocytes only")) {
            return 0;
        }
        if (val.includes("predominantly") || val.includes("predominant")) {
            return 1;
        }
        if (val.includes("mixed") || val.includes("polymorphs")) {
            return 2;
        }
        if (val.includes("rbc") || val.includes("hemorrhagic") || val.includes("haemorrhagic")) {
            return 3;
        }
        
        const num = parseInt(val);
        return isNaN(num) ? 0 : num;
    }

    // Map columns dynamically based on headers
    function mapPatientData(p, index) {
        let age = "";
        let sex = "";
        let condition = "";
        let medications = "";
        let history = "";
        let labs = "";
        
        // Unified keys mapping to translate raw logbook and standard headers
        const keysMap = {
            patientname: 'patientname',
            patientid: 'patientid',
            age: 'age',
            sex: 'sex',
            gender: 'sex',
            microproteinmgdl: 'proteinval',
            proteinval: 'proteinval',
            glucosemgdl: 'glucoseval',
            glucoseval: 'glucoseval',
            microalbuminmgdl: 'microalbuminval',
            microalbuminval: 'microalbuminval',
            adaul: 'adaval',
            adaval: 'adaval',
            ldhul: 'ldhval',
            ldhval: 'ldhval',
            chloridemmoll: 'chlorideval',
            chlorideval: 'chlorideval',
            volml: 'volml',
            colour: 'colourencoded',
            colourencoded: 'colourencoded',
            ph: 'phencoded',
            phencoded: 'phencoded',
            apperance: 'appearanceencoded',
            appearance: 'appearanceencoded',
            appearanceencoded: 'appearanceencoded',
            coagullam: 'coagullampresent',
            coagullampresent: 'coagullampresent',
            deposit: 'depositpresent',
            depositpresent: 'depositpresent',
            specificgravity: 'sgval',
            sgval: 'sgval',
            cellcountcumm: 'cellcount',
            cellcount: 'cellcount',
            celltype: 'cnssymptomencoded',
            cnssymptomencoded: 'cnssymptomencoded',
            cnsdiagnosisprimary: 'cnsdiagnosisprimary',
            diagnosis: 'diagnosis',
            reasonforadmission: 'reasonforadmission',
            hospitalcourseincludingoperations: 'hospitalcourse'
        };

        const normalizedP = {};
        for (const key in p) {
            const cleanKey = key.replace(/[^a-zA-Z]/g, '').toLowerCase();
            const targetKey = keysMap[cleanKey];
            if (targetKey) {
                normalizedP[targetKey] = p[key];
            }
        }

        let id = normalizedP.patientname || normalizedP.patientid || `Patient #${index + 1}`;

        // Try mapping known headers by keywords
        for (const key in p) {
            const cleanedKey = key.replace(/[^a-z]/g, '');
            if (cleanedKey === 'age') {
                age = parseAgeValue(p[key]);
            } else if (cleanedKey === 'sex' || cleanedKey === 'gender') {
                sex = p[key];
            } else if (cleanedKey === 'condition' || cleanedKey === 'disease' || cleanedKey === 'primarycondition' || cleanedKey === 'primarydisease') {
                condition = p[key];
            } else if (cleanedKey === 'meds' || cleanedKey === 'medications' || cleanedKey === 'currentmedications') {
                medications = p[key];
            } else if (cleanedKey === 'history' || cleanedKey === 'medicalhistory' || cleanedKey === 'comorbidities') {
                history = p[key];
            } else if (cleanedKey === 'labs' || cleanedKey === 'laboratory' || cleanedKey === 'clinicalmetrics' || cleanedKey === 'metrics') {
                labs = p[key];
            }
        }

        // Special handling for the csfdata.csv or Raw Data From Log Book CSF.csv (protein_val, glucose_val, etc.)
        if (normalizedP.proteinval || normalizedP.glucoseval || normalizedP.cnsdiagnosisprimary || normalizedP.diagnosis) {
            
            // Standardize raw parameters using mapped helper functions
            const protein_val = parseNumericValue(normalizedP.proteinval, 'protein');
            const glucose_val = parseNumericValue(normalizedP.glucoseval, 'glucose');
            const ada_val = parseNumericValue(normalizedP.adaval, 'ada');
            const ldh_val = parseNumericValue(normalizedP.ldhval, 'ldh');
            const microalbumin_val = parseNumericValue(normalizedP.microalbuminval, 'microalbumin');
            const chloride_val = parseNumericValue(normalizedP.chlorideval, 'chloride');
            const vol_ml = parseNumericValue(normalizedP.volml, 'vol');
            const colour_encoded = parseColourValue(normalizedP.colourencoded);
            const ph_encoded = parsePhValue(normalizedP.phencoded);
            const appearance_encoded = parseAppearanceValue(normalizedP.appearanceencoded);
            const coagullam_present = parseBinaryValue(normalizedP.coagullampresent);
            const deposit_present = parseBinaryValue(normalizedP.depositpresent);
            const sg_val = parseSgValue(normalizedP.sgval);
            const cns_symptom_encoded = parseCellTypeValue(normalizedP.cnssymptomencoded);
            const cell_count = parseNumericValue(normalizedP.cellcount, 'cellcount');
            
            // Compute binary flags from standardized values according to annotation
            const is_protein_high = protein_val > 50 ? 1 : 0;
            const is_ada_high = ada_val > 9 ? 1 : 0;
            const is_glucose_low = (glucose_val > 0 && glucose_val < 40) ? 1 : 0;
            
            const is_chloride_low = normalizedP.ischoridelow ? parseBinaryValue(normalizedP.ischoridelow) : 
                                     (normalizedP.ischloridelow ? parseBinaryValue(normalizedP.ischloridelow) : 
                                     (chloride_val > 0 && chloride_val < 110 ? 1 : 0));
            
            // Map Condition (Primary Diagnosis)
            let conditionText = "Suspected CNS Infection";
            if (normalizedP.diagnosis) {
                conditionText = normalizedP.diagnosis.toString().trim();
            } else if (normalizedP.cnsdiagnosisprimary) {
                const diagCode = normalizedP.cnsdiagnosisprimary.toString().trim();
                let cnsCond = "Suspected CNS Infection";
                if (diagCode === "0") cnsCond = "Normal CSF Control";
                else if (diagCode === "1") cnsCond = "Bacterial Meningitis";
                else if (diagCode === "2") cnsCond = "Viral Meningitis";
                else if (diagCode === "3") cnsCond = "Tuberculous Meningitis";
                else if (diagCode === "4") cnsCond = "Fungal Meningitis";
                else if (diagCode === "5") cnsCond = "Encephalitis";
                conditionText = `${cnsCond} (Class ${diagCode})`;
            }
            condition = conditionText;
            
            // Format labs beautifully
            const labsParts = [];
            labsParts.push(`CSF Protein: ${protein_val} mg/dL (High: ${is_protein_high})`);
            labsParts.push(`Glucose: ${glucose_val} mg/dL (Low: ${is_glucose_low})`);
            if (microalbumin_val > 0) labsParts.push(`Microalbumin: ${microalbumin_val} mg/L`);
            labsParts.push(`ADA: ${ada_val} U/L (High: ${is_ada_high})`);
            if (chloride_val > 0) labsParts.push(`Chloride: ${chloride_val} mEq/L (Low: ${is_chloride_low})`);
            if (ldh_val > 0) labsParts.push(`LDH: ${ldh_val} U/L`);
            if (vol_ml > 0) labsParts.push(`Vol: ${vol_ml} mL`);
            if (cell_count > 0) labsParts.push(`Cell Count: ${cell_count} cu.mm`);
            labsParts.push(`Specific Gravity: ${sg_val}`);
            labsParts.push(`Colour Code: ${colour_encoded}`);
            labsParts.push(`Appearance Code: ${appearance_encoded}`);
            labsParts.push(`pH Code: ${ph_encoded}`);
            labsParts.push(`Coagulum: ${coagullam_present === 1 ? 'Present' : 'Absent'}`);
            labsParts.push(`Deposit: ${deposit_present === 1 ? 'Present' : 'Absent'}`);
            
            labs = labsParts.join(". ");
            
            // Format narrative history (Reason for admission, clinical course, cell count comments)
            const historyParts = [];
            if (normalizedP.reasonforadmission) {
                historyParts.push(`Reason for Admission: ${normalizedP.reasonforadmission.toString().trim()}`);
            }
            if (normalizedP.hospitalcourse) {
                historyParts.push(`Hospital Course: ${normalizedP.hospitalcourse.toString().trim()}`);
            }
            historyParts.push(`Cell Type Encoding (CNS Symptom Class): ${cns_symptom_encoded}`);
            
            history = historyParts.join(". ");
            medications = "No standard drugs documented in the CSF database.";
            
            // Age conversion fallback if provided, otherwise default to 45
            age = age ? parseAgeValue(age) : (normalizedP.age ? parseAgeValue(normalizedP.age) : "45");
            sex = sex || "Male";
        }

        return {
            id: id,
            age: age || "45",
            sex: sex || "Male",
            condition: condition || "General Patient Condition",
            medications: medications || "None",
            history: history || "None",
            labs: labs || "None",
            raw_features: normalizedP
        };
    }

    // Load active patient profile from CSV selection into form fields
    function loadPatient(patient) {
        patientAge.value = patient.age;
        
        let normalizedSex = "Male";
        const cleanSex = patient.sex.toString().toLowerCase().trim();
        if (cleanSex.startsWith("f")) {
            normalizedSex = "Female";
        } else if (cleanSex.startsWith("m")) {
            normalizedSex = "Male";
        } else {
            normalizedSex = "All";
        }
        patientSex.value = normalizedSex;
        
        patientCondition.value = patient.condition;
        patientMeds.value = patient.medications;
        patientHistory.value = patient.history;
        patientLabs.value = patient.labs;

        // Cache the raw features in active state
        state.patientProfile = {
            age: parseInt(patient.age) || 45,
            sex: patient.sex,
            condition: patient.condition,
            medications: patient.medications,
            history: patient.history,
            labs: patient.labs,
            raw_features: patient.raw_features || null
        };

        // Sync with the Early CSF Diagnostics Form
        if (patient.raw_features) {
            const raw = patient.raw_features;
            const csfAgeEl = document.getElementById("csfAge");
            const csfSexEl = document.getElementById("csfSex");
            const csfProteinEl = document.getElementById("csfProtein");
            const csfGlucoseEl = document.getElementById("csfGlucose");
            const csfAdaEl = document.getElementById("csfAda");
            const csfChlorideEl = document.getElementById("csfChloride");
            const csfSgEl = document.getElementById("csfSg");
            const csfVolEl = document.getElementById("csfVol");
            const csfLdhEl = document.getElementById("csfLdh");
            const csfMicroalbuminEl = document.getElementById("csfMicroalbumin");
            const csfCellCountEl = document.getElementById("csfCellCount");
            const csfCellTypeEl = document.getElementById("csfCellType");
            const csfColourEl = document.getElementById("csfColour");
            const csfPhEl = document.getElementById("csfPh");
            const csfAppearanceEl = document.getElementById("csfAppearance");
            const csfCoagulumEl = document.getElementById("csfCoagulum");
            const csfDepositEl = document.getElementById("csfDeposit");

            if (csfAgeEl) csfAgeEl.value = patient.age;
            if (csfSexEl) {
                let csfSexVal = "Male";
                if (patient.sex.toLowerCase().startsWith("f")) csfSexVal = "Female";
                else if (patient.sex.toLowerCase().startsWith("m")) csfSexVal = "Male";
                else csfSexVal = "All";
                csfSexEl.value = csfSexVal;
            }
            if (csfProteinEl) csfProteinEl.value = raw.proteinval !== undefined ? raw.proteinval : 125;
            if (csfGlucoseEl) csfGlucoseEl.value = raw.glucoseval !== undefined ? raw.glucoseval : 63;
            if (csfAdaEl) csfAdaEl.value = raw.adaval !== undefined ? raw.adaval : 3.5;
            if (csfChlorideEl) csfChlorideEl.value = raw.chlorideval !== undefined ? raw.chlorideval : 102;
            if (csfSgEl) csfSgEl.value = raw.sgval !== undefined ? raw.sgval : 1.030;
            if (csfVolEl) csfVolEl.value = raw.volml !== undefined ? raw.volml : 10;
            if (csfLdhEl) csfLdhEl.value = raw.ldhval !== undefined ? raw.ldhval : 0;
            if (csfMicroalbuminEl) csfMicroalbuminEl.value = raw.microalbuminval !== undefined ? raw.microalbuminval : 0;
            if (csfCellCountEl) csfCellCountEl.value = raw.cellcount !== undefined ? raw.cellcount : 2;
            if (csfCellTypeEl) csfCellTypeEl.value = raw.cnssymptomencoded !== undefined ? raw.cnssymptomencoded : 0;
            if (csfColourEl) csfColourEl.value = raw.colourencoded !== undefined ? raw.colourencoded : 0;
            if (csfPhEl) csfPhEl.value = raw.phencoded !== undefined ? raw.phencoded : 1;
            if (csfAppearanceEl) csfAppearanceEl.value = raw.appearanceencoded !== undefined ? raw.appearanceencoded : 0;
            if (csfCoagulumEl) csfCoagulumEl.value = raw.coagullampresent !== undefined ? raw.coagullampresent : 0;
            if (csfDepositEl) csfDepositEl.value = raw.depositpresent !== undefined ? raw.depositpresent : 0;
        }

        // Flash inputs briefly to give clear visual feedback
        const fields = [patientAge, patientSex, patientCondition, patientMeds, patientHistory, patientLabs];
        fields.forEach(f => {
            f.style.borderColor = "var(--success)";
            f.style.boxShadow = "0 0 10px var(--success-bg)";
            setTimeout(() => {
                f.style.borderColor = "";
                f.style.boxShadow = "";
            }, 1200);
        });

        // Trigger prediction immediately!
        getMLPrediction();

        // Trigger trial search automatically if patient condition is set
        if (patient.condition && patient.condition !== "General Patient Condition") {
            let searchCond = patient.condition;
            if (searchCond.includes("(")) {
                searchCond = searchCond.split("(")[0].trim();
            }
            document.getElementById("conditionInput").value = searchCond;
            // Submit form to trigger search
            searchForm.dispatchEvent(new Event("submit"));
        }
    }

    // Process file contents
    function handleFile(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            try {
                const parsedRows = parseCSV(text);
                if (parsedRows.length <= 1) {
                    alert("The uploaded CSV file is empty or contains no records.");
                    return;
                }
                
                // Clean headers to normalize format
                const headers = parsedRows[0].map(h => h.replace(/["\r\n\s_]/g, '').toLowerCase());
                const rawPatients = [];
                
                for (let i = 1; i < parsedRows.length; i++) {
                    const row = parsedRows[i];
                    if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;
                    
                    const p = {};
                    headers.forEach((h, idx) => {
                        // Strip quotes if they surround the values
                        p[h] = row[idx] ? row[idx].replace(/^["']|["']$/g, '').trim() : "";
                    });
                    
                    if (Object.values(p).some(val => val !== "")) {
                        rawPatients.push(p);
                    }
                }
                
                if (rawPatients.length === 0) {
                    alert("No valid patient records could be extracted from the CSV.");
                    return;
                }
                
                state.parsedPatients = rawPatients.map((p, idx) => mapPatientData(p, idx));
                
                // Show dropdown selectors
                csvPatientSelector.classList.remove("hidden");
                csfCsvPatientSelector?.classList.remove("hidden");
                
                // Populate dropdown options
                csvPatientDropdown.innerHTML = "";
                if (csfCsvPatientDropdown) csfCsvPatientDropdown.innerHTML = "";
                state.parsedPatients.forEach((pat, idx) => {
                    const option1 = document.createElement("option");
                    option1.value = idx;
                    const condText = pat.condition.length > 25 ? pat.condition.substring(0, 25) + "..." : pat.condition;
                    option1.textContent = `${pat.id} (${pat.age}y, ${pat.sex}) - ${condText}`;
                    csvPatientDropdown.appendChild(option1);

                    if (csfCsvPatientDropdown) {
                        const option2 = document.createElement("option");
                        option2.value = idx;
                        option2.textContent = `${pat.id} (${pat.age}y, ${pat.sex}) - ${condText}`;
                        csfCsvPatientDropdown.appendChild(option2);
                    }
                });
                
                // Load first patient
                loadPatient(state.parsedPatients[0]);
                
            } catch (err) {
                console.error("Error parsing CSV:", err);
                alert("Failed to parse CSV file. Please make sure the format is correct.");
            }
        };
        reader.readAsText(file);
    }

    // Trigger file selection on click
    uploadCsvBtn.addEventListener("click", () => {
        csvFileInput.click();
    });

    csfUploadCsvBtn?.addEventListener("click", () => {
        csvFileInput.click();
    });

    csvFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    csvPatientDropdown.addEventListener("change", (e) => {
        const index = parseInt(e.target.value);
        if (state.parsedPatients[index]) {
            if (csfCsvPatientDropdown) csfCsvPatientDropdown.value = index;
            loadPatient(state.parsedPatients[index]);
        }
    });

    csfCsvPatientDropdown?.addEventListener("change", (e) => {
        const index = parseInt(e.target.value);
        if (state.parsedPatients[index]) {
            csvPatientDropdown.value = index;
            loadPatient(state.parsedPatients[index]);
        }
    });

    // Generate and download a sample CSV
    downloadSampleBtn.addEventListener("click", () => {
        const sampleCSVContent = "Age,Sex,Primary Condition,Current Medications,Medical History & Co-morbidities,Laboratory & Clinical Metrics\n" +
            "54,Male,Stage III Non-Small Cell Lung Cancer (NSCLC),Amlodipine 5mg daily; Metformin 500mg BID,\"Type 2 Diabetes, Hypertension. Prior left lower lobectomy. No prior immunotherapy.\",\"ECOG Performance Status: 1. EGFR mutation: Negative. ALK translocation: Negative.\"\n" +
            "68,Female,Congestive Heart Failure (NYHA Class III; HFrEF),Lisinopril 20mg; Carvedilol 12.5mg BID,\"Ischemic cardiomyopathy (EF 30%). History of MI (3 years ago) with stenting.\",\"NT-proBNP: 1850 pg/mL. Potassium: 4.2 mEq/L. Serum Creatinine: 1.4 mg/dL.\"\n";
            
        const blob = new Blob([sampleCSVContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "patient_profiles_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    csfDownloadSampleBtn?.addEventListener("click", () => {
        const link = document.createElement("a");
        link.setAttribute("href", "/sample_csf_patients.csv");
        link.setAttribute("download", "sample_csf_patients.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Setup Drag & Drop on Patient Profile Panel
    const patientProfilePanel = document.getElementById("patientProfilePanel");
    if (patientProfilePanel) {
        ['dragenter', 'dragover'].forEach(eventName => {
            patientProfilePanel.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                patientProfilePanel.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            patientProfilePanel.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                patientProfilePanel.classList.remove('drag-over');
            }, false);
        });

        patientProfilePanel.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    if (files[i].name.endsWith('.csv')) {
                        handleFile(files[i]);
                        break;
                    }
                }
            }
        }, false);
    }

    // Setup Drag & Drop on CSF Inputs Panel
    const csfInputsPanel = document.querySelector(".csf-inputs-panel");
    if (csfInputsPanel) {
        ['dragenter', 'dragover'].forEach(eventName => {
            csfInputsPanel.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                csfInputsPanel.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            csfInputsPanel.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                csfInputsPanel.classList.remove('drag-over');
            }, false);
        });

        csfInputsPanel.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    if (files[i].name.endsWith('.csv')) {
                        handleFile(files[i]);
                        break;
                    }
                }
            }
        }, false);
    }

    // Form Search Submission
    searchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Update patient profile object state
        state.patientProfile = {
            age: parseInt(patientAge.value),
            sex: patientSex.value,
            condition: patientCondition.value,
            medications: patientMeds.value,
            history: patientHistory.value,
            labs: patientLabs.value
        };

        // Get filter inputs
        const cond = document.getElementById("conditionInput").value;
        const loc = document.getElementById("locationInput").value;
        const phase = document.getElementById("phaseSelect").value;
        const status = document.getElementById("statusSelect").value;
        const ageGroup = document.getElementById("ageGroupSelect").value;
        const limit = document.getElementById("limitInput").value;

        // Show loading state
        emptyState.classList.add("hidden");
        trialsGrid.classList.add("hidden");
        loadingState.classList.remove("hidden");
        resultsCount.textContent = "Searching clinical trials...";

        try {
            // Build query params
            const params = new URLSearchParams();
            if (cond) params.append("condition", cond);
            if (loc) params.append("location", loc);
            if (phase) params.append("phase", phase);
            if (status) params.append("status", status);
            if (ageGroup) params.append("age_group", ageGroup);
            params.append("limit", limit);

            const res = await fetch(`/api/search?${params.toString()}`);
            const data = await res.json();
            
            state.trials = data.results || [];
            renderTrials();
        } catch (error) {
            console.error("Search failed:", error);
            resultsCount.textContent = "Search failed. Check console.";
            loadingState.classList.add("hidden");
            emptyState.classList.remove("hidden");
        }
    });

    // Render Trials Cards
    function renderTrials() {
        loadingState.classList.add("hidden");
        resultsCount.textContent = `${state.trials.length} trials found`;

        if (state.trials.length === 0) {
            emptyState.classList.remove("hidden");
            trialsGrid.classList.add("hidden");
            return;
        }

        trialsGrid.innerHTML = "";
        trialsGrid.classList.remove("hidden");

        state.trials.forEach(study => {
            const protocol = study.protocolSection || {};
            const idMod = protocol.identificationModule || {};
            const descMod = protocol.descriptionModule || {};
            const statusMod = protocol.statusModule || {};
            
            const nctId = idMod.nctId || "NCT unknown";
            const title = idMod.briefTitle || "No Title Provided";
            const summary = descMod.briefSummary || "No description available.";
            const phase = protocol.designModule?.phases?.[0] || "Phase N/A";
            const status = statusMod.overallStatus || "Unknown";

            // Card structure
            const card = document.createElement("div");
            card.className = "trial-card";
            card.dataset.nctId = nctId;

            // Compute status indicators
            const statusClass = status.toLowerCase() === "recruiting" ? "badge-status" : "";
            
            card.innerHTML = `
                <div class="trial-card-header">
                    <span class="trial-nct">${nctId}</span>
                    <div class="trial-badges">
                        <span class="badge badge-phase">${phase}</span>
                        <span class="badge ${statusClass}">${status}</span>
                    </div>
                </div>
                <h3>${title}</h3>
                <p>${summary}</p>
                <div class="trial-matching-indicator status-evaluating" id="indicator-${nctId}">
                    <span class="indicator-text">Eligibility check</span>
                    <span class="indicator-score">--</span>
                </div>
            `;

            // Click event to show drawer
            card.addEventListener("click", () => openTrialDrawer(study));
            trialsGrid.appendChild(card);
        });
    }

    // Set SVG score progress ring
    function setProgressRing(percent, strokeColor) {
        const radius = 28;
        const circumference = 2 * Math.PI * radius; // ~175.9
        const offset = circumference - (percent / 100) * circumference;
        
        drawerScoreFill.style.strokeDasharray = `${circumference} ${circumference}`;
        drawerScoreFill.style.strokeDashoffset = offset;
        drawerScoreFill.style.stroke = strokeColor;
    }

    // Open Trial Drawer Detail View
    async function openTrialDrawer(study) {
        state.selectedTrial = study;
        state.activeTab = "tab-overview";
        
        const protocol = study.protocolSection || {};
        const idMod = protocol.identificationModule || {};
        const statusMod = protocol.statusModule || {};
        const descMod = protocol.descriptionModule || {};
        const eligMod = protocol.eligibilityModule || {};
        const armsMod = protocol.armsInterventionsModule || {};
        
        const nctId = idMod.nctId || "NCT unknown";
        const title = idMod.briefTitle || "No Title Provided";
        const summary = descMod.briefSummary || "No description available.";
        const phase = protocol.designModule?.phases?.[0] || "Phase N/A";
        const status = statusMod.overallStatus || "Unknown";
        const criteria = eligMod.eligibilityCriteria || "No explicit criteria listed.";

        // Populate header fields
        drawerNctId.textContent = nctId;
        drawerTitle.textContent = title;
        drawerPhase.textContent = phase;
        drawerStatus.textContent = status;
        
        // Populate Overview Tab
        drawerBriefSummary.textContent = summary;
        drawerRawCriteria.textContent = criteria;

        // Conditions
        const conds = protocol.conditionsModule?.conditions || [];
        drawerConditions.innerHTML = conds.map(c => `<li>${c}</li>`).join("") || "<li>Not specified</li>";

        // Interventions
        const intervs = armsMod.interventions || [];
        drawerInterventions.innerHTML = intervs.map(i => `<li>${i.name} (${i.type || 'Treatment'})</li>`).join("") || "<li>Not specified</li>";

        // Reset Matching Tab States
        drawerMatchStatus.textContent = "EVALUATING...";
        drawerMatchScore.textContent = "--";
        setProgressRing(0, "var(--primary)");
        drawerMatchHero.className = "matching-status-hero";
        
        matchStatusHeadline.textContent = "Analyzing eligibility matching criteria...";
        matchReasoning.textContent = "Invoking Gemini clinical matching assistant. Please wait...";
        inclusionCriteriaList.innerHTML = "<li>Evaluating inclusion compatibility...</li>";
        exclusionCriteriaList.innerHTML = "<li>Evaluating exclusion hazards...</li>";
        matchNextSteps.textContent = "Assessment pending...";

        // Set Tab Buttons
        drawerTabs.forEach(t => t.classList.remove("active"));
        document.querySelector("[data-tab='tab-overview']").classList.add("active");
        
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
        document.getElementById("tab-overview").classList.add("active");

        // Reveal Drawer
        drawerOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden"; // Disable background scrolling

        // Trigger LLM Match API call asynchronously
        evaluatePatientMatching(nctId, study);
    }

    // Evaluate patient eligibility using Gemini Match API
    async function evaluatePatientMatching(nctId, study) {
        try {
            const body = {
                patient_profile: state.patientProfile,
                trial_details: study
            };

            const res = await fetch("/api/match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            
            if (data.status !== "success" || !data.evaluation) {
                throw new Error("Invalid response");
            }
            
            const evalResult = data.evaluation;
            
            // If the user has changed trials in the meantime, ignore this response
            if (state.selectedTrial?.protocolSection?.identificationModule?.nctId !== nctId) {
                return;
            }

            // Map variables
            const score = evalResult.matching_score || 0;
            const status = evalResult.status || "POTENTIALLY_ELIGIBLE";
            const reasoning = evalResult.reasoning || "";
            const inc = evalResult.inclusion_analysis || [];
            const exc = evalResult.exclusion_analysis || [];
            const steps = evalResult.next_steps || "";

            // Render Hero Indicator
            drawerMatchScore.textContent = `${score}%`;
            drawerMatchStatus.textContent = status.replace("_", " ");
            
            // Themes and colors
            let colorVar = "var(--warning)";
            let statusStyle = "potentially_eligible";
            
            if (status === "ELIGIBLE") {
                colorVar = "var(--success)";
                statusStyle = "eligible";
            } else if (status === "EXCLUDED") {
                colorVar = "var(--danger)";
                statusStyle = "excluded";
            }
            
            setProgressRing(score, colorVar);
            
            // Highlight Match Primary Card
            const cardPrimary = document.querySelector(".match-card-primary");
            cardPrimary.className = `match-card-primary ${statusStyle}`;
            matchStatusHeadline.textContent = `Match Result: ${status.replace("_", " ")}`;
            matchReasoning.textContent = reasoning;

            // Render List Items
            inclusionCriteriaList.innerHTML = inc.map(i => `<li>${i}</li>`).join("") || "<li>No analysis reported</li>";
            exclusionCriteriaList.innerHTML = exc.map(e => `<li>${e}</li>`).join("") || "<li>No analysis reported</li>";
            matchNextSteps.textContent = steps;

            // Update main card matching indicator in grid list
            const gridIndicator = document.getElementById(`indicator-${nctId}`);
            if (gridIndicator) {
                gridIndicator.className = `trial-matching-indicator status-${status.toLowerCase()}`;
                gridIndicator.querySelector(".indicator-score").textContent = `${score}%`;
                gridIndicator.querySelector(".indicator-text").textContent = status.replace("_", " ");
            }
        } catch (error) {
            console.error("Match evaluation failed:", error);
            matchReasoning.textContent = `Matching engine failed: ${error.message}`;
            drawerMatchStatus.textContent = "ERROR";
        }
    }

    // Load literature review tab
    async function loadLiteratureReview() {
        const study = state.selectedTrial;
        if (!study) return;

        const nctId = study.protocolSection?.identificationModule?.nctId;
        const arms = study.protocolSection?.armsInterventionsModule?.interventions || [];
        
        // Find the primary drug/treatment to search
        let query = "";
        const drugIntervs = arms.filter(a => a.type === "DRUG" || a.type === "BIOLOGICAL");
        if (drugIntervs.length > 0) {
            query = drugIntervs[0].name;
        } else if (arms.length > 0) {
            query = arms[0].name;
        } else {
            // Fallback to primary condition search if no interventions
            const conds = study.protocolSection?.conditionsModule?.conditions || [];
            query = conds.length > 0 ? conds[0] : "";
        }

        if (!query) {
            litContent.classList.add("hidden");
            litLoading.classList.remove("hidden");
            litLoading.innerHTML = `<p>No interventions found to search PubMed for.</p>`;
            return;
        }

        litContent.classList.add("hidden");
        litLoading.classList.remove("hidden");
        litLoading.innerHTML = `<div class="spinner"></div><p>Searching PubMed and summarizing papers for: <strong>${query}</strong>...</p>`;

        try {
            const res = await fetch(`/api/literature?query=${encodeURIComponent(query)}`);
            const data = await res.json();
            
            // Verify user hasn't switched trials since request started
            if (state.selectedTrial?.protocolSection?.identificationModule?.nctId !== nctId) {
                return;
            }

            litLoading.classList.add("hidden");
            litContent.classList.remove("hidden");

            const summary = data.summary || {};
            const articles = data.articles || [];

            // Populate summaries
            litSummaryText.textContent = summary.clinical_summary || "No summary generated.";
            litEfficacyText.textContent = summary.efficacy || "No efficacy analysis.";
            litSafetyText.textContent = summary.safety_adverse_events || "No safety analysis.";
            litConclusionText.textContent = summary.conclusion || "No conclusion.";

            // Render articles list
            if (articles.length === 0) {
                litPapersList.innerHTML = `<div class="paper-item"><p>No relevant papers found on PubMed for ${query}.</p></div>`;
                return;
            }

            litPapersList.innerHTML = "";
            articles.forEach(art => {
                const paperItem = document.createElement("div");
                paperItem.className = "paper-item";
                
                const pmid = art.pmid || "";
                const title = art.title || "Untitled Paper";
                const authors = art.authors ? art.authors.slice(0, 3).join(", ") + (art.authors.length > 3 ? " et al." : "") : "Unknown Authors";
                const journal = art.journal || "Unknown Journal";
                const pubDate = art.pubdate || "Unknown Date";

                paperItem.innerHTML = `
                    <h5>${title}</h5>
                    <span class="paper-meta">${authors} | <em>${journal}</em>, ${pubDate} (PMID: ${pmid})</span>
                    <a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" class="paper-link">
                        <span>Read on PubMed</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
                    </a>
                `;
                litPapersList.appendChild(paperItem);
            });

        } catch (error) {
            console.error("Literature load failed:", error);
            litLoading.classList.add("hidden");
            litContent.classList.remove("hidden");
            litSummaryText.textContent = `Literature synthesis failed: ${error.message}`;
            litPapersList.innerHTML = "<p>Failed to load references.</p>";
        }
    }

    // Close Drawer
    function closeDrawer() {
        drawerOverlay.classList.add("hidden");
        document.body.style.overflow = ""; // Enable body scroll
        state.selectedTrial = null;
    }

    closeDrawerBtn.addEventListener("click", closeDrawer);
    
    // Close Drawer when clicking background overlay
    drawerOverlay.addEventListener("click", (e) => {
        if (e.target === drawerOverlay) {
            closeDrawer();
        }
    });

    // Tabs Event Listeners
    drawerTabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            const tabId = e.target.getAttribute("data-tab");
            
            // Set Active class on tab buttons
            drawerTabs.forEach(t => t.classList.remove("active"));
            e.target.classList.add("active");
            
            // Show Active Tab Pane
            document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
            document.getElementById(tabId).classList.add("active");
            
            state.activeTab = tabId;

            // Trigger literature synthesis if switching to the tab
            if (tabId === "tab-literature") {
                loadLiteratureReview();
            }
        });
    });

    // ==========================================
    // Navigation / View Swapping Logic
    // ==========================================
    const navTabs = document.querySelectorAll(".nav-tab");
    const pageViews = document.querySelectorAll(".page-view");

    navTabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            // Traverse up to find button if click landed on svg/span
            const targetTab = e.target.closest(".nav-tab");
            if (!targetTab) return;

            const targetViewId = targetTab.getAttribute("data-view");
            if (!targetViewId) return;

            // Update active class in navigation tabs
            navTabs.forEach(t => t.classList.remove("active"));
            targetTab.classList.add("active");

            // Hide all page views and show the target page view
            pageViews.forEach(view => {
                if (view.id === targetViewId) {
                    view.classList.remove("hidden");
                } else {
                    view.classList.add("hidden");
                }
            });

            // Trigger prediction immediately if switching to diagnostics page
            if (targetViewId === "csfDiagnosticsPage") {
                getCSFDiagnosticsAndMatches();
            }
        });
    });

    // ==========================================
    // CSF Case Matcher & Predictor Logic
    // ==========================================
    const csfDiagForm = document.getElementById("csfDiagForm");
    
    // Select all inputs inside csfDiagForm to bind listener
    const csfInputs = [
        document.getElementById("csfAge"),
        document.getElementById("csfSex"),
        document.getElementById("csfProtein"),
        document.getElementById("csfGlucose"),
        document.getElementById("csfAda"),
        document.getElementById("csfChloride"),
        document.getElementById("csfSg"),
        document.getElementById("csfVol"),
        document.getElementById("csfLdh"),
        document.getElementById("csfMicroalbumin"),
        document.getElementById("csfCellCount"),
        document.getElementById("csfCellType"),
        document.getElementById("csfColour"),
        document.getElementById("csfPh"),
        document.getElementById("csfAppearance"),
        document.getElementById("csfCoagulum"),
        document.getElementById("csfDeposit")
    ];

    const csfMlModeBadge = document.getElementById("csfMlModeBadge");
    const csfMlPredictionValue = document.getElementById("csfMlPredictionValue");
    const csfMlConfidenceValue = document.getElementById("csfMlConfidenceValue");
    const csfMlProbabilitiesList = document.getElementById("csfMlProbabilitiesList");
    const csfCasesDeck = document.getElementById("csfCasesDeck");

    // Reference range flag list items
    const flagProtein = document.getElementById("flagProtein");
    const flagGlucose = document.getElementById("flagGlucose");
    const flagAda = document.getElementById("flagAda");
    const flagChloride = document.getElementById("flagChloride");
    
    const flagProteinIcon = document.getElementById("flagProteinIcon");
    const flagGlucoseIcon = document.getElementById("flagGlucoseIcon");
    const flagAdaIcon = document.getElementById("flagAdaIcon");
    const flagChlorideIcon = document.getElementById("flagChlorideIcon");

    // Helper text mappings
    function getColourText(val) {
        val = parseInt(val);
        if (val === 0) return "Colourless";
        if (val === 1) return "Straw/Yellow";
        if (val === 2) return "Whitish/Grayish";
        if (val === 3) return "Reddish/Pinkish";
        return "Unknown";
    }

    function getAppearanceText(val) {
        val = parseInt(val);
        if (val === 0) return "Clear";
        if (val === 1) return "Slightly Hazy";
        if (val === 2) return "Hazy";
        if (val === 3) return "Turbid";
        return "Unknown";
    }

    function getPhText(val) {
        val = parseInt(val);
        if (val === 1) return "Neutral";
        if (val === 2) return "Alkaline";
        return "Unknown";
    }

    function getCellTypeText(val) {
        val = parseInt(val);
        if (val === 0) return "Lymphocytes 100%";
        if (val === 1) return "Predominantly Lympho";
        if (val === 2) return "Mixed (Lympho+Poly)";
        if (val === 3) return "RBC Present";
        return "Unknown";
    }

    // Function to calculate and render predictions + similar cases
    async function getCSFDiagnosticsAndMatches() {
        // Collect current input values
        const protein = parseFloat(document.getElementById("csfProtein").value) || 0;
        const glucose = parseFloat(document.getElementById("csfGlucose").value) || 0;
        const ada = parseFloat(document.getElementById("csfAda").value) || 0;
        const chloride = parseFloat(document.getElementById("csfChloride").value) || 0;
        const sg = parseFloat(document.getElementById("csfSg").value) || 1.000;
        const vol = parseFloat(document.getElementById("csfVol").value) || 0;
        const ldh = parseFloat(document.getElementById("csfLdh").value) || 0;
        const microalbumin = parseFloat(document.getElementById("csfMicroalbumin").value) || 0;
        const cellcount = parseFloat(document.getElementById("csfCellCount").value) || 0;
        const celltype = parseInt(document.getElementById("csfCellType").value) || 0;
        const colour = parseInt(document.getElementById("csfColour").value) || 0;
        const ph = parseInt(document.getElementById("csfPh").value) || 1;
        const appearance = parseInt(document.getElementById("csfAppearance").value) || 0;
        const coagulum = parseInt(document.getElementById("csfCoagulum").value) || 0;
        const deposit = parseInt(document.getElementById("csfDeposit").value) || 0;
        const age = parseFloat(document.getElementById("csfAge").value) || 45;
        const sex = document.getElementById("csfSex").value;

        // Build feature dictionary
        const rawFeatures = {
            proteinval: protein,
            glucoseval: glucose,
            adaval: ada,
            chlorideval: chloride,
            ldhval: ldh,
            microalbuminval: microalbumin,
            volml: vol,
            sgval: sg,
            colourencoded: colour,
            phencoded: ph,
            appearanceencoded: appearance,
            coagullampresent: coagulum,
            depositpresent: deposit,
            cnssymptomencoded: celltype,
            cellcount: cellcount
        };

        const patientProfile = {
            age: age,
            sex: sex,
            condition: "Suspected CNS Infection",
            medications: "None",
            history: `Cell Type Encoding (CNS Symptom Class): ${celltype}`,
            labs: `CSF Protein: ${protein}. Glucose: ${glucose}. ADA: ${ada}. Specific Gravity: ${sg}. Chloride: ${chloride}. Volume: ${vol}. LDH: ${ldh}. Microalbumin: ${microalbumin}. Colour: ${colour}. Appearance: ${appearance}. pH: ${ph}. Coagulum: ${coagulum}. Deposit: ${deposit}`,
            raw_features: rawFeatures
        };

        // Set UI loading status
        csfMlModeBadge.className = "badge badge-ml-status loading";
        csfMlModeBadge.textContent = "ML: Evaluating...";
        
        // 1. Update clinical flag check visual states in UI
        updateFlagUI(flagProtein, flagProteinIcon, protein > 50, "Protein > 50 mg/dL");
        updateFlagUI(flagGlucose, flagGlucoseIcon, (glucose > 0 && glucose < 40), "Glucose < 40 mg/dL");
        updateFlagUI(flagAda, flagAdaIcon, ada > 9, "ADA > 9 U/L");
        updateFlagUI(flagChloride, flagChlorideIcon, (chloride > 0 && chloride < 110), "Chloride < 110 mmol/L");

        try {
            // Trigger parallel fetch for prediction and similarity matching
            const [predRes, simRes] = await Promise.all([
                fetch("/api/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ patient_profile: patientProfile })
                }),
                fetch("/api/similar-cases", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ patient_profile: patientProfile })
                })
            ]);

            const predData = await predRes.json();
            const simData = await simRes.json();

            // 2. Render classification outputs
            if (predData.status === "success") {
                const pred = predData.prediction;
                const probs = predData.probabilities || [];
                const mode = predData.mode || "live";

                csfMlModeBadge.className = `badge badge-ml-status ${mode.startsWith("live") ? 'live' : 'simulated'}`;
                csfMlModeBadge.textContent = mode.startsWith("live") ? "ML: Live Model" : "ML: Simulated";

                csfMlPredictionValue.textContent = pred.label;
                csfMlConfidenceValue.textContent = `${pred.confidence}%`;

                // Render progress bars
                csfMlProbabilitiesList.innerHTML = "";
                probs.forEach(([label, percent]) => {
                    const item = document.createElement("div");
                    item.className = "ml-probability-item";
                    item.innerHTML = `
                        <span class="ml-class-label" title="${label}">${label}</span>
                        <div class="ml-progress-bg">
                            <div class="ml-progress-fill" style="width: 0%;"></div>
                        </div>
                        <span class="ml-class-percent">${percent}%</span>
                    `;
                    csfMlProbabilitiesList.appendChild(item);
                    setTimeout(() => {
                        const fill = item.querySelector(".ml-progress-fill");
                        if (fill) fill.style.width = `${percent}%`;
                    }, 50);
                });
            } else {
                throw new Error("Prediction API error");
            }

            // 3. Render database similarity case match cards (ensuring patient privacy)
            if (simData.status === "success" && simData.results) {
                const matches = simData.results;
                csfCasesDeck.innerHTML = "";

                if (matches.length === 0) {
                    csfCasesDeck.innerHTML = `<div class="empty-state"><p>No matching database cases found.</p></div>`;
                    return;
                }

                matches.forEach((c, idx) => {
                    const card = document.createElement("div");
                    // Expand the top match by default to make the UI look rich, collapse the rest
                    card.className = `similar-case-card ${idx === 0 ? "" : "collapsed"}`;
                    
                    const queryVals = {
                        protein: protein,
                        glucose: glucose,
                        ada: ada,
                        chloride: chloride,
                        sg: sg,
                        vol: vol,
                        colour: colour,
                        ph: ph,
                        appearance: appearance,
                        coagulum: coagulum,
                        deposit: deposit,
                        celltype: celltype,
                        cellcount: cellcount
                    };

                    card.innerHTML = `
                        <!-- Case Header -->
                        <div class="case-header">
                            <div class="case-header-left">
                                <span class="case-pid">${c.pid}</span>
                                <span class="case-demographics">${c.age}y, ${c.sex}</span>
                                <span class="case-final-diag">Final Diagnosis: ${c.diagnosis}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span class="similarity-badge">${c.similarity}% Match</span>
                                <div class="case-chevron">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Case Body -->
                        <div class="case-body">
                            <!-- Metric comparison table -->
                            <div class="comparison-table-wrapper">
                                <table class="comparison-table">
                                    <thead>
                                        <tr>
                                            <th>Metric</th>
                                            <th>Input Patient</th>
                                            <th>Matched Case (${c.pid})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Microprotein</td>
                                            <td>${queryVals.protein} mg/dL</td>
                                            <td class="${Math.abs(queryVals.protein - c.metrics.proteinval) < 15 ? 'matched' : 'mismatched'}">${c.metrics.proteinval} mg/dL</td>
                                        </tr>
                                        <tr>
                                            <td>Glucose</td>
                                            <td>${queryVals.glucose} mg/dL</td>
                                            <td class="${Math.abs(queryVals.glucose - c.metrics.glucoseval) < 5 ? 'matched' : 'mismatched'}">${c.metrics.glucoseval} mg/dL</td>
                                        </tr>
                                        <tr>
                                            <td>ADA</td>
                                            <td>${queryVals.ada} U/L</td>
                                            <td class="${Math.abs(queryVals.ada - c.metrics.adaval) < 3 ? 'matched' : 'mismatched'}">${c.metrics.adaval} U/L</td>
                                        </tr>
                                        <tr>
                                            <td>Chloride</td>
                                            <td>${queryVals.chloride} mmol/L</td>
                                            <td class="${c.metrics.chlorideval > 0 ? (Math.abs(queryVals.chloride - c.metrics.chlorideval) < 8 ? 'matched' : 'mismatched') : ''}">${c.metrics.chlorideval > 0 ? c.metrics.chlorideval + ' mmol/L' : 'Not Measured'}</td>
                                        </tr>
                                        <tr>
                                            <td>Specific Gravity</td>
                                            <td>${queryVals.sg.toFixed(3)}</td>
                                            <td class="${Math.abs(queryVals.sg - c.metrics.sgval) < 0.003 ? 'matched' : 'mismatched'}">${c.metrics.sgval.toFixed(3)}</td>
                                        </tr>
                                        <tr>
                                            <td>Cell Count</td>
                                            <td>${queryVals.cellcount} cu.mm</td>
                                            <td class="${Math.abs(queryVals.cellcount - c.metrics.cellcount) < 20 ? 'matched' : 'mismatched'}">${c.metrics.cellcount} cu.mm</td>
                                        </tr>
                                        <tr>
                                            <td>Cell Type Predominant</td>
                                            <td>${getCellTypeText(queryVals.celltype)}</td>
                                            <td class="${queryVals.celltype === c.metrics.cnssymptomencoded ? 'matched' : 'mismatched'}">${c.metrics.celltype_raw || getCellTypeText(c.metrics.cnssymptomencoded)}</td>
                                        </tr>
                                        <tr>
                                            <td>Colour Findings</td>
                                            <td>${getColourText(queryVals.colour)}</td>
                                            <td class="${queryVals.colour === c.metrics.colourencoded ? 'matched' : 'mismatched'}">${getColourText(c.metrics.colourencoded)}</td>
                                        </tr>
                                        <tr>
                                            <td>Appearance</td>
                                            <td>${getAppearanceText(queryVals.appearance)}</td>
                                            <td class="${queryVals.appearance === c.metrics.appearanceencoded ? 'matched' : 'mismatched'}">${getAppearanceText(c.metrics.appearanceencoded)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            <!-- Collapsible narratives from log book -->
                            <div class="narratives-box">
                                <div class="narrative-item">
                                    <h5>Reason for Admission</h5>
                                    <p>${c.reason_for_admission && c.reason_for_admission !== 'nan' && c.reason_for_admission.trim() !== '' ? c.reason_for_admission : 'Not documented in log book.'}</p>
                                </div>
                                <div class="narrative-item" style="margin-top: 8px;">
                                    <h5>Hospital Clinical Course & Treatment</h5>
                                    <p>${c.hospital_course && c.hospital_course !== 'nan' && c.hospital_course.trim() !== '' ? c.hospital_course : 'Treated conservatively. Details not annotated.'}</p>
                                </div>
                            </div>
                        </div>
                    `;

                    // Bind toggle accordion action
                    card.querySelector(".case-header").addEventListener("click", () => {
                        card.classList.toggle("collapsed");
                    });

                    csfCasesDeck.appendChild(card);
                });
            }

        } catch (error) {
            console.error("CSF match API error:", error);
            csfMlModeBadge.className = "badge badge-ml-status simulated";
            csfMlModeBadge.textContent = "ML: Error";
            csfMlPredictionValue.textContent = "Evaluation Error";
            csfMlConfidenceValue.textContent = "--";
        }
    }

    // Helper to update check items visual styles
    function updateFlagUI(container, iconContainer, isFlagged, text) {
        if (isFlagged) {
            container.className = "check-item flagged";
            iconContainer.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
            `;
        } else {
            container.className = "check-item normal";
            iconContainer.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3"/></svg>
            `;
        }
    }

    // Bind event listeners to auto-trigger matching on any input value change
    csfInputs.forEach(input => {
        if (input) {
            input.addEventListener("change", getCSFDiagnosticsAndMatches);
            // Also listen to keyup for smoother real-time update feel on numbers
            if (input.tagName === "INPUT" && input.type === "number") {
                input.addEventListener("input", getCSFDiagnosticsAndMatches);
            }
        }
    });

    // CSF Template loaders
    const csfTemplates = {
        normal: { age: 45, sex: "Male", protein: 30, glucose: 60, ada: 3.0, chloride: 120, sg: 1.006, vol: 10, ldh: 10, microalbumin: 8, cellcount: 2, celltype: "0", colour: "0", ph: "1", appearance: "0", coagulum: "0", deposit: "0" },
        bacterial: { age: 45, sex: "Male", protein: 300, glucose: 15, ada: 6.0, chloride: 112, sg: 1.018, vol: 10, ldh: 120, microalbumin: 60, cellcount: 1500, celltype: "2", colour: "2", ph: "1", appearance: "3", coagulum: "1", deposit: "1" },
        viral: { age: 45, sex: "Male", protein: 75, glucose: 55, ada: 4.0, chloride: 120, sg: 1.008, vol: 10, ldh: 18, microalbumin: 12, cellcount: 150, celltype: "1", colour: "0", ph: "1", appearance: "0", coagulum: "0", deposit: "0" },
        tbm: { age: 45, sex: "Male", protein: 220, glucose: 20, ada: 22.0, chloride: 95, sg: 1.015, vol: 10, ldh: 45, microalbumin: 35, cellcount: 250, celltype: "1", colour: "1", ph: "1", appearance: "1", coagulum: "1", deposit: "1" },
        fungal: { age: 45, sex: "Male", protein: 75, glucose: 45, ada: 5.0, chloride: 115, sg: 1.008, vol: 10, ldh: 35, microalbumin: 25, cellcount: 30, celltype: "1", colour: "1", ph: "1", appearance: "1", coagulum: "0", deposit: "0" }
    };

    function loadCsfTemplate(type) {
        const t = csfTemplates[type];
        if (!t) return;
        
        document.getElementById("csfAge").value = t.age;
        document.getElementById("csfSex").value = t.sex;
        document.getElementById("csfProtein").value = t.protein;
        document.getElementById("csfGlucose").value = t.glucose;
        document.getElementById("csfAda").value = t.ada;
        document.getElementById("csfChloride").value = t.chloride;
        document.getElementById("csfSg").value = t.sg;
        document.getElementById("csfVol").value = t.vol;
        document.getElementById("csfLdh").value = t.ldh;
        document.getElementById("csfMicroalbumin").value = t.microalbumin;
        document.getElementById("csfCellCount").value = t.cellcount;
        document.getElementById("csfCellType").value = t.celltype;
        document.getElementById("csfColour").value = t.colour;
        document.getElementById("csfPh").value = t.ph;
        document.getElementById("csfAppearance").value = t.appearance;
        document.getElementById("csfCoagulum").value = t.coagulum;
        document.getElementById("csfDeposit").value = t.deposit;
        
        // Trigger diagnostic calculation
        getCSFDiagnosticsAndMatches();
    }

    document.getElementById("loadCsfNormal")?.addEventListener("click", () => loadCsfTemplate("normal"));
    document.getElementById("loadCsfBacterial")?.addEventListener("click", () => loadCsfTemplate("bacterial"));
    document.getElementById("loadCsfViral")?.addEventListener("click", () => loadCsfTemplate("viral"));
    document.getElementById("loadCsfTbm")?.addEventListener("click", () => loadCsfTemplate("tbm"));
    document.getElementById("loadCsfFungal")?.addEventListener("click", () => loadCsfTemplate("fungal"));

    // Populate initial default search and run ML predictions on load
    getMLPrediction();
    getCSFDiagnosticsAndMatches();
    searchForm.dispatchEvent(new Event("submit"));
});
