import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

          {/* 🔥 BRAND (FIXED) */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3">

              {/* Logo */}
              <div className="bg-white p-1.5 rounded-lg flex items-center justify-center">
                <img
                  src="https://res.cloudinary.com/dgcyqntse/image/upload/v1773725210/1000572077-removebg-preview_o0stug.png"
                  alt="Rayfield Hospital Logo"
                  className="w-10 h-10 object-contain"
                />
              </div>

              {/* Text */}
              <div className="leading-tight">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  RAYFIELD MULTISPECIALTY
                </h2>
                <p className="text-sm text-blue-500 font-medium">
                  HOSPITAL
                </p>
              </div>

            </Link>

            <p className="text-slate-400 leading-relaxed text-sm">
              Providing world-class healthcare services with a patient-first approach.
              Our mission is to improve lives through advanced medical technology and compassionate care.
            </p>

            {/* Social Icons */}
            <div className="flex space-x-4">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="p-2 bg-slate-800 rounded-full hover:bg-blue-600 hover:text-white transition"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-4">
              <li><Link to="/about" className="hover:text-blue-400 transition">About Us</Link></li>
              <li><Link to="/doctors" className="hover:text-blue-400 transition">Our Doctors</Link></li>
              <li><Link to="/departments" className="hover:text-blue-400 transition">Departments</Link></li>
              <li><Link to="/services" className="hover:text-blue-400 transition">Services</Link></li>
              <li><Link to="/appointment" className="hover:text-blue-400 transition">Book Appointment</Link></li>
            </ul>
          </div>

          {/* Departments */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Departments</h3>
            <ul className="space-y-4">
              <li><Link to="/departments" className="hover:text-blue-400 transition">Cardiology</Link></li>
              <li><Link to="/departments" className="hover:text-blue-400 transition">Neurology</Link></li>
              <li><Link to="/departments" className="hover:text-blue-400 transition">Orthopedics</Link></li>
              <li><Link to="/departments" className="hover:text-blue-400 transition">Pediatrics</Link></li>
              <li><Link to="/departments" className="hover:text-blue-400 transition">Dermatology</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Contact Us</h3>
            <ul className="space-y-4 text-sm">

              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-blue-500 mt-1" />
                <span>
                  14 Rayfield Road,<br />
                  Near Zoo Road Roundabout,<br />
                  Jos, Plateau State, Nigeria
                </span>
              </li>

              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-blue-500" />
                <span>
                  +234 803 123 4567<br />
                  +234 807 234 5678
                </span>
              </li>

              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-500" />
                <span>rayfieldhospital2026@gmail.com</span>
              </li>

            </ul>
          </div>

        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Rayfield Multispecialty Hospital. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
}