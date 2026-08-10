import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import { CustomThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ExamSetupPage } from './pages/ExamSetupPage';
import { ExamRunnerPage } from './pages/ExamRunnerPage';
import { ExamReviewPage } from './pages/ExamReviewPage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

export const SidebarContext = createContext({ collapsed: false, toggleCollapsed: () => {} });
export const useSidebar = () => useContext(SidebarContext);

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { collapsed } = useSidebar();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        <Sidebar />
        <Box
          component="main"
          className="fade-in"
          sx={{
            flexGrow: 1,
            p: 3,
            overflow: 'auto',
            bgcolor: 'background.default',
            minHeight: 'calc(100vh - 64px)',
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  return (
    <CustomThemeProvider>
      <SidebarContext.Provider value={{ collapsed, toggleCollapsed }}>
        <BrowserRouter>
          <Routes>
            {/* Full-screen exam runner - no sidebar */}
            <Route
              path="/exam/:sessionId"
              element={
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
                  <Navbar />
                  <Box sx={{ p: 2, flexGrow: 1 }}>
                    <ExamRunnerPage />
                  </Box>
                </Box>
              }
            />

            {/* Standard layout with sidebar */}
            <Route path="/" element={<AppLayout><DashboardPage /></AppLayout>} />
            <Route path="/exam-setup" element={<AppLayout><ExamSetupPage /></AppLayout>} />
            <Route path="/exam-review/:sessionId" element={<AppLayout><ExamReviewPage /></AppLayout>} />
            <Route path="/question-bank" element={<AppLayout><QuestionBankPage /></AppLayout>} />
            <Route path="/analytics" element={<AppLayout><AnalyticsPage /></AppLayout>} />
            <Route path="/history" element={<AppLayout><HistoryPage /></AppLayout>} />
            <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          </Routes>
        </BrowserRouter>
      </SidebarContext.Provider>
    </CustomThemeProvider>
  );
};

export default App;
