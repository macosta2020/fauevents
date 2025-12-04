require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const sql = require('mssql');
const path = require('path');
// const cors = require('cors'); // Removed as per previous fix for ACA

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

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
    requestTimeout: 60000, 
    connectTimeout: 30000 
};

let pool; 

// --- Initialization ---
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
                email NVARCHAR(100),
                createdAt DATETIME DEFAULT GETDATE()
            )
        `;
        await pool.request().query(createUsersTableQuery);
        console.log("Users table checked/created.");

        // 2. Create Events table
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

// --- API Endpoints ---

// AUTH: REGISTER
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password) {
        return res.status(400).send({ message: 'Username and password are required.' });
    }

    try {
        // Check if user exists
        const checkUser = await pool.request()
            .input('username', sql.NVarChar(100), username)
            .query('SELECT * FROM Users WHERE username = @username');

        if (checkUser.recordset.length > 0) {
            return res.status(409).send({ message: 'Username already taken.' });
        }

        // Insert new user (storing plain password for this demo - Use bcrypt in production!)
        await pool.request()
            .input('username', sql.NVarChar(100), username)
            .input('password', sql.NVarChar(256), password) 
            .input('email', sql.NVarChar(100), email || null)
            .query('INSERT INTO Users (username, passwordHash, email) VALUES (@username, @password, @email)');

        res.status(201).send({ message: 'User registered successfully' });
    } catch (err) {
        console.error("Registration Error:", err.message);
        res.status(500).send({ message: 'Server error during registration.' });
    }
});

// AUTH: LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send({ message: 'Username and password are required.' });
    }

    try {
        const result = await pool.request()
            .input('username', sql.NVarChar(100), username)
            .input('password', sql.NVarChar(256), password)
            .query('SELECT userId, username, email FROM Users WHERE username = @username AND passwordHash = @password');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            res.json({ message: 'Login successful', user });
        } else {
            res.status(401).send({ message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).send({ message: 'Server error during login.' });
    }
});

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