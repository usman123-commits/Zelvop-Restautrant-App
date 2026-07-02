const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

function userResponse(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    contactNumber: user.contactNumber,
    profilePhoto: user.profilePhoto,
    isOnline: user.isOnline,
    createdAt: user.createdAt,
  };
}

// POST /api/v1/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, contactNumber } = req.body;

    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ error: 'Name, email, password, and role are required' });
    }

    if (!['owner', 'rider'].includes(role)) {
      return res.status(400).json({ error: 'Role must be owner or rider' });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      contactNumber: contactNumber || undefined,
    });

    const token = user.generateAuthToken();

    res.status(201).json({ token, user: userResponse(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = user.generateAuthToken();

    res.json({ token, user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/v1/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ user: userResponse(req.user) });
});

// PATCH /api/v1/auth/profile -- update name, email, phone
router.patch('/profile', protect, async (req, res) => {
  try {
    const { name, email, contactNumber } = req.body;
    const updates = {};

    if (name && name.trim()) updates.name = name.trim();
    if (email && email.trim()) {
      const lower = email.trim().toLowerCase();
      if (lower !== req.user.email) {
        const existing = await User.findOne({ email: lower });
        if (existing) {
          return res.status(400).json({ error: 'Email already in use' });
        }
      }
      updates.email = lower;
    }
    if (contactNumber !== undefined) {
      updates.contactNumber = contactNumber.trim() || undefined;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ user: userResponse(user) });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether email exists
      return res.json({ message: 'If that email exists, a reset link was sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 min
    await user.save({ validateBeforeSave: false });

    // TODO: Send email with reset link using nodemailer
    // For now, return the token in dev mode
    const response = { message: 'If that email exists, a reset link was sent' };
    if (process.env.NODE_ENV !== 'production') {
      response.resetToken = resetToken;
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/v1/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters' });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = user.generateAuthToken();
    res.json({ token, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
