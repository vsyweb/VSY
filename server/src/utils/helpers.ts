import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { JwtPayload } from '../types';

/**
 * Generates a JWT token for a user or admin.
 */
export const generateToken = (id: string, role: 'user' | 'admin' | 'worker'): string => {
  const payload: JwtPayload = { id, role };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
};

/**
 * Validates date string format YYYY-MM-DD.
 */
export const isValidDate = (dateStr: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = new Date(dateStr + 'T00:00:00');
  return !isNaN(date.getTime());
};

/**
 * Validates Indian phone number (10 digits starting with 6-9).
 */
export const isValidPhone = (phone: string): boolean => {
  return /^[6-9]\d{9}$/.test(phone);
};

/**
 * Validates that the hour is between 0-23.
 */
export const isValidHour = (hour: number): boolean => {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23;
};

/**
 * Checks if a date is today or in the future.
 */
export const isFutureOrToday = (dateStr: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  return date >= today;
};
