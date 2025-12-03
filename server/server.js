require('dotenv').config();

const express = require('express');
const sql = require('mssql');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080; // ACA will use this port

app.use(express.json());

// --- Database Configuration (Reads from environment variables set in ACA) ---
const sqlConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER, // e.g., 'myserver.database.windows.net'
    database: process.env.SQL_DATABASE, // e.g., 'MyScheduleDB'
    options: {
        encrypt: true, // Use HTTPS connection for security
        trustServerCertificate: false // Recommended for production environments
    }
};

let pool; // Global connection pool

// --- Initialization: Connect to SQL and ensure table exists ---
const initializeDatabase = async () => {
    try {
        if (!pool) {
            pool = await sql.connect(sqlConfig);
            console.log("SQL Database connection successful.");
        }

        // Create Events table if it doesn't exist
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Events' and xtype='U')
            CREATE TABLE Events (
                id INT IDENTITY(1,1) PRIMARY KEY,
                title NVARCHAR(100) NOT NULL,
                description NVARCHAR(MAX),
                date DATE NOT NULL,
                time TIME,
                userId NVARCHAR(50)
            )
        `;
        await pool.request().query(createTableQuery);
        console.log("Events table checked/created.");

    } catch (err) {
        console.error("Database Initialization Error:", err.message);
        // Exit process or handle gracefully if connection is critical
    }
};

// Start database initialization immediately
initializeDatabase();

// --- API Endpoints ---

// GET /api/events: Retrieve all events
app.get('/api/events', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT id, title, description, CONVERT(NVARCHAR, date, 23) as date, CONVERT(NVARCHAR, time, 8) as time, userId FROM Events ORDER BY date DESC');
        res.json(result.recordset);
    } catch (err) {
        console.error("GET /api/events error:", err.message);
        res.status(500).send({ message: 'Failed to retrieve events.', error: err.message });
    }
});

// POST /api/events: Create a new event
app.post('/api/events', async (req, res) => {
    const { title, description, date, time, userId } = req.body;

    if (!title || !date) {
        return res.status(400).send({ message: 'Title and date are required.' });
    }

    try {
        const result = await pool.request()
            .input('title', sql.NVarChar(100), title)
            .input('description', sql.NVarChar(sql.MAX), description)
            .input('date', sql.Date, date)
            .input('time', sql.Time, time || '00:00:00')
            .input('userId', sql.NVarChar(50), userId || 'anonymous')
            .query(`
                INSERT INTO Events (title, description, date, time, userId)
                OUTPUT inserted.*
                VALUES (@title, @description, @date, @time, @userId)
            `);

        // OUTPUT inserted.* returns the newly created record, including the auto-generated ID
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error("POST /api/events error:", err.message);
        res.status(500).send({ message: 'Failed to add event.', error: err.message });
    }
});

// Serve the React frontend's static build files (optional: if using a monolithic deployment)
// Since we are using ACA for the backend and SWA for the frontend, this block is for local development only.
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Node.js API listening on port ${port}`);
});