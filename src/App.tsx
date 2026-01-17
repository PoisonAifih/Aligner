import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminUserCreate from './pages/AdminUserCreate';
import AdminAssignment from './pages/AdminAssignment';
import DentistDashboard from './pages/DentistDashboard';
import Profile from './pages/Profile';
import MainLayout from './components/MainLayout';
import AdminGuard from './components/AdminGuard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/aligner" element={<Login />} />
        
        {/* Protected Routes directly wrapped in Layout for now - Auth check is inside Dashboard items usually, 
            but strictly speaking we should have a RequireAuth wrapper. 
            For this refactor, we just apply the Layout. */}
        <Route element={<MainLayout />}>
            <Route path="/aligner/timer" element={<Dashboard />} />
            
            <Route element={<AdminGuard />}>
                <Route path="/aligner/admin/create-user" element={<AdminUserCreate />} />
                <Route path="/aligner/admin/assign" element={<AdminAssignment />} />
            </Route>

            <Route path="/aligner/dentist" element={<DentistDashboard />} />
            <Route path="/aligner/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/aligner" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
