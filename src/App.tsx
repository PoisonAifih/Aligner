import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminUserCreate from './pages/AdminUserCreate';
import AdminAssignment from './pages/AdminAssignment';
import AdminUsers from './pages/AdminUsers';
import DentistDashboard from './pages/DentistDashboard';
import DentistPatientDetail from './pages/DentistPatientDetail';
import Profile from './pages/Profile';
import MainLayout from './components/MainLayout';
import AdminGuard from './components/AdminGuard';
import RequireAuth from './components/RequireAuth';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/aligner" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<MainLayout />}>
              <Route path="/aligner/profile" element={<Profile />} />

              <Route element={<RequireAuth roles={['user']} />}>
                <Route path="/aligner/timer" element={<Dashboard />} />
              </Route>

              <Route element={<RequireAuth roles={['dentist']} />}>
                <Route path="/aligner/dentist" element={<DentistDashboard />} />
                <Route path="/aligner/dentist/patients/:patientId" element={<DentistPatientDetail />} />
              </Route>

              <Route element={<RequireAuth roles={['admin']} />}>
                <Route element={<AdminGuard />}>
                  <Route path="/aligner/admin/users" element={<AdminUsers />} />
                  <Route path="/aligner/admin/create-user" element={<AdminUserCreate />} />
                  <Route path="/aligner/admin/assign" element={<AdminAssignment />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/aligner" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
