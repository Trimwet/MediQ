import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Departments', path: '/departments' },
  { name: 'Doctors', path: '/doctors' },
  { name: 'Services', path: '/services' },
  { name: 'About', path: '/about' },
  { name: 'Gallery', path: '/gallery' },
  { name: 'FAQ', path: '/faq' },
  { name: 'Contact', path: '/contact' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">

          {/* 🔥 Logo + Name FIX */}
          <Link to="/" className="flex items-center gap-2">

            <img
              src="https://res.cloudinary.com/dgcyqntse/image/upload/v1773725210/1000572077-removebg-preview_o0stug.png"
              alt="Rayfield Hospital Logo"
              className="w-15 h-15 object-contain"
            />

            <div className="leading-tight">
              <h1 className="text-sm font-bold text-slate-900 tracking-wide">
                RAYFIELD MULTISPECIALTY
              </h1>
              <p className="text-xs text-blue-600 font-medium">
                HOSPITAL
              </p>
            </div>

          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  location.pathname === link.path
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
                )}
              >
                {link.name}
              </Link>
            ))}

            {/* 🔥 Book Now FIX */}
            <Link
              to="/appointment"
              className="ml-3 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-md whitespace-nowrap"
            >
              Book Now
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "block px-4 py-3 rounded-xl text-base font-medium",
                    location.pathname === link.path
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {link.name}
                </Link>
              ))}

              <Link
                to="/appointment"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-xl text-base font-semibold mt-4 whitespace-nowrap"
              >
                Book Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}