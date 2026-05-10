import React from 'react';
import type { SlotInfo, TurfId } from '../types';
import { formatCurrency } from '../utils/helpers';
import { MdLock, MdBlock, MdCheckCircle } from 'react-icons/md';

interface SlotGridProps {
  slots: SlotInfo[];
  turfId: TurfId;
  selectedSlotHours: number[];
  onSlotToggle: (slot: SlotInfo) => void;
  isLoading: boolean;
}

const SlotGrid: React.FC<SlotGridProps> = ({ slots, turfId, selectedSlotHours, onSlotToggle, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse shimmer-bg" />
        ))}
      </div>
    );
  }

  const getStatusIcon = (slot: SlotInfo) => {
    if (selectedSlotHours.includes(slot.hour)) {
      return <MdCheckCircle className="text-primary-400" size={18} />;
    }

    switch (slot.status) {
      case 'booked':
        return <MdCheckCircle className="text-red-400" size={14} />;
      case 'blocked':
        return <MdBlock className="text-surface-500" size={14} />;
      case 'locked':
        return <MdLock className="text-amber-400" size={14} />;
      case 'pending':
        return <MdLock className="text-orange-400 animate-pulse" size={14} />;
      default:
        return null;
    }
  };

  const getStatusLabel = (slot: SlotInfo) => {
    if (selectedSlotHours.includes(slot.hour)) {
      return 'Selected';
    }

    switch (slot.status) {
      case 'available':
        return 'Available';
      case 'booked':
        return 'Booked';
      case 'blocked':
        return 'Blocked';
      case 'locked':
        return 'Held';
      case 'pending':
        return 'Pending...';
      default:
        return '';
    }
  };

  return (
    <div>
      {/* Turf Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${turfId === 'A' ? 'bg-primary-500' : 'bg-accent-500'}`} />
        <h3 className="font-display font-bold text-lg text-white">
          Arena {turfId === 'A' ? '1' : '2'}
        </h3>
        <span className="text-xs text-surface-400 bg-white/5 px-2 py-1 rounded-full">
          360° Box Cricket
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500/30 border border-green-500/50" />
          <span className="text-xs text-surface-400">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary-500/50 border border-primary-500" />
          <span className="text-xs text-surface-400">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500/30 border border-red-500/50" />
          <span className="text-xs text-surface-400">Booked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-surface-600/30 border border-surface-500/50" />
          <span className="text-xs text-surface-400">Blocked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-500/30 border border-orange-500/50 animate-pulse" />
          <span className="text-xs text-surface-400">Payment Pending</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {slots.map((slot) => {
          const isSelected = selectedSlotHours.includes(slot.hour);
          return (
            <button
              key={slot.hour}
              onClick={() => slot.status === 'available' && onSlotToggle(slot)}
              disabled={slot.status !== 'available'}
              className={`relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl border
                transition-all duration-300 min-h-[106px]
                ${slot.status === 'available' 
                  ? isSelected 
                    ? 'bg-primary-500/20 border-primary-500 ring-2 ring-primary-500/20 scale-[1.05] z-10 shadow-lg shadow-primary-500/20' 
                    : 'slot-available hover:scale-[1.03]' 
                  : ''}
                ${slot.status === 'booked' ? 'slot-booked' : ''}
                ${slot.status === 'pending' ? 'bg-orange-500/10 border-orange-500/30 ring-1 ring-orange-500/20' : ''}
                ${slot.status === 'blocked' ? 'slot-blocked' : ''}
                ${slot.status === 'locked' ? 'slot-locked' : ''}
              `}
            >
              {/* Status icon */}
              <div className="absolute top-2 right-2">
                {getStatusIcon(slot)}
              </div>

              {/* Time */}
              <span className={`text-xs font-bold leading-tight text-center ${isSelected ? 'text-primary-400' : ''}`}>
                {slot.timeLabel.split(' - ')[0]}
              </span>
              <span className="text-[10px] opacity-60">to</span>
              <span className={`text-xs font-bold leading-tight text-center ${isSelected ? 'text-primary-400' : ''}`}>
                {slot.timeLabel.split(' - ')[1]}
              </span>

              {/* Price */}
              <span className={`text-sm font-black mt-1 ${
                isSelected ? 'text-white' : slot.status === 'available' ? 'text-green-300' : 'opacity-50'
              }`}>
                {formatCurrency(slot.price)}
              </span>

              {/* Status label */}
              <span className={`text-[9px] uppercase tracking-wider font-bold mt-1 ${isSelected ? 'text-primary-400' : 'opacity-70'}`}>
                {getStatusLabel(slot)}
              </span>
              
              {isSelected && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-primary-500 text-[8px] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">
                  Picked
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SlotGrid;
