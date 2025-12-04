require('dotenv').config();

const express = require('express');
const sql = require('mssql');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

const sqlConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true, 
        trustServerCertificate: false
    },
    requestTimeout: 60000, 
    connectTimeout: 30000 
};

let pool; 

const initializeDatabase = async () => {
    try {
        if (!pool) {
            pool = await sql.connect(sqlConfig);
            console.log("SQL Database connection successful.");
        }

        // Only ensure Events table exists (No Users table)
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

initializeDatabase();

// GET /api/events
app.get('/api/events', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT id, title, description, CONVERT(NVARCHAR, date, 23) as date, CONVERT(NVARCHAR, time, 8) as time, userId FROM Events ORDER BY date DESC');
        res.json(result.recordset);
    } catch (err) {
        console.error("GET /api/events error:", err.message);
        res.status(500).send({ message: 'Failed to retrieve events.', error: err.message });
    }
});

// POST /api/events
app.post('/api/events', async (req, res) => {
    let { title, description, date, time, userId } = req.body;

    if (!title || !date) {
        return res.status(400).send({ message: 'Title and date are required.' });
    }

    try {
        let timeValue = time;
        if (!timeValue || timeValue === '09:00' || timeValue.trim() === '') {
            timeValue = null; 
        } 
        
        const finalDescription = description && description.trim() !== '' ? description : null;
        
        const result = await pool.request()
            .input('title', sql.NVarChar(100), title)
            .input('description', sql.NVarChar(sql.MAX), finalDescription) 
            .input('date', sql.Date, date) 
            .input('time', sql.Time, timeValue)
            .input('userId', sql.NVarChar(50), userId || 'anonymous')
            .query(`
                INSERT INTO Events (title, description, date, time, userId)
                OUTPUT inserted.id, inserted.title, inserted.description, CONVERT(NVARCHAR, inserted.date, 23) as date, CONVERT(NVARCHAR, inserted.time, 8) as time, inserted.userId
                VALUES (@title, @description, @date, @time, @userId)
            `);

        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error("POST /api/events failure: FULL ERROR:", err.message);
        res.status(500).send({ message: 'Database query failed.', error: err.message });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
    }
});

app.listen(port, () => {
    console.log(`Node.js API listening on port ${port}`);
});