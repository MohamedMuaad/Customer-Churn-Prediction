import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')
from pathlib import Path
import joblib
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import tensorflow as tf
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, roc_curve
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from xgboost import XGBClassifier
from catboost import CatBoostClassifier
from imblearn.over_sampling import SMOTE
import matplotlib.pyplot as plt

df = pd.read_csv("telecom_churn_data.csv")
print("Initial shape:", df.shape)

def prepare_data_for_ml(df):
    customer_groups = df.groupby('customer_id')
    feature_rows = []

    for customer_id, customer_data in customer_groups:
        if len(customer_data) == 6:
            features = {
                'customer_id': customer_id,
                'broadband_number': customer_data['broadband_number'].iloc[0],  # Add broadband number
                'data_usage_mb': round(customer_data['data_usage_mb'].sum(),2),
                'login_attempts': customer_data['login_attempts'].sum(),
                'bill_amount': round(customer_data['bill_amount'].sum(),2),
                'payment_delay_days': round(customer_data['payment_delay_days'].mean(),0).astype(int),
                'network_latency_ms': round(customer_data['network_latency_ms'].mean(),2),
                'packet_loss_percent': round(customer_data['packet_loss_percent'].mean(),2),
                'download_speed_mbps': round(customer_data['download_speed_mbps'].mean(),2),
                'churn_next_month': customer_data.iloc[-1]['churn_next_month'].astype(int)
            }
            feature_rows.append(features)
    return pd.DataFrame(feature_rows)

df = prepare_data_for_ml(df)
print("Processed shape:", df.shape)

def handle_outliers(df, columns):
    for col in columns:
        q1 = df[col].quantile(0.05)
        q3 = df[col].quantile(0.95)
        iqr = q3 - q1
        df[col] = df[col].clip(lower=q1 - 1.5 * iqr, upper=q3 + 1.5 * iqr)
        if df[col].skew() > 1:
            df[col] = np.log1p(df[col])
    return df

numeric_columns = ['data_usage_mb', 'login_attempts', 'bill_amount', 'payment_delay_days',
                  'network_latency_ms', 'packet_loss_percent', 'download_speed_mbps']

df = handle_outliers(df, numeric_columns)

# Store broadband numbers before splitting
broadband_numbers = df[['customer_id', 'broadband_number']]

# Prepare features for training
X = df.drop(['customer_id', 'broadband_number', 'churn_next_month'], axis=1)
y = df['churn_next_month']

X_temp, X_test, y_temp, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
X_train, X_val, y_train, y_val = train_test_split(X_temp, y_temp, test_size=0.25, random_state=42, stratify=y_temp)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled = scaler.transform(X_val)
X_test_scaled = scaler.transform(X_test)

smote = SMOTE(random_state=42)
X_train_resampled, y_train_resampled = smote.fit_resample(X_train_scaled, y_train)

models = {
    'random_forest': RandomForestClassifier(n_estimators=500, random_state=42),
    'gradient_boosting': GradientBoostingClassifier(n_estimators=500, random_state=42),
    'xgboost': XGBClassifier(
        n_estimators=500,
        learning_rate=0.01,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        early_stopping_rounds=10
    ),
    'catboost': CatBoostClassifier(
        iterations=500,
        learning_rate=0.01,
        random_state=42,
        verbose=False,
        early_stopping_rounds=10
    )
}

results = {}
for name, model in models.items():
    print(f"Training {name}...")

    if name in ['xgboost', 'catboost']:
        cv_model = XGBClassifier(random_state=42) if name == 'xgboost' else CatBoostClassifier(random_state=42, verbose=False)
    else:
        cv_model = model

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(cv_model, X_train_resampled, y_train_resampled, cv=cv, scoring='roc_auc')

    if name == 'xgboost':
        model.fit(
            X_train_resampled, y_train_resampled,
            eval_set=[(X_val_scaled, y_val)],
            verbose=False
        )
    elif name == 'catboost':
        model.fit(
            X_train_resampled, y_train_resampled,
            eval_set=[(X_val_scaled, y_val)],
            verbose=False
        )
    else:
        model.fit(X_train_resampled, y_train_resampled)

    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    results[name] = {
        'cv_scores_mean': cv_scores.mean(),
        'cv_scores_std': cv_scores.std(),
        'test_metrics': {
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred),
            'recall': recall_score(y_test, y_pred),
            'f1': f1_score(y_test, y_pred),
            'auc_roc': roc_auc_score(y_test, y_prob)
        }
    }

# Print results and find best model
metrics_df = pd.DataFrame({
    model_name: {
        'CV Score': f"{res['cv_scores_mean']:.3f} ± {res['cv_scores_std']*2:.3f}",
        **{k: f"{v:.3f}" for k,v in res['test_metrics'].items()}
    }
    for model_name, res in results.items()
}).T

metrics_df['auc_roc'] = metrics_df['auc_roc'].astype(float)
metrics_df_sorted = metrics_df.sort_values('auc_roc', ascending=False)
print("\nModel Performance Metrics (Sorted by AUC-ROC):")
print(metrics_df_sorted)

# Get best model
best_model_name = metrics_df_sorted.index[0]
best_model = models[best_model_name]

# Save the model and scaler
joblib.dump(best_model, 'telecom_model.joblib')
joblib.dump(scaler, 'telecom_scaler.joblib')

# Save the broadband number mapping
broadband_numbers.to_csv('customer_broadband_mapping.csv', index=False)

print(f"\nBest model ({best_model_name}) and scaler have been saved.")
print("Broadband number mapping has been saved to customer_broadband_mapping.csv")