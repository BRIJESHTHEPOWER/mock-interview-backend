'use strict';

const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Listening on 0.0.0.0 instead of localhost
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

// Route for /interviews/latest
app.get('/interviews/latest', (req, res) => {
    // Fixing to use endedAt instead of createdAt
    db.collection('interviews').find({ endedAt: { $exists: true } })
        .sort({ endedAt: -1 })
        .limit(1)
        .toArray((err, interviews) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            return res.json(interviews);
        });
});

// Stub routes for missing chatbot and admin routers
app.use('/chatbot', (req, res) => {
    res.status(501).send('Chatbot route not implemented');
});

app.use('/admin', (req, res) => {
    res.status(501).send('Admin route not implemented');
});

// Error handling for feedback generation
app.post('/feedback', (req, res) => {
    // Simulating feedback generation
    try {
        // Assume feedback generation logic
        const feedback = req.body.feedback;
        if (!feedback) {
            throw new Error('Feedback cannot be empty');
        }
        res.status(200).json({ message: 'Feedback generated successfully', feedback });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;