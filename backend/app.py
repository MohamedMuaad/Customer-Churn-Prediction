from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd

app = Flask(__name__)
CORS(app)

telecom_model = joblib.load('telecom_model.joblib')
insurance_model = joblib.load('insurance_model.joblib')
telecom_scaler = joblib.load('telecom_scaler.joblib')
insurance_scaler = joblib.load('insurance_scaler.joblib')

def preprocess_features(features):
    processed = {
        'data_usage_mb': np.log1p(features['data_usage_mb']),
        'login_attempts': features['login_attempts'],
        'bill_amount': np.log1p(features['bill_amount']),
        'payment_delay_days': np.log1p(features['payment_delay_days'] + 1),
        'network_latency_ms': features['network_latency_ms'],
        'packet_loss_percent': features['packet_loss_percent'],
        'download_speed_mbps': features['download_speed_mbps']
    }
    return processed

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    industry = data['industry']
    features = data['features']
    try:
        if industry == 'telecom':
            features = request.get_json()['features']
            processed = preprocess_features(features)
            
            feature_order = ['data_usage_mb', 'login_attempts', 'bill_amount', 
                            'payment_delay_days', 'network_latency_ms', 
                            'packet_loss_percent', 'download_speed_mbps']
            
            features_df = pd.DataFrame([processed], columns=feature_order)
            scaled_features = telecom_scaler.transform(features_df)
            prediction = float(telecom_model.predict_proba(scaled_features)[0][1])
        elif industry == 'insurance':
            feature_order = ['customer_age', 'policy_age', 'vehicle_value', 
                        'total_claims', 'avg_claim_processing', 
                        'vehicle_changes', 'months_to_renewal']
            features_array = np.array([features[f] for f in feature_order]).reshape(1, -1)
            scaled_features = insurance_scaler.transform(features_array)
            prediction = insurance_model.predict_proba(scaled_features)[0][1]
            
        return jsonify({
            'churn_probability': prediction,
            'churn_risk': 'High' if prediction > 0.70 else 'Medium' if prediction > 0.45 else 'Low'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
    
    
