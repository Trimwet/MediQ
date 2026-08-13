import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import MainLayout from './layout/MainLayout';
import ScrollToTop from "./components/ScrollToTop";

import Home from './pages/Home';
import About from './pages/About';
import Doctors from './pages/Doctors';
import DoctorProfile from './pages/DoctorProfile';
import Departments from './pages/Departments';
import DepartmentDetails from './pages/DepartmentDetails';
import Services from './pages/Services';
import Appointment from './pages/Appointment';
import Gallery from './pages/Gallery';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';

export default function App() {
  return (
    <Router>

      {/* THIS FIXES YOUR SCROLL ISSUE */}
      <ScrollToTop />

      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="doctors" element={<Doctors />} />
          <Route path="doctors/:doctorId" element={<DoctorProfile />} />
          <Route path="departments" element={<Departments />} />
          <Route path="departments/:id" element={<DepartmentDetails />} />
          <Route path="services" element={<Services />} />
          <Route path="appointment" element={<Appointment />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="contact" element={<Contact />} />
        </Route>
      </Routes>

    </Router>
  );
}