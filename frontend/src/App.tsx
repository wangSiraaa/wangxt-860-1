import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectStatistics from './pages/ProjectStatistics';
import ProjectList from './pages/projects/ProjectList';
import ProjectDetail from './pages/projects/ProjectDetail';
import ProjectCreate from './pages/projects/ProjectCreate';
import MilestoneList from './pages/milestones/MilestoneList';
import MilestoneDetail from './pages/milestones/MilestoneDetail';
import RiskList from './pages/risks/RiskList';
import RiskDetail from './pages/risks/RiskDetail';
import MeetingList from './pages/meetings/MeetingList';
import MeetingDetail from './pages/meetings/MeetingDetail';
import AcceptanceList from './pages/acceptance/AcceptanceList';
import AcceptanceDetail from './pages/acceptance/AcceptanceDetail';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="statistics" element={<ProjectStatistics />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/create" element={<ProjectCreate />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="milestones" element={<MilestoneList />} />
        <Route path="milestones/:id" element={<MilestoneDetail />} />
        <Route path="risks" element={<RiskList />} />
        <Route path="risks/:id" element={<RiskDetail />} />
        <Route path="meetings" element={<MeetingList />} />
        <Route path="meetings/:id" element={<MeetingDetail />} />
        <Route path="acceptance" element={<AcceptanceList />} />
        <Route path="acceptance/:id" element={<AcceptanceDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;
