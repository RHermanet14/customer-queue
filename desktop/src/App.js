import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
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
  const location = decodeURIComponent(locationName || '');

  return (
    <div className="App">
      <header className="App-header">
        <h1>{location}</h1>
        <button onClick={() => navigate('/')} className="back-button">
          Back to Locations
        </button>
        <p>Location detail page - coming soon</p>
      </header>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LocationsPage />} />
      <Route path="/location/:locationName" element={<LocationDetailPage />} />
    </Routes>
  );
}

export default App;
