import mongoose, { Schema, Document } from 'mongoose';
import { IBlockedSlot, TurfId } from '../types';

export interface BlockedSlotDocument extends Omit<IBlockedSlot, '_id'>, Document {}

const blockedSlotSchema = new Schema<BlockedSlotDocument>(
  {
    turfId: {
      type: String,
      enum: ['A', 'B'] as TurfId[],
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    startHour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
    },
    reason: {
      type: String,
      default: '',
    },
    phoneNumber: {
      type: String,
      default: '',
    },
    customerName: {
      type: String,
      default: '',
    },
    groupId: {
      type: String,
      required: false,
    },
    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

blockedSlotSchema.index({ turfId: 1, date: 1, startHour: 1 }, { unique: true });

export const BlockedSlot = mongoose.model<BlockedSlotDocument>('BlockedSlot', blockedSlotSchema);
