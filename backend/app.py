from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd
import os

app = Flask(__name__)
CORS(app)

# Load models and scalers
telecom_model = joblib.load('telecom_model.joblib')
insurance_model = joblib.load('insurance_model.joblib')
telecom_scaler = joblib.load('telecom_scaler.joblib')
insurance_scaler = joblib.load('insurance_scaler.joblib')

def preprocess_telecom_features(data):
    feature_order = ['data_usage_mb', 'login_attempts', 'bill_amount', 
                    'payment_delay_days', 'network_latency_ms', 
                    'packet_loss_percent', 'download_speed_mbps']
    return pd.DataFrame([data], columns=feature_order)

def prepare_telecom_data(df):
    customer_groups = df.groupby('broadband_number')
    processed_data = []
    
    for broadband_number, customer_data in customer_groups:
        if len(customer_data) == 6:
            features = {
                'broadband_number': broadband_number,
                'data_usage_mb': round(customer_data['data_usage_mb'].sum(), 2),
                'login_attempts': customer_data['login_attempts'].sum(),
                'bill_amount': round(customer_data['bill_amount'].sum(), 2),
                'payment_delay_days': round(customer_data['payment_delay_days'].mean(), 0),
                'network_latency_ms': round(customer_data['network_latency_ms'].mean(), 2),
                'packet_loss_percent': round(customer_data['packet_loss_percent'].mean(), 2),
                'download_speed_mbps': round(customer_data['download_speed_mbps'].mean(), 2)
            }
            processed_data.append(features)
    return processed_data

def prepare_insurance_data(df):
    df['policy_start'] = pd.to_datetime(df['policy_start'])
    df['policy_age'] = (pd.to_datetime('now') - df['policy_start']).dt.days
    df['claim_processing_days'] = df['claim_processing_days'].fillna(0)

    customer_groups = df.groupby('customer_id')
    feature_rows = []

    for customer_id, customer_data in customer_groups:
        if len(customer_data) == 6:
            features = {
                'customer_id': customer_id,
                'customer_age': customer_data['customer_age'].iloc[-1],
                'policy_age': customer_data['policy_age'].iloc[-1],
                'vehicle_value': customer_data['vehicle_value'].iloc[-1],
                'total_claims': customer_data['has_claimed'].sum(),
                'avg_claim_processing': round(customer_data[customer_data['has_claimed'] == 1]['claim_processing_days'].mean() if customer_data['has_claimed'].sum() > 0 else 0, 2),
                'vehicle_changes': customer_data['vehicle_changed'].sum(),
                'months_to_renewal': customer_data['months_to_renewal'].iloc[-1]
            }
            feature_rows.append(features)
    return pd.DataFrame(feature_rows)

@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    try:
        data = request.json
        industry = data['industry']
        batch_data = data['data']

        if industry == 'telecom':
            df = pd.DataFrame(batch_data)
            processed_data = prepare_telecom_data(df)
            processed_df = pd.DataFrame(processed_data)
            processed_df.to_csv('telecom_customer_data.csv', index=False)

            predictions = []
            for row in processed_data:
                features_df = preprocess_telecom_features(row)
                scaled_features = telecom_scaler.transform(features_df)
                prob = float(telecom_model.predict_proba(scaled_features)[0][1])
                
                predictions.append({
                    'id': row['broadband_number'],
                    'churn_probability': prob,
                    'churn_risk': 'High' if prob > 0.7 else 'Medium' if prob > 0.4 else 'Low'
                })

        elif industry == 'insurance':
            df = pd.DataFrame(batch_data)
            df.to_csv('insurance_uploaded_data.csv', index=False)
            
            processed_df = prepare_insurance_data(df)
            feature_order = ['customer_age', 'policy_age', 'vehicle_value', 
                           'total_claims', 'avg_claim_processing', 
                           'vehicle_changes', 'months_to_renewal']
            
            features = processed_df[feature_order]
            scaled_features = insurance_scaler.transform(features)
            probabilities = insurance_model.predict_proba(scaled_features)[:, 1]
            
            predictions = []
            for i, customer_id in enumerate(processed_df['customer_id']):
                prob = float(probabilities[i])
                predictions.append({
                    'id': int(customer_id),
                    'churn_probability': prob,
                    'churn_risk': 'High' if prob > 0.7 else 'Medium' if prob > 0.4 else 'Low'
                })

        return jsonify(predictions)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict_single', methods=['POST'])
def predict_single():
    try:
        data = request.json
        
        if 'broadband_number' in data:
            try:
                df = pd.read_csv('telecom_customer_data.csv')
            except FileNotFoundError:
                return jsonify({'error': 'No processed customer data available'}), 404

            customer_data = df[df['broadband_number'].astype(str) == str(data['broadband_number'])]
            if len(customer_data) == 0:
                return jsonify({'error': 'Customer not found'}), 404

            customer_features = {
                'data_usage_mb': customer_data['data_usage_mb'].iloc[0],
                'login_attempts': customer_data['login_attempts'].iloc[0],
                'bill_amount': customer_data['bill_amount'].iloc[0],
                'payment_delay_days': customer_data['payment_delay_days'].iloc[0],
                'network_latency_ms': customer_data['network_latency_ms'].iloc[0],
                'packet_loss_percent': customer_data['packet_loss_percent'].iloc[0],
                'download_speed_mbps': customer_data['download_speed_mbps'].iloc[0]
            }

            features_df = preprocess_telecom_features(customer_features)
            scaled_features = telecom_scaler.transform(features_df)
            prob = float(telecom_model.predict_proba(scaled_features)[0][1])

        elif 'customer_id' in data:
            try:
                df = pd.read_csv('insurance_uploaded_data.csv')
            except FileNotFoundError:
                return jsonify({'error': 'Please upload insurance data first using bulk upload'}), 404
                
            customer_id = int(data['customer_id'])
            customer_data = df[df['customer_id'] == customer_id]
            
            if len(customer_data) == 0:
                return jsonify({'error': 'Customer not found'}), 404
                
            processed_data = prepare_insurance_data(customer_data)
            if len(processed_data) == 0:
                return jsonify({'error': 'Insufficient data for prediction'}), 400
                
            feature_order = ['customer_age', 'policy_age', 'vehicle_value', 
                           'total_claims', 'avg_claim_processing', 
                           'vehicle_changes', 'months_to_renewal']
            
            features = processed_data[feature_order]
            scaled_features = insurance_scaler.transform(features)
            prob = float(insurance_model.predict_proba(scaled_features)[0][1])

        return jsonify({
            'churn_probability': prob,
            'churn_risk': 'High' if prob > 0.7 else 'Medium' if prob > 0.4 else 'Low'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)