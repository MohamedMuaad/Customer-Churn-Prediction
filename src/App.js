import React, { useState } from 'react';
import CombinedPredictionComponent from './components/CombinedPredictionComponent';
import InsuranceForm from './components/InsuranceForm';
import './App.css';

function App() {
  const [industry, setIndustry] = useState('telecom');

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Customer Churn Prediction System</h1>
        <div className="industry-selector">
          <label htmlFor="industry-select">Select Industry:</label>
          <select 
            id="industry-select"
            value={industry} 
            onChange={(e) => setIndustry(e.target.value)}
            className="industry-select"
          >
            <option value="telecom">Telecom</option>
            <option value="insurance">Insurance</option>
          </select>
        </div>
      </header>

      <main className="app-main">
        {industry === 'telecom' ? (
          <CombinedPredictionComponent industry={industry} />
        ) : (
          <InsuranceForm />
        )}
      </main>

      <footer className="app-footer">
        {/* <p>© 2025 Customer Churn Prediction System. All rights reserved.</p> */}

      </footer>
    </div>
  );
}

export default App;