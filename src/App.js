import React, { useState } from 'react';
import TelecomForm from './components/TelecomForm';
import InsuranceForm from './components/InsuranceForm';
import './App.css';

function App() {
  const [industry, setIndustry] = useState('telecom');
  const [prediction, setPrediction] = useState(null);

  return (
    <div className="container">
      <h1>Customer Churn Prediction System</h1>
      <div className="industry-selector">
        <label>Select Industry:</label>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="telecom">Telecom</option>
          <option value="insurance">Insurance</option>
        </select>
      </div>
      {industry === 'telecom' ? (
        <TelecomForm setPrediction={setPrediction} />
      ) : (
        <InsuranceForm setPrediction={setPrediction} />
      )}
      {prediction && (
        <div className={`prediction ${prediction.churn_risk.toLowerCase()}`}>
          <h2>Prediction Results</h2>
          <p>Churn Probability: {(prediction.churn_probability * 100).toFixed(2)}%</p>
          <p>Risk Level: {prediction.churn_risk}</p>
        </div>
      )}
    </div>
  );
}

export default App;