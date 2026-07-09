import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IAdmin } from '../types';

export interface AdminDocument extends Omit<IAdmin, '_id'>, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const adminSchema = new Schema<AdminDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'worker'],
      default: 'admin',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const Admin = mongoose.model<AdminDocument>('Admin', adminSchema);
