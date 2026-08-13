import React from 'react';
import { Phone, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EmergencyBanner() {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-3 right-3 z-[100]"
      >
        <div className="bg-red-600/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-red-500 hover:bg-red-700 transition-all">

          {/* Icon */}
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
            <AlertCircle className="w-4 h-4" />
          </div>

          {/* Text */}
          <div className="leading-tight">
            <p className="text-xs font-semibold text-red-100 uppercase">
              24/7 Emergency
            </p>
            <p className="text-sm font-bold">
              Ambulance & Care
            </p>
          </div>

          {/* Call Button */}
          <a
            href="tel:+2348031234567"
            className="flex items-center gap-1 bg-white text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-50 transition"
          >
            <Phone className="w-3.5 h-3.5" />
            Call
          </a>

          {/* Close */}
          <button
            onClick={() => setIsVisible(false)}
            className="text-white/70 hover:text-white text-lg px-1"
          >
            ×
          </button>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}