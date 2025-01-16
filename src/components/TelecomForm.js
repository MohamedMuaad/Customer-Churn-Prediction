import React, { useState } from 'react';
import axios from 'axios';

function TelecomForm({ setPrediction }) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState('');
  const [formData, setFormData] = useState({
    data_usage_mb: '',
    login_attempts: '',
    bill_amount: '',
    payment_delay_days: '',
    network_latency_ms: '',
    packet_loss_percent: '',
    download_speed_mbps: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/predict', {
        industry: 'telecom',
        features: formData
      });
      setPrediction(response.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatLabel = (field) => {
    const formatted = field.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return formatted;
  };

  return (
    <div className="prediction-form">
      <div className="form-content">
        <h2>Telecom Customer Details</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group-container">
            {Object.entries(formData).map(([field, value]) => (
              <div 
                className={`form-group ${activeField === field ? 'active' : ''}`}
                key={field}
              >
                <label htmlFor={field}>{formatLabel(field)}</label>
                <input
                  id={field}
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={(e) => setFormData({
                    ...formData,
                    [field]: e.target.value ? parseFloat(e.target.value) : ''
                  })}
                  onFocus={() => setActiveField(field)}
                  onBlur={() => setActiveField('')}
                  placeholder={`Enter ${formatLabel(field).toLowerCase()}`}
                  required
                />
              </div>
            ))}
          </div>
          <button 
            type="submit" 
            className={isLoading ? 'loading' : ''}
            disabled={isLoading}
          >
            {isLoading ? '' : 'Predict Churn'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TelecomForm;