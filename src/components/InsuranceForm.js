import React, { useState } from 'react';
import axios from 'axios';

function InsuranceForm({ setPrediction }) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState('');
  const [formData, setFormData] = useState({
    customer_age: '',
    policy_age: '',
    vehicle_value: '',
    total_claims: '',
    avg_claim_processing: '',
    vehicle_changes: '',
    months_to_renewal: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/predict', {
        industry: 'insurance',
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
        <h2>Insurance Customer Details</h2>
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

export default InsuranceForm;