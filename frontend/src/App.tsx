// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

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
import { SystemDesignSetupPage } from './pages/SystemDesignSetupPage';
import { SystemDesignAnswerPage } from './pages/SystemDesignAnswerPage';
import { SystemDesignResultsPage } from './pages/SystemDesignResultsPage';
import { SystemDesignHistoryPage } from './pages/SystemDesignHistoryPage';
import { RecordingsPage } from './pages/RecordingsPage';
import { InterviewPracticeSetupPage } from './pages/InterviewPracticeSetupPage';
import { InterviewPracticeRecordPage } from './pages/InterviewPracticeRecordPage';
import { InterviewPracticeResultsPage } from './pages/InterviewPracticeResultsPage';
import { RoadmapListPage } from './pages/RoadmapListPage';
import { RoadmapDetailPage } from './pages/RoadmapDetailPage';
import { ChartSandboxPage } from './pages/ChartSandboxPage';

export const SidebarContext = createContext({ collapsed: false, toggleCollapsed: () => {} });
export const useSidebar = () => useContext(SidebarContext);

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

// Full-screen, no-sidebar shell for the "Attempt" stage of every practice
// mode (actively taking an exam, writing a design answer, recording audio) --
// distraction-free, and for Interview Practice specifically avoids a stray
// sidebar click navigating away mid-recording and losing the take.
const FocusLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
    <Navbar />
    <Box sx={{ p: 2, flexGrow: 1 }}>
      {children}
    </Box>
  </Box>
);

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  return (
    <CustomThemeProvider>
      <SidebarContext.Provider value={{ collapsed, toggleCollapsed }}>
        <BrowserRouter>
          <Routes>
            {/* Full-screen, no-sidebar "Attempt" stage for every practice mode */}
            <Route path="/exam/:sessionId" element={<FocusLayout><ExamRunnerPage /></FocusLayout>} />
            <Route path="/system-design/:promptId/answer" element={<FocusLayout><SystemDesignAnswerPage /></FocusLayout>} />
            <Route path="/interview-practice/:questionId/record" element={<FocusLayout><InterviewPracticeRecordPage /></FocusLayout>} />

            {/* Standard layout with sidebar */}
            <Route path="/" element={<AppLayout><DashboardPage /></AppLayout>} />
            <Route path="/exam-setup" element={<AppLayout><ExamSetupPage /></AppLayout>} />
            <Route path="/exam-review/:sessionId" element={<AppLayout><ExamReviewPage /></AppLayout>} />
            <Route path="/question-bank" element={<AppLayout><QuestionBankPage /></AppLayout>} />
            <Route path="/analytics" element={<AppLayout><AnalyticsPage /></AppLayout>} />
            <Route path="/history" element={<AppLayout><HistoryPage /></AppLayout>} />
            <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
            <Route path="/system-design" element={<AppLayout><SystemDesignSetupPage /></AppLayout>} />
            <Route path="/system-design/attempts/:attemptId" element={<AppLayout><SystemDesignResultsPage /></AppLayout>} />
            <Route path="/system-design/history" element={<AppLayout><SystemDesignHistoryPage /></AppLayout>} />
            <Route path="/roadmaps" element={<AppLayout><RoadmapListPage /></AppLayout>} />
            <Route path="/chart-sandbox" element={<AppLayout><ChartSandboxPage /></AppLayout>} />
            <Route path="/roadmaps/:roadmapId" element={<AppLayout><RoadmapDetailPage /></AppLayout>} />
            <Route path="/recordings" element={<AppLayout><RecordingsPage /></AppLayout>} />
            <Route path="/interview-practice" element={<AppLayout><InterviewPracticeSetupPage /></AppLayout>} />
            <Route path="/interview-practice/recordings/:recordingId/results" element={<AppLayout><InterviewPracticeResultsPage /></AppLayout>} />
          </Routes>
        </BrowserRouter>
      </SidebarContext.Provider>
    </CustomThemeProvider>
  );
};

export default App;
