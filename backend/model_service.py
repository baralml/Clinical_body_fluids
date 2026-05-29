import os
import json
import re
import joblib
import logging
import pandas as pd

logger = logging.getLogger("model_service")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "cns_model.joblib")
FEATURES_PATH = os.path.join(BASE_DIR, "model_features.json")

class ModelService:
    def _clean_header(self, name: str) -> str:
        return re.sub(r'[^a-zA-Z]', '', str(name)).lower()

    def __init__(self):
        self.model = None
        self.features = []
        self.classes = {}
        
        if os.path.exists(MODEL_PATH) and os.path.exists(FEATURES_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                with open(FEATURES_PATH, "r") as f:
                    meta = json.load(f)
                    self.features = meta.get("features", [])
                    self.classes = meta.get("classes", {})
                logger.info("ML Model and metadata loaded successfully.")
            except Exception as e:
                logger.exception("Failed to load ML Model:")
        else:
            logger.warning("ML Model files not found. ModelService running in simulated mode.")

        # Load datasets for similarity matching
        self.clean_df = None
        self.raw_df = None
        clean_path = os.path.join(BASE_DIR, "..", "csfdata.csv")
        raw_path = os.path.join(BASE_DIR, "..", "Raw Data From Log Book CSF.csv")
        
        if os.path.exists(clean_path) and os.path.exists(raw_path):
            try:
                self.clean_df = pd.read_csv(clean_path)
                self.raw_df = pd.read_csv(raw_path)
                
                # Standardize headers
                self.clean_df.columns = [self._clean_header(c) for c in self.clean_df.columns]
                self.raw_df.columns = [self._clean_header(c) for c in self.raw_df.columns]
                
                # Align and merge cellcount & raw index mapping
                def parse_numeric(val):
                    if pd.isna(val): return 0.0
                    val_str = str(val).strip().lower()
                    if val_str in ['nil', 'absent', '', 'nan', 'none', 'nilcumm']: return 0.0
                    if val_str == 'low': return 1.0
                    match_lt = re.search(r'<\s*([\d.]+)', val_str)
                    if match_lt:
                        num = float(match_lt.group(1))
                        if abs(num - 25.0) < 0.01: return 1.0
                        return num / 2.0
                    match_num = re.search(r'([\d.]+)', val_str)
                    if match_num: return float(match_num.group(1))
                    return 0.0
                
                df2_parsed = []
                for idx2, row2 in self.raw_df.iterrows():
                    df2_parsed.append({
                        'p': parse_numeric(row2['microproteinmgdl']),
                        'g': parse_numeric(row2['glucosemgdl']),
                        'sg': parse_numeric(row2['specificgravity']),
                        'vol': parse_numeric(row2['volml']),
                        'ada': parse_numeric(row2['adaul']),
                        'cl': parse_numeric(row2['chloridemmoll']),
                        'ldh': parse_numeric(row2['ldhul']),
                        'cc': parse_numeric(row2['cellcountcumm'])
                    })
                    
                cellcounts = []
                raw_indices = []
                prev_idx2 = -1
                for idx1, row1 in self.clean_df.iterrows():
                    p1 = float(row1['proteinval'])
                    g1 = float(row1['glucoseval'])
                    sg1 = float(row1['sgval'])
                    vol1 = float(row1['volml'])
                    ada1 = float(row1['adaval'])
                    cl1 = float(row1['chlorideval'])
                    ldh1 = float(row1['ldhval'])
                    
                    found = False
                    for idx2 in range(prev_idx2 + 1, len(self.raw_df)):
                        row2 = df2_parsed[idx2]
                        
                        score = 0
                        if abs(p1 - row2['p']) < 0.1: score += 1
                        if abs(g1 - row2['g']) < 0.1 or (p1 == 234.6 and g1 == 0.0 and row2['g'] == 0.0): score += 1
                        if abs(sg1 - row2['sg']) < 0.005: score += 1
                        if abs(vol1 - row2['vol']) < 0.1: score += 1
                        if abs(ada1 - row2['ada']) < 0.1: score += 1
                        if abs(cl1 - row2['cl']) < 0.1: score += 1
                        if abs(ldh1 - row2['ldh']) < 0.1: score += 1
                        
                        if score >= 4:
                            cellcounts.append(row2['cc'])
                            raw_indices.append(idx2)
                            prev_idx2 = idx2
                            found = True
                            break
                            
                    if not found:
                        cellcounts.append(0.0)
                        raw_indices.append(idx1)
                        
                self.clean_df['cellcount'] = cellcounts
                self.clean_df['rawidx'] = raw_indices
                
                # Precompute min and max for numerical features for scaling
                self.numeric_weights = {
                    'proteinval': 2.0,
                    'glucoseval': 2.0,
                    'adaval': 2.0,
                    'chlorideval': 1.5,
                    'ldhval': 0.5,
                    'microalbuminval': 0.5,
                    'volml': 0.5,
                    'sgval': 0.5,
                    'cellcount': 1.5
                }
                self.min_max = {}
                for feat in self.numeric_weights:
                    self.clean_df[feat] = pd.to_numeric(self.clean_df[feat], errors='coerce').fillna(0.0)
                    min_val = self.clean_df[feat].min()
                    max_val = self.clean_df[feat].max()
                    self.min_max[feat] = (min_val, max_val, max_val - min_val if max_val - min_val > 0 else 1.0)
                    
                logger.info("Similarity search datasets and min-max bounds loaded successfully.")
            except Exception as e:
                logger.exception("Failed to load similarity search datasets:")

    def _extract_labs_from_text(self, labs_str: str) -> dict:
        labs_str = str(labs_str).lower()
        
        # Defaults
        protein = 0.0
        glucose = 0.0
        ada = 0.0
        ldh = 0.0
        microalbumin = 0.0
        chloride = 0.0
        vol = 0.0
        sg = 1.000
        colour = 0
        ph = 1
        appearance = 0
        coagulum = 0
        deposit = 0
        cellcount = 0.0
        
        # Regex helpers
        # CSF Protein
        p_match = re.search(r'(?:csf protein|protein)(?::|\s|=)\s*([\d.]+)', labs_str)
        if p_match: protein = float(p_match.group(1).rstrip('.'))
        
        # Glucose
        g_match = re.search(r'glucose(?::|\s|=)\s*([\d.]+)', labs_str)
        if g_match: glucose = float(g_match.group(1).rstrip('.'))
        
        # ADA
        ada_match = re.search(r'ada(?::|\s|=)\s*([\d.]+)', labs_str)
        if ada_match: ada = float(ada_match.group(1).rstrip('.'))
        
        # LDH
        ldh_match = re.search(r'ldh(?::|\s|=)\s*([\d.]+)', labs_str)
        if ldh_match: ldh = float(ldh_match.group(1).rstrip('.'))
        
        # Microalbumin
        ma_match = re.search(r'microalbumin(?::|\s|=)\s*([\d.]+)', labs_str)
        if ma_match: microalbumin = float(ma_match.group(1).rstrip('.'))
        
        # Chloride
        cl_match = re.search(r'chloride(?::|\s|=)\s*([\d.]+)', labs_str)
        if cl_match: chloride = float(cl_match.group(1).rstrip('.'))
        
        # Specific Gravity
        sg_match = re.search(r'(?:specific gravity|sg)(?::|\s|=)\s*([\d.]+)', labs_str)
        if sg_match: sg = float(sg_match.group(1).rstrip('.'))
        
        # Vol
        vol_match = re.search(r'(?:vol|volume)(?::|\s|=)\s*([\d.]+)', labs_str)
        if vol_match: vol = float(vol_match.group(1).rstrip('.'))
        
        # Colour code or word
        c_match = re.search(r'colour(?:less|ed)?(?: code)?(?::|\s|=)\s*([a-z0-9/_-]+)', labs_str)
        if c_match:
            val = c_match.group(1)
            if val.isdigit():
                colour = int(val)
            else:
                if 'colourless' in val or 'colorless' in val or 'watery' in val: colour = 0
                elif 'straw' in val or 'yellow' in val or 'pale' in val: colour = 1
                elif any(w in val for w in ['whitish', 'grayish', 'greyish', 'xanthochromic', 'white', 'gray', 'grey']): colour = 2
                elif any(w in val for w in ['reddish', 'pinkish', 'pink', 'red', 'blood']): colour = 3
        else:
            if 'colourless' in labs_str or 'colorless' in labs_str or 'watery' in labs_str: colour = 0
            elif 'straw' in labs_str or 'yellow' in labs_str: colour = 1
            elif any(w in labs_str for w in ['whitish', 'grayish', 'greyish', 'xanthochromic']): colour = 2
            elif any(w in labs_str for w in ['reddish', 'pinkish', 'blood']): colour = 3
        
        # pH code or word
        ph_match = re.search(r'ph(?: code)?(?::|\s|=)\s*([a-z0-9./_-]+)', labs_str)
        if ph_match:
            val = ph_match.group(1)
            if val.isdigit():
                ph = int(val)
            else:
                if 'neutral' in val or '7.0' in val or val == '7': ph = 1
                elif 'alkaline' in val or '7.5' in val or '8' in val: ph = 2
        else:
            if 'ph: neutral' in labs_str or 'ph neutral' in labs_str: ph = 1
            elif 'ph: alkaline' in labs_str or 'ph alkaline' in labs_str: ph = 2
        
        # Appearance code or word
        app_match = re.search(r'appearance(?: code)?(?::|\s|=)\s*([a-z0-9/_-]+)', labs_str)
        if app_match:
            val = app_match.group(1)
            if val.isdigit():
                appearance = int(val)
            else:
                if 'clear' in val: appearance = 0
                elif 'slight' in val: appearance = 1
                elif 'hazy' in val: appearance = 2
                elif 'turbid' in val: appearance = 3
        else:
            if 'clear' in labs_str: appearance = 0
            elif 'slight' in labs_str: appearance = 1
            elif 'hazy' in labs_str: appearance = 2
            elif 'turbid' in labs_str: appearance = 3
        
        # Coagulum
        coag_match = re.search(r'coagulum(?::|\s|=)\s*(\w+)', labs_str)
        if coag_match:
            val = coag_match.group(1)
            if val.isdigit():
                coagulum = int(val)
            else:
                coagulum = 1 if 'present' in val or 'yes' in val else 0
        else:
            if 'coagulum: present' in labs_str or 'coagulum present' in labs_str: coagulum = 1
            elif 'coagulum: absent' in labs_str or 'coagulum absent' in labs_str: coagulum = 0
            
        # Deposit
        dep_match = re.search(r'deposit(?::|\s|=)\s*(\w+)', labs_str)
        if dep_match:
            val = dep_match.group(1)
            if val.isdigit():
                deposit = int(val)
            else:
                deposit = 1 if 'present' in val or 'yes' in val else 0
        else:
            if 'deposit: present' in labs_str or 'deposit present' in labs_str: deposit = 1
            elif 'deposit: absent' in labs_str or 'deposit absent' in labs_str: deposit = 0
  
        # Cell count
        cc_match = re.search(r'(?:cell count|cellcount)(?::|\s|=)\s*(<\s*[\d.]+|[\d.]+)', labs_str)
        if cc_match:
            cc_val_str = cc_match.group(1).strip()
            if cc_val_str.startswith('<'):
                try:
                    num = float(re.search(r'([\d.]+)', cc_val_str).group(1))
                    cellcount = num / 2.0
                except:
                    cellcount = 0.0
            else:
                try:
                    cellcount = float(cc_val_str)
                except:
                    cellcount = 0.0
        
        return {
            'proteinval': protein,
            'glucoseval': glucose,
            'adaval': ada,
            'ldhval': ldh,
            'microalbuminval': microalbumin,
            'chlorideval': chloride,
            'volml': vol,
            'sgval': sg,
            'colourencoded': colour,
            'phencoded': ph,
            'appearanceencoded': appearance,
            'coagullampresent': coagulum,
            'depositpresent': deposit,
            'cellcount': cellcount
        }
 
    def _extract_symptoms_from_text(self, history_str: str) -> int:
        history_str = str(history_str).lower()
        match = re.search(r'(?:cell type encoding|cns symptom class|cell type|symptom class)(?::|\s|=)\s*([a-z0-9/_+% -]+)', history_str)
        if match:
            val = match.group(1).strip()
            if val.isdigit():
                return int(val)
            else:
                if '100%' in val or 'only' in val or 'lymphocytes only' in val: return 0
                elif 'predominantly' in val or 'predominant' in val: return 1
                elif 'mixed' in val or 'poly' in val or 'polymorphs' in val: return 2
                elif 'rbc' in val or 'hemorrhagic' in val or 'haemorrhagic' in val: return 3
        # Fallback keyword search
        if 'lymphocytes only' in history_str or '100% lympho' in history_str:
            return 0
        elif 'predominantly lymphocytes' in history_str or 'predominant lympho' in history_str:
            return 1
        elif 'mixed' in history_str or 'polymorph' in history_str:
            return 2
        elif 'rbc present' in history_str or 'hemorrhagic' in history_str:
            return 3
        return 0

    def predict_diagnosis(self, patient_profile: dict) -> dict:
        """Predict the CNS diagnosis using the trained ML model."""
        if not self.model:
            return self._mock_prediction(patient_profile)
            
        try:
            # 1. Check if the frontend supplied raw features directly
            raw = patient_profile.get("raw_features", {})
            
            # If not supplied directly, extract using regex on labs and history text
            if not raw:
                raw_labs = self._extract_labs_from_text(patient_profile.get("labs", ""))
                cns_symptom = self._extract_symptoms_from_text(patient_profile.get("history", ""))
                
                raw = {
                    **raw_labs,
                    'cnssymptomencoded': cns_symptom
                }
            
            # Convert values to correct numeric representations
            protein_val = float(raw.get('proteinval', 0.0))
            glucose_val = float(raw.get('glucoseval', 0.0))
            ada_val = float(raw.get('adaval', 0.0))
            ldh_val = float(raw.get('ldhval', 0.0))
            microalbumin_val = float(raw.get('microalbuminval', 0.0))
            chloride_val = float(raw.get('chlorideval', 0.0))
            vol_ml = float(raw.get('volml', 0.0))
            colour_encoded = int(raw.get('colourencoded', 0))
            ph_encoded = int(raw.get('phencoded', 1))
            appearance_encoded = int(raw.get('appearanceencoded', 0))
            coagullam_present = int(raw.get('coagullampresent', 0))
            deposit_present = int(raw.get('depositpresent', 0))
            sg_val = float(raw.get('sgval', 1.000))
            cns_symptom_encoded = int(raw.get('cnssymptomencoded', 0))
            cell_count = float(raw.get('cellcount', 0.0))
            
            # Compute flag variables
            is_protein_high = 1 if protein_val > 50 else 0
            is_ada_high = 1 if ada_val > 9 else 0
            is_glucose_low = 1 if 0 < glucose_val < 40 else 0
            
            # Use typo matches:
            # Check ischloridelow in raw, or calculate it
            is_chloride_low = int(raw.get('ischloridelow', raw.get('ischoridelow', 0)))
            if is_chloride_low == 0 and chloride_val > 0 and chloride_val < 110:
                is_chloride_low = 1
                
            # Create feature dict matching trained model features
            feat_dict = {
                'proteinval': protein_val,
                'isproteinhigh': is_protein_high,
                'glucoseval': glucose_val,
                'isglucoselow': is_glucose_low,
                'microalbuminval': microalbumin_val,
                'adaval': ada_val,
                'isadahigh': is_ada_high,
                'chlorideval': chloride_val,
                'ischloridelow': is_chloride_low,  # Correct spelling
                'ischoridelow': is_chloride_low,   # Typo spelling for compatibility
                'ldhval': ldh_val,
                'volml': vol_ml,
                'colourencoded': colour_encoded,
                'phencoded': ph_encoded,
                'appearanceencoded': appearance_encoded,
                'coagullampresent': coagullam_present,
                'depositpresent': deposit_present,
                'sgval': sg_val,
                'cnssymptomencoded': cns_symptom_encoded,
                'cellcount': cell_count
            }
            
            logger.info(f"ML Inference Input Features: {feat_dict}")
            
            # Convert to features array in exact order
            X_vector = [feat_dict[f] for f in self.features]
            
            # Predict
            pred_class = int(self.model.predict([X_vector])[0])
            pred_probs = self.model.predict_proba([X_vector])[0]
            
            # Build detailed output structure
            probabilities = {}
            for cls_idx, prob in enumerate(pred_probs):
                cls_str = str(cls_idx)
                cls_label = self.classes.get(cls_str, f"Category {cls_str}")
                probabilities[cls_label] = round(float(prob) * 100, 2)
                
            # Sort probabilities descending
            sorted_probs = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)
            
            predicted_label = self.classes.get(str(pred_class), f"Category {pred_class}")
            logger.info(f"ML Inference Predicted: {predicted_label} with confidence {pred_probs[pred_class]*100:.2f}%")
            
            return {
                "status": "success",
                "mode": "live",
                "prediction": {
                    "class_index": pred_class,
                    "label": predicted_label,
                    "confidence": round(float(pred_probs[pred_class]) * 100, 2)
                },
                "probabilities": sorted_probs,
                "features_used": feat_dict
            }
            
        except Exception as e:
            logger.exception("Error during ML inference:")
            return self._mock_prediction(patient_profile, error=str(e))

    def _mock_prediction(self, patient_profile: dict, error: str = None) -> dict:
        """Simulates prediction output if model file is missing or inference fails."""
        info = f" (Error: {error})" if error else ""
        
        # Basic heuristic prediction
        labs_str = str(patient_profile.get("labs", "")).lower()
        protein = 0.0
        glucose = 0.0
        
        p_match = re.search(r'protein:\s*([\d.]+)', labs_str)
        if p_match: protein = float(p_match.group(1))
        g_match = re.search(r'glucose:\s*([\d.]+)', labs_str)
        if g_match: glucose = float(g_match.group(1))
        
        pred_label = "Normal CSF / Control"
        pred_idx = 0
        
        if protein > 100 and glucose < 40:
            pred_label = "Tuberculous Meningitis"
            pred_idx = 3
        elif protein > 50 and glucose < 45:
            pred_label = "Bacterial Meningitis"
            pred_idx = 1
        elif protein > 40:
            pred_label = "Viral Meningitis"
            pred_idx = 2
            
        probs = [
            ("Normal CSF / Control", 90.0 if pred_idx == 0 else 10.0),
            ("Bacterial Meningitis", 75.0 if pred_idx == 1 else 15.0),
            ("Viral Meningitis", 70.0 if pred_idx == 2 else 10.0),
            ("Tuberculous Meningitis", 80.0 if pred_idx == 3 else 15.0),
            ("Fungal Meningitis", 5.0),
            ("Encephalitis", 5.0)
        ]
        
        # Normalize sum of probs
        sum_probs = sum(p[1] for p in probs)
        probs = [(p[0], round((p[1] / sum_probs) * 100, 2)) for p in probs]
        probs.sort(key=lambda item: item[1], reverse=True)
        
        confidence = [p[1] for p in probs if p[0] == pred_label][0]
        
        return {
            "status": "success",
            "mode": "simulated" + info,
            "prediction": {
                "class_index": pred_idx,
                "label": pred_label,
                "confidence": confidence
            },
            "probabilities": probs,
            "features_used": {}
        }

    def find_similar_cases(self, patient_profile: dict, limit: int = 3) -> list[dict]:
        """Find the top similar patient cases in the database, protecting patient privacy by masking names."""
        if self.clean_df is None or self.raw_df is None:
            logger.warning("Similarity search requested but datasets are not loaded.")
            return []
            
        try:
            # 1. Extract/standardize values from patient_profile
            raw = patient_profile.get("raw_features", {})
            if not raw:
                raw_labs = self._extract_labs_from_text(patient_profile.get("labs", ""))
                cns_symptom = self._extract_symptoms_from_text(patient_profile.get("history", ""))
                raw = {
                    **raw_labs,
                    'cnssymptomencoded': cns_symptom
                }
                
            # Parse inputs to float/int
            protein_val = float(raw.get('proteinval', 0.0))
            glucose_val = float(raw.get('glucoseval', 0.0))
            ada_val = float(raw.get('adaval', 0.0))
            ldh_val = float(raw.get('ldhval', 0.0))
            microalbumin_val = float(raw.get('microalbuminval', 0.0))
            chloride_val = float(raw.get('chlorideval', 0.0))
            vol_ml = float(raw.get('volml', 0.0))
            colour_encoded = int(raw.get('colourencoded', 0))
            ph_encoded = int(raw.get('phencoded', 1))
            appearance_encoded = int(raw.get('appearanceencoded', 0))
            coagullam_present = int(raw.get('coagullampresent', 0))
            deposit_present = int(raw.get('depositpresent', 0))
            sg_val = float(raw.get('sgval', 1.000))
            cns_symptom_encoded = int(raw.get('cnssymptomencoded', 0))
            cell_count = float(raw.get('cellcount', 0.0))
            
            # Map query to features dictionary
            query = {
                'proteinval': protein_val,
                'glucoseval': glucose_val,
                'adaval': ada_val,
                'chlorideval': chloride_val,
                'ldhval': ldh_val,
                'microalbuminval': microalbumin_val,
                'volml': vol_ml,
                'sgval': sg_val,
                'colourencoded': colour_encoded,
                'phencoded': ph_encoded,
                'appearanceencoded': appearance_encoded,
                'coagullampresent': coagullam_present,
                'depositpresent': deposit_present,
                'cnssymptomencoded': cns_symptom_encoded,
                'cellcount': cell_count
            }
            
            # 2. Similarity search weights
            categorical_weights = {
                'colourencoded': 1.0,
                'phencoded': 0.5,
                'appearanceencoded': 1.0,
                'coagullampresent': 0.5,
                'depositpresent': 0.5,
                'cnssymptomencoded': 2.0
            }
            
            total_weight = sum(self.numeric_weights.values()) + sum(categorical_weights.values())
            
            # 3. Calculate distance for each row
            results = []
            for idx in range(len(self.clean_df)):
                row = self.clean_df.iloc[idx].to_dict()
                dist_sum = 0.0
                
                # Numeric features distance
                for feat, weight in self.numeric_weights.items():
                    val_q = float(query.get(feat, 0.0))
                    val_r = float(row.get(feat, 0.0))
                    min_val, max_val, r_range = self.min_max[feat]
                    dist_sum += weight * (abs(val_q - val_r) / r_range)
                    
                # Categorical features distance
                for feat, weight in categorical_weights.items():
                    val_q = int(float(query.get(feat, 0.0)))
                    val_r = int(float(row.get(feat, 0.0)))
                    dist_sum += weight * (0.0 if val_q == val_r else 1.0)
                    
                similarity_pct = 100.0 * (1.0 - (dist_sum / total_weight))
                results.append((idx, similarity_pct))
                
            # 4. Sort and select top matches
            results.sort(key=lambda x: x[1], reverse=True)
            top_matches = results[:limit]
            
            # 5. Build response objects (masking names to protect patient privacy)
            matched_cases = []
            for idx, similarity in top_matches:
                clean_row = self.clean_df.iloc[idx].to_dict()
                raw_idx = int(clean_row.get("rawidx", idx))
                raw_row = self.raw_df.iloc[raw_idx].to_dict()
                
                # Mask real patient name with their Patient ID (PID) to protect privacy
                pid = raw_row.get("patientid", clean_row.get("patientid", f"P{idx+1:03d}"))
                
                # If diagnosis in raw is blank or nan, fall back to class label
                diag_class = int(float(clean_row.get("cnsdiagnosisprimary", 0)))
                diag_label = self.classes.get(str(diag_class), "Unknown CNS Condition")
                raw_diag = str(raw_row.get("diagnosis", ""))
                if not raw_diag or raw_diag.lower() == "nan" or raw_diag == "":
                    raw_diag = f"{diag_label} (Class {diag_class})"
                    
                cell_type_raw = str(raw_row.get("celltype", ""))
                
                matched_cases.append({
                    "pid": pid,
                    "similarity": round(similarity, 1),
                    "age": raw_row.get("age", clean_row.get("age", 45)),
                    "sex": raw_row.get("sex", clean_row.get("sex", "Male")),
                    "diagnosis": raw_diag,
                    "reason_for_admission": str(raw_row.get("reasonforadmission", "")),
                    "hospital_course": str(raw_row.get("hospitalcourseincludingoperations", "")),
                    "metrics": {
                        "proteinval": float(clean_row.get("proteinval", 0.0)),
                        "glucoseval": float(clean_row.get("glucoseval", 0.0)),
                        "adaval": float(clean_row.get("adaval", 0.0)),
                        "chlorideval": float(clean_row.get("chlorideval", 0.0)),
                        "ldhval": float(clean_row.get("ldhval", 0.0)),
                        "sgval": float(clean_row.get("sgval", 1.000)),
                        "volml": float(clean_row.get("volml", 0.0)),
                        "colourencoded": int(float(clean_row.get("colourencoded", 0))),
                        "phencoded": int(float(clean_row.get("phencoded", 1))),
                        "appearanceencoded": int(float(clean_row.get("appearanceencoded", 0))),
                        "coagullampresent": int(float(clean_row.get("coagullampresent", 0))),
                        "depositpresent": int(float(clean_row.get("depositpresent", 0))),
                        "cnssymptomencoded": int(float(clean_row.get("cnssymptomencoded", 0))),
                        "celltype_raw": cell_type_raw,
                        "cellcount": float(clean_row.get("cellcount", 0.0))
                    }
                })
                
            return matched_cases
        except Exception as e:
            logger.exception("Error in find_similar_cases:")
            return []
