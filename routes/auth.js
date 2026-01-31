const express = require('express');
const router = express.Router();
const { auth } = require('../firebase');

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        console.log(`🔑 Generating password reset link for: ${email}`);

        // Check if user exists first
        try {
            await auth.getUserByEmail(email);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                return res.status(404).json({ error: 'No user found with this email address' });
            }
            throw error;
        }

        // Generate the reset link
        const link = await auth.generatePasswordResetLink(email);

        console.log('✅ Reset link generated successfully');

        res.json({
            success: true,
            message: 'Reset link generated',
            link: link // Returning the link directly since internal emails are failing
        });

    } catch (error) {
        console.error('❌ Reset password error:', error.message);
        res.status(500).json({ error: 'Failed to generate reset link', details: error.message });
    }
});

module.exports = router;
