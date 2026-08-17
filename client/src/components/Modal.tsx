import React from 'react';
import { MdClose } from 'react-icons/md';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative flex flex-col ${maxWidth} w-full max-h-[95vh] sm:max-h-[90vh] bg-surface-950 border border-white/10 rounded-2xl shadow-2xl shadow-black/90 animate-scale-in overflow-hidden`}>
        {/* Header */}
        <div className="flex-none flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-surface-900/50 backdrop-blur-md">
          <h3 className="text-lg font-display font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-surface-400 hover:text-white transition-all"
          >
            <MdClose size={18} />
          </button>
        </div>
        
        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
