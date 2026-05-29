import os
import json
import re
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import joblib

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "..", "csfdata.csv")
RAW_DATA_PATH = os.path.join(BASE_DIR, "..", "Raw Data From Log Book CSF.csv")
MODEL_PATH = os.path.join(BASE_DIR, "cns_model.joblib")
FEATURES_PATH = os.path.join(BASE_DIR, "model_features.json")

def align_and_merge_cellcount(clean_df, raw_df):
    def clean_col(c):
        return re.sub(r'[^a-zA-Z]', '', c).lower()

    c_cols = [clean_col(c) for c in clean_df.columns]
    r_cols = [clean_col(c) for c in raw_df.columns]
    
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

    p_col1 = clean_df.columns[c_cols.index('proteinval')]
    g_col1 = clean_df.columns[c_cols.index('glucoseval')]
    sg_col1 = clean_df.columns[c_cols.index('sgval')]
    vol_col1 = clean_df.columns[c_cols.index('volml')]
    ada_col1 = clean_df.columns[c_cols.index('adaval')]
    cl_col1 = clean_df.columns[c_cols.index('chlorideval')]
    ldh_col1 = clean_df.columns[c_cols.index('ldhval')]
    
    p_col2 = raw_df.columns[r_cols.index('microproteinmgdl')]
    g_col2 = raw_df.columns[r_cols.index('glucosemgdl')]
    sg_col2 = raw_df.columns[r_cols.index('specificgravity')]
    vol_col2 = raw_df.columns[r_cols.index('volml')]
    ada_col2 = raw_df.columns[r_cols.index('adaul')]
    cl_col2 = raw_df.columns[r_cols.index('chloridemmoll')]
    ldh_col2 = raw_df.columns[r_cols.index('ldhul')]
    cc_col2 = raw_df.columns[r_cols.index('cellcountcumm')]
    
    df2_parsed = []
    for idx2, row2 in raw_df.iterrows():
        df2_parsed.append({
            'p': parse_numeric(row2[p_col2]),
            'g': parse_numeric(row2[g_col2]),
            'sg': parse_numeric(row2[sg_col2]),
            'vol': parse_numeric(row2[vol_col2]),
            'ada': parse_numeric(row2[ada_col2]),
            'cl': parse_numeric(row2[cl_col2]),
            'ldh': parse_numeric(row2[ldh_col2]),
            'cc': parse_numeric(row2[cc_col2])
        })
        
    cellcounts = []
    prev_idx2 = -1
    for idx1, row1 in clean_df.iterrows():
        p1 = row1[p_col1]
        g1 = row1[g_col1]
        sg1 = row1[sg_col1]
        vol1 = row1[vol_col1]
        ada1 = row1[ada_col1]
        cl1 = row1[cl_col1]
        ldh1 = row1[ldh_col1]
        
        found = False
        for idx2 in range(prev_idx2 + 1, len(raw_df)):
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
                prev_idx2 = idx2
                found = True
                break
                
        if not found:
            cellcounts.append(0.0)
            
    return cellcounts

def clean_column_name(name):
    return name.replace('\n', '').replace('_', '').replace(' ', '').replace('"', '').replace("'", "").lower()

def generate_clinical_synthetic_data(class_idx, count, random_seed=42):
    np.random.seed(random_seed)
    
    data = []
    for _ in range(count):
        # Default features
        protein = 30.0
        glucose = 60.0
        ada = 3.0
        chloride = 0.0  # Default missing
        ldh = 0.0       # Default missing
        microalbumin = 0.0 # Default missing
        vol = 10.0
        sg = 1.006
        colour = 0
        ph = 1
        appearance = 0
        coagulum = 0
        deposit = 0
        cns_symptom = 0
        cellcount = 2.0
        
        # Decide if optional fields are measured (based on dataset statistics)
        has_chloride = np.random.random() < 0.21
        has_ldh = np.random.random() < 0.40
        has_microalbumin = np.random.random() < 0.09
        
        if class_idx == 0:  # Normal
            protein = np.random.normal(28, 6)
            glucose = np.random.normal(65, 7)
            ada = np.random.normal(3, 1.5)
            if has_chloride:
                chloride = np.random.normal(122, 4)
            if has_ldh:
                ldh = np.random.normal(10, 5)
            if has_microalbumin:
                microalbumin = np.random.normal(8, 4)
            sg = np.random.normal(1.0065, 0.0005)  # Table 1: 1.006 - 1.007
            cellcount = np.clip(np.random.normal(2.5, 1.2), 0.0, 5.0)  # Table 1: 0 - 5
            colour = np.random.choice([0, 1], p=[0.95, 0.05])
            appearance = 0
            cns_symptom = 0
            
        elif class_idx == 1:  # Bacterial
            protein = np.random.normal(300, 100)
            glucose = np.random.normal(18, 8)
            ada = np.random.normal(6, 3)
            if has_chloride:
                chloride = np.random.normal(112, 6)
            if has_ldh:
                ldh = np.random.normal(120, 50)
            if has_microalbumin:
                microalbumin = np.random.normal(60, 30)
            sg = np.random.normal(1.018, 0.005)
            cellcount = np.clip(np.random.normal(1000, 450), 10.0, 2000.0)  # Table 4: 10 - 2000
            colour = np.random.choice([1, 2], p=[0.3, 0.7])
            appearance = np.random.choice([2, 3], p=[0.4, 0.6])
            coagulum = np.random.choice([0, 1], p=[0.4, 0.6])
            deposit = np.random.choice([0, 1], p=[0.3, 0.7])
            cns_symptom = 2  # Mixed cell type
            
        elif class_idx == 2:  # Viral
            protein = np.random.normal(75, 20)
            glucose = np.random.normal(55, 8)
            ada = np.random.normal(4, 2)
            if has_chloride:
                chloride = np.random.normal(120, 4)
            if has_ldh:
                ldh = np.random.normal(18, 8)
            if has_microalbumin:
                microalbumin = np.random.normal(12, 6)
            sg = np.random.normal(1.008, 0.003)
            cellcount = np.clip(np.random.normal(180, 50), 100.0, 1000.0)  # Table 4: > 100
            colour = np.random.choice([0, 1], p=[0.7, 0.3])
            appearance = np.random.choice([0, 1], p=[0.7, 0.3])
            cns_symptom = np.random.choice([0, 1], p=[0.7, 0.3])
            
        elif class_idx == 3:  # Tuberculous
            protein = np.random.normal(220, 70)
            glucose = np.random.normal(22, 6)
            ada = np.random.normal(22, 6)
            if has_chloride:
                # Classic low chloride in TBM
                chloride = np.random.normal(95, 6)
            if has_ldh:
                ldh = np.random.normal(45, 20)
            if has_microalbumin:
                microalbumin = np.random.normal(35, 15)
            sg = np.random.normal(1.015, 0.004)
            cellcount = np.clip(np.random.normal(250, 80), 10.0, 499.0)  # Table 4: < 500
            colour = np.random.choice([1, 2], p=[0.8, 0.2])
            appearance = np.random.choice([1, 2], p=[0.5, 0.5])
            coagulum = np.random.choice([0, 1], p=[0.3, 0.7])
            deposit = np.random.choice([0, 1], p=[0.3, 0.7])
            cns_symptom = np.random.choice([0, 1], p=[0.8, 0.2])
            
        elif class_idx == 4:  # Fungal
            protein = np.random.normal(75, 20)  # Table 4: Normal to mild increase
            glucose = np.random.normal(30, 8)  # Table 4: Low to normal (typical fungal low glucose)
            ada = np.random.normal(5, 2)
            if has_chloride:
                chloride = np.random.normal(110, 5)
            if has_ldh:
                ldh = np.random.normal(35, 15)
            if has_microalbumin:
                microalbumin = np.random.normal(25, 12)
            sg = np.random.normal(1.012, 0.004)
            cellcount = np.clip(np.random.normal(30, 10), 10.0, 50.0)  # Table 4: 10 - 50
            colour = np.random.choice([1, 2], p=[0.8, 0.2])
            appearance = np.random.choice([0, 1, 2], p=[0.3, 0.5, 0.2])
            cns_symptom = np.random.choice([0, 1], p=[0.8, 0.2])
            
        elif class_idx == 5:  # Encephalitis
            protein = np.random.normal(55, 15)
            glucose = np.random.normal(60, 8)
            ada = np.random.normal(3, 1.5)
            if has_chloride:
                chloride = np.random.normal(122, 4)
            if has_ldh:
                ldh = np.random.normal(12, 6)
            if has_microalbumin:
                microalbumin = np.random.normal(8, 4)
            sg = np.random.normal(1.006, 0.002)
            cellcount = np.clip(np.random.normal(25, 12), 5.0, 50.0)  # Table 5: 5 - 50
            colour = np.random.choice([0, 1], p=[0.9, 0.1])
            appearance = 0
            cns_symptom = np.random.choice([0, 1], p=[0.9, 0.1])
            
        # Clip continuous variables to avoid negatives or unrealistic specific gravities
        protein = max(5.0, protein)
        glucose = max(2.0, glucose)
        ada = max(0.1, ada)
        chloride = max(0.0, chloride)
        ldh = max(0.0, ldh)
        microalbumin = max(0.0, microalbumin)
        vol = max(1.0, vol)
        sg = np.clip(sg, 1.000, 1.050)
        # Apply missingness to cellcount (25% chance of being unmeasured/0.0)
        if np.random.random() < 0.25:
            cellcount = 0.0
        else:
            cellcount = max(0.0, cellcount)
        
        # Binary flags
        is_protein_high = 1 if protein > 50 else 0
        is_ada_high = 1 if ada > 9 else 0
        is_glucose_low = 1 if 0 < glucose < 40 else 0
        is_chloride_low = 1 if 0 < chloride < 110 else 0
        
        data.append({
            'proteinval': protein,
            'isproteinhigh': is_protein_high,
            'glucoseval': glucose,
            'isglucoselow': is_glucose_low,
            'microalbuminval': microalbumin,
            'adaval': ada,
            'isadahigh': is_ada_high,
            'chlorideval': chloride,
            'ischloridelow': is_chloride_low,
            'ldhval': ldh,
            'volml': vol,
            'colourencoded': int(colour),
            'phencoded': int(ph),
            'appearanceencoded': int(appearance),
            'coagullampresent': int(coagulum),
            'depositpresent': int(deposit),
            'sgval': sg,
            'cnssymptomencoded': int(cns_symptom),
            'cellcount': cellcount,
            'cnsdiagnosisprimary': class_idx
        })
        
    return pd.DataFrame(data)

def amplify_data(X_data, y_data, feature_cols, target_count=450, noise_level=0.08):
    """
    Amplifies minority classes using a hybrid of standard oversampling with noise,
    categorical mutation, and sparse clinically guided synthetic cases.
    """
    import numpy as np
    
    continuous_cols = [
        'proteinval', 'glucoseval', 'adaval', 'chlorideval', 
        'ldhval', 'volml', 'sgval', 'cellcount', 'microalbuminval'
    ]
    
    stds = X_data[continuous_cols].std().to_dict()
    for col in stds:
        if pd.isna(stds[col]) or stds[col] == 0:
            stds[col] = X_data[col].mean() if X_data[col].mean() > 0 else 1.0
            
    X_amp = [X_data.copy()]
    y_amp = [y_data.copy()]
    
    classes = y_data.unique()
    for cls in classes:
        cls_indices = y_data[y_data == cls].index
        cls_X = X_data.loc[cls_indices]
        current_count = len(cls_X)
        
        # 1. Generate 400 clinical synthetic cases for this class to ground clinical boundaries
        synth_df = generate_clinical_synthetic_data(cls, 400, random_seed=42)
        X_amp.append(synth_df[feature_cols])
        y_amp.append(synth_df['cnsdiagnosisprimary'])
        
        # 2. Oversample the real samples to reach target_count if needed
        new_count = current_count + 400
        if new_count < target_count:
            diff = target_count - new_count
            sampled_X = cls_X.sample(n=diff, replace=True, random_state=42)
            
            perturbed_X = sampled_X.copy()
            # Continuous jittering
            for col in continuous_cols:
                noise = np.random.normal(0, noise_level * stds[col], size=diff)
                perturbed_X[col] = perturbed_X[col] + noise
                perturbed_X[col] = perturbed_X[col].clip(lower=0)
                
            if 'sgval' in continuous_cols:
                perturbed_X['sgval'] = perturbed_X['sgval'].clip(1.000, 1.100)
                
            # Categorical mutation noise (breaks 100% correlation shortcuts)
            cat_cols = ['colourencoded', 'appearanceencoded', 'coagullampresent', 'depositpresent', 'cnssymptomencoded']
            for col in cat_cols:
                mutation_mask = np.random.random(size=diff) < 0.20
                possible_vals = cls_X[col].unique()
                if len(possible_vals) > 0:
                    random_mutations = np.random.choice(possible_vals, size=diff)
                    perturbed_X.loc[mutation_mask, col] = random_mutations[mutation_mask]
                
            # Recompute binary flags based on perturbed continuous features
            perturbed_X['isproteinhigh'] = (perturbed_X['proteinval'] > 50).astype(int)
            perturbed_X['isadahigh'] = (perturbed_X['adaval'] > 9).astype(int)
            perturbed_X['isglucoselow'] = ((perturbed_X['glucoseval'] < 40) & (perturbed_X['glucoseval'] > 0)).astype(int)
            perturbed_X['ischloridelow'] = ((perturbed_X['chlorideval'] < 110) & (perturbed_X['chlorideval'] > 0)).astype(int)
            
            X_amp.append(perturbed_X)
            y_amp.append(pd.Series([cls] * diff))
            
    X_train_new = pd.concat(X_amp, ignore_index=True)
    y_train_new = pd.concat(y_amp, ignore_index=True)
    
    return X_train_new, y_train_new

def main():
    print("Loading dataset...")
    if not os.path.exists(DATA_PATH):
        print(f"Error: Dataset not found at {DATA_PATH}")
        return
    if not os.path.exists(RAW_DATA_PATH):
        print(f"Error: Raw dataset not found at {RAW_DATA_PATH}")
        return
        
    df = pd.read_csv(DATA_PATH)
    df_raw = pd.read_csv(RAW_DATA_PATH)
    
    # Align and extract cellcount
    print("Aligning clean dataset with raw logbook to extract cell counts...")
    cellcounts = align_and_merge_cellcount(df, df_raw)
    df['cellcount'] = cellcounts
    
    # Clean headers
    df.columns = [clean_column_name(col) for col in df.columns]
    print(f"Cleaned headers: {list(df.columns)}")
    
    # Check target
    target_col = 'cnsdiagnosisprimary'
    if target_col not in df.columns:
        print(f"Error: Target column '{target_col}' not found in headers.")
        return
        
    # Feature columns mapping
    feature_cols = [
        'proteinval', 'isproteinhigh', 'glucoseval', 'isglucoselow', 
        'microalbuminval', 'adaval', 'isadahigh', 'chlorideval', 
        'ischloridelow', 'ldhval', 'volml', 'colourencoded', 
        'phencoded', 'appearanceencoded', 'coagullampresent', 
        'depositpresent', 'sgval', 'cnssymptomencoded', 'cellcount'
    ]
    
    # Check for ischloridelow / ischoridelow typo
    if 'ischloridelow' not in df.columns and 'ischoridelow' in df.columns:
        df.rename(columns={'ischoridelow': 'ischloridelow'}, inplace=True)
    
    # Verify all feature columns are present
    missing_features = [col for col in feature_cols if col not in df.columns]
    if missing_features:
        print(f"Warning: Missing features in dataset: {missing_features}. They will be initialized to 0.")
        for col in missing_features:
            df[col] = 0.0
            
    # Keep only feature columns and target
    df = df[feature_cols + [target_col]].copy()
    
    # Handle missing values
    for col in feature_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
        median_val = df[col].median()
        df[col] = df[col].fillna(median_val if not pd.isna(median_val) else 0.0)
        
    # Recompute/clean binary flags according to standard reference ranges
    print("Cleaning and recomputing binary flags based on standard reference range rules...")
    df['isproteinhigh'] = (df['proteinval'] > 50).astype(int)
    df['isadahigh'] = (df['adaval'] > 9).astype(int)
    df['isglucoselow'] = ((df['glucoseval'] < 40) & (df['glucoseval'] > 0)).astype(int)
    df['ischloridelow'] = ((df['chlorideval'] < 110) & (df['chlorideval'] > 0)).astype(int)
        
    df[target_col] = pd.to_numeric(df[target_col], errors='coerce')
    df.dropna(subset=[target_col], inplace=True)
    df[target_col] = df[target_col].astype(int)
    
    X = df[feature_cols]
    y = df[target_col]
    
    print("\nClass distribution:")
    class_counts = y.value_counts()
    for cls, count in class_counts.items():
        print(f"Class {cls}: {count} samples")
        
    # Split into train and test sets for verification evaluation
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTraining set size: {X_train.shape[0]} samples")
    print(f"Testing set size: {X_test.shape[0]} samples")
    
    # Amplify the training data to evaluate accurately
    print("Amplifying training set for model validation...")
    X_train_amp, y_train_amp = amplify_data(X_train, y_train, feature_cols, target_count=450, noise_level=0.08)
    print(f"Amplified training set size: {X_train_amp.shape[0]} samples")
    
    # Train validation model
    print("\nTraining validation model (Random Forest)...")
    val_model = RandomForestClassifier(
        n_estimators=150,
        max_depth=10,
        min_samples_split=8,
        max_features=3,
        class_weight='balanced',
        random_state=42
    )
    val_model.fit(X_train_amp, y_train_amp)
    
    train_acc = accuracy_score(y_train_amp, val_model.predict(X_train_amp))
    test_acc = accuracy_score(y_test, val_model.predict(X_test))
    print(f"Validation Train Accuracy (Amplified): {train_acc:.4f}")
    print(f"Validation Test Accuracy (Clean): {test_acc:.4f}")
    
    print("\nClassification Report (Validation Test Set):")
    print(classification_report(y_test, val_model.predict(X_test), zero_division=0))
    
    # Now, amplify the ENTIRE dataset and train the final deployed model
    print("\n--- Deployable Model Training ---")
    print("Amplifying the entire dataset to maximize clinical pattern recognition...")
    X_full_amp, y_full_amp = amplify_data(X, y, feature_cols, target_count=450, noise_level=0.08)
    print(f"Full amplified dataset size: {X_full_amp.shape[0]} samples")
    
    print("Training final deployed model...")
    final_model = RandomForestClassifier(
        n_estimators=250,
        max_depth=10,
        min_samples_split=8,
        max_features=3,
        class_weight='balanced',
        random_state=42
    )
    final_model.fit(X_full_amp, y_full_amp)
    
    # Feature Importances of final model
    importances = final_model.feature_importances_
    indices = np.argsort(importances)[::-1]
    
    print("\nFeature Importances (Top 10):")
    for i in range(min(10, len(feature_cols))):
        print(f"{i+1}. {feature_cols[indices[i]]}: {importances[indices[i]]:.4f}")
        
    # Save model and features metadata
    print(f"\nSaving final model to {MODEL_PATH}...")
    joblib.dump(final_model, MODEL_PATH)
    
    metadata = {
        "features": feature_cols,
        "classes": {
            "0": "Normal CSF / Control",
            "1": "Bacterial Meningitis",
            "2": "Viral Meningitis",
            "3": "Tuberculous Meningitis",
            "4": "Fungal Meningitis",
            "5": "Encephalitis"
        }
    }
    
    print(f"Saving metadata to {FEATURES_PATH}...")
    with open(FEATURES_PATH, 'w') as f:
        json.dump(metadata, f, indent=4)
        
    print("\nModel training completed successfully!")

if __name__ == "__main__":
    main()
