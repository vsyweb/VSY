import { Request, Response } from 'express';
import { User } from '../models/User';
import { Admin } from '../models/Admin';
import { generateToken, isValidPhone } from '../utils/helpers';

/**
 * User login/register with phone number only.
 * If phone exists, log in. If not, create account automatically.
 */
export const loginWithPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, name } = req.body;

    if (!phone || !isValidPhone(phone)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit Indian phone number',
      });
      return;
    }

    // Find or create user
    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        phone,
        name: name || `User ${phone.slice(-4)}`,
      });
    }

    const token = generateToken(user._id.toString(), 'user');

    res.status(200).json({
      success: true,
      message: user.createdAt === user.updatedAt ? 'Account created successfully' : 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Get current user profile.
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-__v');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved',
      data: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get profile';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Update user name.
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }

    const updates: any = { name: name.trim() };
    if (email !== undefined) {
      updates.email = typeof email === 'string' ? email.trim() : '';
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      updates,
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    res.status(500).json({ success: false, message });
  }
};

/**
 * Admin login with email and password.
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const token = generateToken(admin._id.toString(), admin.role);

    res.status(200).json({
      success: true,
      message: admin.role === 'worker' ? 'Worker login successful' : 'Admin login successful',
      data: {
        token,
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin login failed';
    res.status(500).json({ success: false, message });
  }
};

