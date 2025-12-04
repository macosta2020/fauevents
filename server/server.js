require('dotenv').config();

const express = require('express');
const sql = require('mssql');
const path = require('path');
const bcrypt = require('bcrypt');

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

        // Create Users table
        const createUsersTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' and xtype='U')
            CREATE TABLE Users (
                id INT IDENTITY(1,1) PRIMARY KEY,
                username NVARCHAR(50) NOT NULL UNIQUE,
                email NVARCHAR(100) NOT NULL,
                password NVARCHAR(255) NOT NULL,
                createdAt DATETIME DEFAULT GETDATE()
            )
        `;
        await pool.request().query(createUsersTableQuery);
        console.log("Users table checked/created.");

        // Create Events table
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

// POST /api/register
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).send({ message: 'Username, password, and email are required.' });
    }

    try {
        // Check if user already exists
        const checkUser = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .query('SELECT id FROM Users WHERE username = @username');

        if (checkUser.recordset.length > 0) {
            return res.status(400).send({ message: 'Username already exists.' });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const result = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .input('email', sql.NVarChar(100), email)
            .input('password', sql.NVarChar(255), hashedPassword)
            .query(`
                INSERT INTO Users (username, email, password)
                OUTPUT inserted.id, inserted.username, inserted.email
                VALUES (@username, @email, @password)
            `);

        res.status(201).json({ 
            message: 'User registered successfully.',
            user: result.recordset[0]
        });
    } catch (err) {
        console.error("POST /api/register error:", err.message);
        res.status(500).send({ message: 'Registration failed.', error: err.message });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send({ message: 'Username and password are required.' });
    }

    try {
        // Find user by username
        const result = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .query('SELECT id, username, email, password FROM Users WHERE username = @username');

        if (result.recordset.length === 0) {
            return res.status(401).send({ message: 'Invalid username or password.' });
        }

        const user = result.recordset[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).send({ message: 'Invalid username or password.' });
        }

        // Return user data (without password)
        res.json({
            message: 'Login successful.',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        console.error("POST /api/login error:", err.message);
        res.status(500).send({ message: 'Login failed.', error: err.message });
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
        
        // Only default to NULL if the input is strictly missing or empty.
        if (!timeValue || timeValue.trim() === '') {
            timeValue = null; 
        } 
        
        const finalDescription = description && description.trim() !== '' ? description : null;
        
        const result = await pool.request()
            .input('title', sql.NVarChar(100), title)
            .input('description', sql.NVarChar(sql.MAX), finalDescription) 
            .input('date', sql.Date, date) 
            // FIX: Use NVarChar instead of Time. 
            // This bypasses the driver's strict validation and lets SQL Server handle the AM/PM conversion.
            .input('time', sql.NVarChar(50), timeValue)
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

// DELETE /api/events/:id
app.delete('/api/events/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Events WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).send({ message: 'Event not found' });
        }

        res.status(200).send({ message: 'Event deleted successfully' });
    } catch (err) {
        console.error("DELETE /api/events failure:", err.message);
        res.status(500).send({ message: 'Database deletion failed.', error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Node.js API listening on port ${port}`);
});