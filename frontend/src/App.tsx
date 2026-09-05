// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { CustomThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { ExamSetupPage } from './pages/ExamSetupPage';
import { ExamRunnerPage } from './pages/ExamRunnerPage';
import { ExamReviewPage } from './pages/ExamReviewPage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SystemDesignSetupPage } from './pages/SystemDesignSetupPage';
import { SystemDesignAnswerPage } from './pages/SystemDesignAnswerPage';
import { SystemDesignResultsPage } from './pages/SystemDesignResultsPage';
import { RecordingsPage } from './pages/RecordingsPage';
import { InterviewPracticeSetupPage } from './pages/InterviewPracticeSetupPage';
import { InterviewPracticeRecordPage } from './pages/InterviewPracticeRecordPage';
import { InterviewPracticeResultsPage } from './pages/InterviewPracticeResultsPage';
import { RoadmapListPage } from './pages/RoadmapListPage';
import { RoadmapDetailPage } from './pages/RoadmapDetailPage';
import { ChartSandboxPage } from './pages/ChartSandboxPage';
import { DesignReviewListPage } from './pages/DesignReviewListPage';
import { DesignReviewPage } from './pages/DesignReviewPage';
import { HomePage } from './pages/HomePage';
import { SubjectPage } from './pages/SubjectPage';
import { PracticeHubPage, LearnHubPage } from './pages/HubPages';
import { ReviewPage } from './pages/ReviewPage';

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
            // Tighter gutters on a phone: 24px each side of a 300px column
            // is a sixth of the screen spent on margin.
            p: { xs: 2, sm: 3 },
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
            {/* There is one Home, and this is it. /dashboard used to serve a
                near-identical second page -- same hero, same metric cards,
                same weak-topic widget, same activity table -- so whichever
                one a person landed on, the other was quietly disagreeing with
                it. It redirects rather than 404s, because the path is in
                people's history and bookmarks. */}
            <Route path="/" element={<AppLayout><HomePage /></AppLayout>} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/subjects/:subjectId" element={<AppLayout><SubjectPage /></AppLayout>} />
            <Route path="/practice" element={<AppLayout><PracticeHubPage /></AppLayout>} />
            <Route path="/learn" element={<AppLayout><LearnHubPage /></AppLayout>} />
            <Route path="/review" element={<AppLayout><ReviewPage /></AppLayout>} />
            <Route path="/exam-setup" element={<AppLayout><ExamSetupPage /></AppLayout>} />
            <Route path="/exam-review/:sessionId" element={<AppLayout><ExamReviewPage /></AppLayout>} />
            <Route path="/question-bank" element={<AppLayout><QuestionBankPage /></AppLayout>} />
            <Route path="/analytics" element={<AppLayout><AnalyticsPage /></AppLayout>} />
            {/* /history and /system-design/history are both folded into
                Review, which is the only page that answers "what have I been
                doing" across every format rather than one. */}
            <Route path="/history" element={<Navigate to="/review" replace />} />
            <Route path="/system-design/history" element={<Navigate to="/review" replace />} />
            <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
            <Route path="/system-design" element={<AppLayout><SystemDesignSetupPage /></AppLayout>} />
            <Route path="/system-design/attempts/:attemptId" element={<AppLayout><SystemDesignResultsPage /></AppLayout>} />
            <Route path="/roadmaps" element={<AppLayout><RoadmapListPage /></AppLayout>} />
            <Route path="/chart-sandbox" element={<AppLayout><ChartSandboxPage /></AppLayout>} />
            <Route path="/design-reviews" element={<AppLayout><DesignReviewListPage /></AppLayout>} />
            <Route path="/design-reviews/:reviewId" element={<AppLayout><DesignReviewPage /></AppLayout>} />
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
