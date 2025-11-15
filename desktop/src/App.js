import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import './App.css';

function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3000/api/locations')
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.message || 'Failed to fetch locations');
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('Locations received:', data);
        setLocations(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching locations:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleLocationClick = (location) => {
    navigate(`/location/${encodeURIComponent(location)}`);
  };

  if (loading) {
    return <div className="App">Loading locations...</div>;
  }

  if (error) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Error Loading Locations</h1>
          <p style={{ color: '#ff6b6b' }}>{error}</p>
          <p style={{ fontSize: '14px', marginTop: '20px' }}>
            Check the browser console and backend logs for more details.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Select a Location</h1>
        {locations.length === 0 ? (
          <p>No locations found. Please check the database.</p>
        ) : (
          <div className="locations-grid">
            {locations.map((location) => (
              <div
                key={location}
                className="location-cell"
                onClick={() => handleLocationClick(location)}
              >
                {location}
              </div>
            ))}
          </div>
        )}
      </header>
    </div>
  );
}

function LocationDetailPage() {
  const navigate = useNavigate();
  const { locationName } = useParams();
  const initialLocation = decodeURIComponent(locationName || '');
  
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch available locations for the dropdown
    fetch('http://localhost:3000/api/locations')
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.message || 'Failed to fetch locations');
          });
        }
        return response.json();
      })
      .then(data => {
        setLocations(data);
        // If initial location is not in the list, add it or use first available
        if (initialLocation && !data.includes(initialLocation)) {
          setSelectedLocation(data[0] || '');
        }
      })
      .catch(err => {
        console.error('Error fetching locations:', err);
        setError(err.message);
      });
  }, [initialLocation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    if (!selectedLocation) {
      setError('Please select a location');
      return;
    }

    setSubmitting(true);
    setError(null);
 
    try {
      const response = await fetch('http://localhost:3000/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          location: selectedLocation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add customer to queue');
      }

      navigate(`/queue-status/${data.customer_id}`, {
        state: {
          firstName: firstName.trim(),
          location: selectedLocation,
          initialQueuePosition: data.queue_position,
        },
        replace: false,
      });
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err.message || 'Failed to add customer to queue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Join Queue</h1>
        <button onClick={() => navigate('/')} className="back-button">
          Back to Locations
        </button>
        
        <form onSubmit={handleSubmit} className="queue-form">
          <div className="form-group">
            <label htmlFor="location">Location:</label>
            <select
              id="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="form-input"
              disabled={submitting}
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="firstName">First Name:</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="form-input"
              placeholder="Enter your first name"
              disabled={submitting}
              required
            />
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Join Queue'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </header>
    </div>
  );
}

function QueueStatusPage() {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const locationState = useLocation();
  const stateData = (locationState && locationState.state) || {};

  const [queuePosition, setQueuePosition] = useState(stateData.initialQueuePosition ?? null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchStatus = async () => {
    if (!customerId) {
      setError('Missing customer ID');
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const response = await fetch(`http://localhost:3000/queue/customer/${customerId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load queue status');
      }

      setQueuePosition(data.queue_position);
      setStatus(data.status);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load queue status');
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleCancel = async () => {
    if (!customerId) {
      setError('Missing customer ID');
      return;
    }

    if (!window.confirm('Are you sure you want to cancel your place in the queue?')) {
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:3000/queue/customer/${customerId}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel queue entry');
      }

      // Navigate back to locations page after successful cancellation
      navigate('/');
    } catch (err) {
      console.error('Error cancelling queue entry:', err);
      setError(err.message || 'Failed to cancel queue entry');
    } finally {
      setCancelling(false);
    }
  };

  const renderStatusMessage = () => {
    if (loading) {
      return <p className="status-subtitle">Loading your queue status...</p>;
    }

    if (error) {
      return <p className="status-error">{error}</p>;
    }

    if (!status) {
      return <p className="status-subtitle">Waiting for status update...</p>;
    }

    if (status === 'pending') {
      return (
        <div className="status-card pending">
          <h2>You're in the queue</h2>
          <p className="queue-position">Current position: <strong>{queuePosition ?? 'Loading...'}</strong></p>
          <p className="status-subtitle">Click refresh to check for updates.</p>
        </div>
      );
    }

    if (status === 'in_progress') {
      return (
        <div className="status-card in-progress">
          <h2>It's your turn!</h2>
          <p className="status-subtitle">An employee is headed your way.</p>
          <p className="status-close-message">You can now close this tab.</p>
        </div>
      );
    }

    if (status === 'completed') {
      return (
        <div className="status-card completed">
          <h2>You're all set!</h2>
          <p className="status-subtitle">Thanks for visiting.</p>
          <p className="status-close-message">You can now close this tab.</p>
        </div>
      );
    }

    return (
      <div className="status-card other">
        <h2>Status: {status}</h2>
        <p className="status-subtitle">Please wait for further updates.</p>
      </div>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Queue Status</h1>
        {stateData.firstName && (
          <p className="status-greeting">Hi {stateData.firstName}</p>
        )}
        {stateData.location && (
          <p className="status-location">Location: {stateData.location}</p>
        )}

        {renderStatusMessage()}

        {(status === 'pending' || !status) && (
          <button 
            onClick={fetchStatus} 
            className="refresh-button"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </button>
        )}

        {(status === 'pending' || status === 'in_progress' || !status) && (
          <button 
            onClick={handleCancel} 
            className="cancel-button"
            disabled={cancelling}
            style={{ marginTop: '40px' }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Queue Entry'}
          </button>
        )}
      </header>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LocationsPage />} />
      <Route path="/location/:locationName" element={<LocationDetailPage />} />
      <Route path="/queue-status/:customerId" element={<QueueStatusPage />} />
    </Routes>
  );
}

export default App;
