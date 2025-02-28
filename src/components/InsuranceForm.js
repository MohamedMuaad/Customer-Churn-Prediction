import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import './InsuranceForm.css';

const InsuranceForm = () => {
  const [bulkPredictions, setBulkPredictions] = useState([]);
  const [singlePrediction, setSinglePrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [activeTab, setActiveTab] = useState('bulk');

  useEffect(() => {
    const handleUnload = () => {
      localStorage.removeItem('insuranceBulkPredictions');
      localStorage.removeItem('insuranceSinglePrediction');
    };

    window.addEventListener('beforeunload', handleUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

  const validateCsvData = (data) => {
    const requiredColumns = [
      'customer_id', 'month', 'policy_start', 'months_to_renewal',
      'customer_age', 'vehicle_value', 'has_claimed',
      'claim_processing_days', 'vehicle_changed', 'renewal_status',
      'churn_next_month'
    ];

    const missingColumns = requiredColumns.filter(col => !data[0].hasOwnProperty(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const fileContent = await file.text();
      Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            validateCsvData(results.data);
            
            const response = await fetch('http://localhost:5000/predict_batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                industry: 'insurance',
                data: results.data,
              }),
            });

            if (!response.ok) throw new Error('Prediction failed');

            const predictionResults = await response.json();
            setBulkPredictions(predictionResults);
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        },
        error: (error) => {
          setError('Failed to parse CSV file');
          setLoading(false);
        },
      });
    } catch (err) {
      setError('Failed to read file');
      setLoading(false);
    }
  };

  const handleSingleSearch = async (e) => {
    e.preventDefault();
    if (!customerId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/predict_single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch prediction');
      }

      const result = await response.json();
      setSinglePrediction(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setBulkPredictions([]);
    setSinglePrediction(null);
    setError(null);
    setCustomerId('');
    localStorage.removeItem('insuranceBulkPredictions');
    localStorage.removeItem('insuranceSinglePrediction');
  };

  const groupedPredictions = {
    High: bulkPredictions
      .filter(pred => pred.churn_risk === 'High')
      .sort((a, b) => b.churn_probability - a.churn_probability),
    Medium: bulkPredictions
      .filter(pred => pred.churn_risk === 'Medium')
      .sort((a, b) => b.churn_probability - a.churn_probability),
    Low: bulkPredictions
      .filter(pred => pred.churn_risk === 'Low')
      .sort((a, b) => b.churn_probability - a.churn_probability)
  };

  const renderBulkUpload = () => (
    <div className="prediction-container">
      <div className="navigation">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            Bulk Upload
          </button>
          <button
            className={`tab ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            Single Search
          </button>
        </div>
        <button className="clear-button" onClick={handleClear}>
          Clear Results
        </button>
      </div>

      {loading && <div className="loading">Processing...</div>}
      {error && <div className="error">{error}</div>}

      <div className="bulk-upload">
        <div className="upload-section">
          <h2>Upload Insurance Customer Data</h2>
          
          <div className="csv-format">
            <h3>Required CSV Format:</h3>
            <ul className="requirements-list">
              <li>customer_id: Unique identifier for each customer</li>
              <li>month: Month number (1-6)</li>
              <li>policy_start: Start date of the policy (YYYY-MM-DD)</li>
              <li>months_to_renewal: Months left until policy renewal</li>
              <li>customer_age: Age of the customer</li>
              <li>vehicle_value: Value of the insured vehicle</li>
              <li>has_claimed: Whether customer made a claim (0/1)</li>
              <li>claim_processing_days: Days taken to process claim</li>
              <li>vehicle_changed: Whether vehicle was changed (0/1)</li>
              <li>renewal_status: Status of renewal</li>
              <li>churn_next_month: Whether customer churned (0/1)</li>
            </ul>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="file-input"
          />
        </div>
        
        <div className="results-section">
          {Object.entries(groupedPredictions).map(([risk, predictions]) => 
            predictions.length > 0 && (
              <div key={risk} className={`bulk-result risk-${risk.toLowerCase()}`}>
                <h3>{risk} Risk Customers</h3>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Customer ID</th>
                      <th>Churn Risk</th>
                      <th>Probability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((pred, idx) => (
                      <tr key={idx} className={`row-${pred.churn_risk.toLowerCase()}`}>
                        <td>{pred.id}</td>
                        <td>{pred.churn_risk}</td>
                        <td>{(pred.churn_probability * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  const renderSingleSearch = () => (
    <div className="prediction-container">
      <div className="navigation">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            Bulk Upload
          </button>
          <button
            className={`tab ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            Single Search
          </button>
        </div>
        <button className="clear-button" onClick={handleClear}>
          Clear Results
        </button>
      </div>

      {loading && <div className="loading">Processing...</div>}
      {error && <div className="error">{error}</div>}

      <div className="single-search">
        <div className="search-section">
          <h2>Search by Customer ID</h2>
          <form onSubmit={handleSingleSearch}>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Enter Customer ID"
              required
            />
            <button type="submit" disabled={loading}>Search</button>
          </form>
        </div>

        {singlePrediction && (
          <div className={`single-result risk-${singlePrediction.churn_risk.toLowerCase()}`}>
            <h3>Prediction Result</h3>
            <div className="prediction-details">
              <p><strong>Customer ID:</strong> {customerId}</p>
              <p><strong>Risk Level:</strong> {singlePrediction.churn_risk}</p>
              <p><strong>Churn Probability:</strong> {(singlePrediction.churn_probability * 100).toFixed(2)}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return activeTab === 'bulk' ? renderBulkUpload() : renderSingleSearch();
};

export default InsuranceForm;