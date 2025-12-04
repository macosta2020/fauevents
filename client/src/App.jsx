import React, { useState, useEffect } from 'react';

// --- Event Card Component ---
const EventCard = ({ event }) => (
  <div className="p-4 bg-white rounded-xl shadow-md transition duration-300 hover:shadow-lg border border-gray-100">
    <h3 className="text-lg font-semibold text-gray-800">{event.title}</h3>
    <p className="text-sm text-indigo-600 font-medium mt-1">
      {new Date(event.date).toLocaleDateString()} @ {event.time}
    </p>
    <p className="text-gray-500 text-sm mt-2">{event.description}</p>
    <div className="mt-3 flex space-x-2 text-xs">
      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
        ID: {event.id}
      </span>
      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
        User: {event.userId}
      </span>
    </div>
  </div>
);

// --- Main Application Component ---
const App = () => {
  // CRITICAL FIX: Always use the relative path. SWA handles the absolute routing.
  const API_URL = '/api/events'; 

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');

  // --- Fetch Data (GET) ---
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      // CORRECTED FETCH: Use API_URL directly
      const response = await fetch(API_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setEvents(data);
    } catch (err) {
      setError(`Failed to fetch events from API: ${err.message}. Using mock data.`);
      // Mock Data (if API is unreachable during local testing)
      setEvents([
        { id: 99, title: "Mock Team Sync", description: "Review Azure SQL Connection.", date: "2025-12-05", time: "10:00", userId: "local-dev" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Dynamically inject Tailwind CSS if missing
    const scriptId = 'tailwind-cdn';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }

    fetchEvents();
  }, []);

  // --- Submit Data (POST) ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !date) {
      setError("Title and Date are required.");
      return;
    }

    // Hardcoded user ID since login is disabled
    const newEvent = { title, description, date, time, userId: "anonymous_user" };
    setLoading(true);
    setError(null);

    try {
      // CORRECTED FETCH: Use API_URL directly
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });

      // Capture the detailed error from the backend JSON response
      const data = await response.json();

      if (!response.ok) {
        // Use the backend's 'error' or 'message' field
        throw new Error(data.error || data.message || 'Failed to add event to backend.');
      }

      await fetchEvents();

      // Clear form
      setTitle('');
      setDescription('');
      setDate('');
      setTime('09:00');

    } catch (err) {
      setError(`Error submitting event: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="py-6 mb-8 border-b-2 border-indigo-100">
          <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">
            FAU Events
          </h1>
          <p className="text-gray-500 mt-1">Event Scheduler</p>
        </header>

        {/* Error/Loading Feedback */}
        {error && (
          <div className="p-3 mb-4 text-sm text-red-800 bg-red-100 rounded-lg" role="alert">
            {typeof error === 'string' ? error : 'An error occurred'}
          </div>
        )}
        {loading && (
          <div className="p-3 mb-4 text-sm text-blue-800 bg-blue-100 rounded-lg animate-pulse">
            Loading data...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Column 1: Add New Event Form */}
          <section className="lg:col-span-1 p-6 bg-white rounded-2xl shadow-xl h-fit sticky top-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-3">Schedule New Event</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Database Systems Exam"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Event details..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  rows="2"
                />
              </div>
              
              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  id="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 disabled:bg-indigo-400"
              >
                {loading ? 'Adding...' : 'Add Event'}
              </button>
            </form>
          </section>

          {/* Column 2 & 3: Event List */}
          <section className="lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-3">Upcoming Events ({events.length})</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.length > 0 ? (
                events.map(event => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <div className="md:col-span-2 p-6 text-center bg-white rounded-lg shadow-inner text-gray-500">
                  No events found.
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default App;