import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import './CombinedPredictionComponent.css';

const CombinedPredictionComponent = ({ industry }) => {
  const [bulkPredictions, setBulkPredictions] = useState([]);
  const [singlePrediction, setSinglePrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchId, setSearchId] = useState('');
  const [activeTab, setActiveTab] = useState('bulk');

  useEffect(() => {
    const handleUnload = () => {
      localStorage.removeItem('bulkPredictions');
      localStorage.removeItem('singlePrediction');
    };

    window.addEventListener('beforeunload', handleUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

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
            const response = await fetch('http://localhost:5000/predict_batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                industry,
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
    if (!searchId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/predict_single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [industry === 'telecom' ? 'broadband_number' : 'customer_id']: searchId,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch prediction');

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
    setSearchId('');
    localStorage.removeItem('bulkPredictions');
    localStorage.removeItem('singlePrediction');
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

  const renderBulkPage = () => (
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
          <h2>Upload Telecom Customer Data</h2>
          <div className="csv-format">
            <h3>Required CSV Format:</h3>
            <ul className="requirements-list">
              <li>broadband_number: Unique identifier for each customer</li>
              <li>month: Month number (1-6)</li> 
              <li>data_usage_mb: Total data usage in megabytes</li>
              <li>login_attempts: Number of login attempts</li>
              <li>bill_amount: Monthly bill amount</li>
              <li>payment_delay_days: Number of days payment was delayed</li>
              <li>network_latency_ms: Network latency in milliseconds</li>
              <li>packet_loss_percent: Percentage of packet loss</li>
              <li>download_speed_mbps: Download speed in Mbps</li>
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
                <h3>{risk} Risk Predictions</h3>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>{industry === 'telecom' ? 'Broadband Number' : 'Customer ID'}</th>
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

  const renderSinglePage = () => (
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
          <h2>Single Search</h2>
          <form onSubmit={handleSingleSearch}>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder={industry === 'telecom' ? 'Enter Broadband Number' : 'Enter Customer ID'}
              required
            />
            <button type="submit" disabled={loading}>Search</button>
          </form>
        </div>

        {singlePrediction && (
          <div className={`single-result risk-${singlePrediction.churn_risk.toLowerCase()}`}>
            <h3>Search Result</h3>
            <p><strong>Risk Level:</strong> {singlePrediction.churn_risk}</p>
            <p><strong>Probability:</strong> {(singlePrediction.churn_probability * 100).toFixed(2)}%</p>
          </div>
        )}
      </div>
    </div>
  );

  return activeTab === 'bulk' ? renderBulkPage() : renderSinglePage();
};

export default CombinedPredictionComponent;