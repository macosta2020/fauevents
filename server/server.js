require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const sql = require('mssql');
const path = require('path');
// const cors = require('cors'); // --- DELETED LINE ---

const app = express();
const port = process.env.PORT || 8080;

// Middleware to parse JSON
app.use(express.json());
// app.use(cors(corsOptions)); // --- DELETED LINE ---


// --- Database Configuration ---
const sqlConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true, 
        trustServerCertificate: false
    },
    // INCREASE TIMEOUTS for stability
    requestTimeout: 60000, 
    connectTimeout: 30000 
};

let pool; 

// --- Initialization: Connect to SQL and ensure tables exist ---
const initializeDatabase = async () => {
    try {
        if (!pool) {
            pool = await sql.connect(sqlConfig);
            console.log("SQL Database connection successful.");
        }

        // 1. Create Users table
        const createUsersTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' and xtype='U')
            CREATE TABLE Users (
                userId INT IDENTITY(1,1) PRIMARY KEY,
                username NVARCHAR(100) NOT NULL UNIQUE,
                passwordHash NVARCHAR(256) NOT NULL,
                email NVARCHAR(100) UNIQUE,
                createdAt DATETIME DEFAULT GETDATE()
            )
        `;
        await pool.request().query(createUsersTableQuery);
        console.log("Users table checked/created.");

        // 2. Create Events table (The current schema is correct)
        const createEventsTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Events' and xtype='U')
            CREATE TABLE Events (
                id INT IDENTITY(1,1) PRIMARY KEY,
                title NVARCHAR(100) NOT NULL,
                description NVARCHAR(MAX),
                date DATE NOT NULL,
                time TIME,
                userId NVARCHAR(50), 
                createdAt DATETIME DEFAULT GETDATE()
            )
        `;
        await pool.request().query(createEventsTableQuery);
        console.log("Events table checked/created.");

    } catch (err) {
        console.error("Database Initialization Error:", err.message);
        process.exit(1); 
    }
};

// Start database initialization immediately
initializeDatabase();

// --- API Endpoints ---

// GET /api/events: Retrieve all events
app.get('/api/events', async (req, res) => {
    console.log("GET Request received for /api/events");
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
    console.log("POST Request received for /api/events. Body:", req.body);
    let { title, description, date, time, userId } = req.body;

    if (!title || !date) {
        return res.status(400).send({ message: 'Title and date are required.' });
    }

    try {
        // --- CRITICAL FIX: Ensure time is NULL if not explicitly provided ---
        let timeValue = time;
        if (!timeValue || timeValue === '09:00' || timeValue.trim() === '') {
            timeValue = null; 
        } 
        
        // Handle description safely
        const finalDescription = description && description.trim() !== '' ? description : null;
        
        const result = await pool.request()
            .input('title', sql.NVarChar(100), title)
            .input('description', sql.NVarChar(sql.MAX), finalDescription) 
            .input('date', sql.Date, date) 
            .input('time', sql.Time, timeValue) // Now safely passes NULL
            .input('userId', sql.NVarChar(50), userId || 'anonymous')
            .query(`
                INSERT INTO Events (title, description, date, time, userId)
                OUTPUT inserted.id, inserted.title, inserted.description, CONVERT(NVARCHAR, inserted.date, 23) as date, CONVERT(NVARCHAR, inserted.time, 8) as time, inserted.userId
                VALUES (@title, @description, @date, @time, @userId)
            `);

        // Return the newly created record
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        // Logging the full database error to the console (Terminal 1)
        console.error("POST /api/events failure: FULL ERROR:", err.message);
        // Sending a 500 error to the client
        res.status(500).send({ message: 'Database query failed.', error: err.message });
    }
});

// Serve the React frontend's static build files (optional)
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