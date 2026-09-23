// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { CustomThemeProvider } from './context/ThemeContext';
import { PreparationProvider } from './context/PreparationContext';
import { ImportLauncherProvider } from './context/ImportLauncher';
import { Navbar } from './components/common/Navbar';
import { ConnectionBanner } from './components/common/ConnectionBanner';
import { Sidebar } from './components/common/Sidebar';
import { NARROW_QUERY } from './theme/tokens';
import { ExamSetupPage } from './pages/ExamSetupPage';
import { ExamRunnerPage } from './pages/ExamRunnerPage';
import { ExamReviewPage } from './pages/ExamReviewPage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { InsightsDomainPage } from './pages/InsightsDomainPage';
import { SettingsHome } from './pages/settings/SettingsHome';
import { AISettingsPage } from './pages/settings/AISettingsPage';
import { AppearanceSettingsPage } from './pages/settings/AppearanceSettingsPage';
import { PracticeSettingsPage } from './pages/settings/PracticeSettingsPage';
import { ShortcutsSettingsPage } from './pages/settings/ShortcutsSettingsPage';
import { NotificationSettingsPage } from './pages/settings/NotificationSettingsPage';
import { DataSettingsPage } from './pages/settings/DataSettingsPage';
import { AboutSettingsPage } from './pages/settings/AboutSettingsPage';
import { StatesGalleryPage } from './pages/settings/StatesGalleryPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SystemDesignSetupPage } from './pages/SystemDesignSetupPage';
import { SystemDesignAnswerPage } from './pages/SystemDesignAnswerPage';
import { SystemDesignResultsPage } from './pages/SystemDesignResultsPage';
import { RecordingsPage } from './pages/RecordingsPage';
import { InterviewPracticeSetupPage } from './pages/InterviewPracticeSetupPage';
import { InterviewPracticeRecordPage } from './pages/InterviewPracticeRecordPage';
import { InterviewPracticeResultsPage } from './pages/InterviewPracticeResultsPage';
import { InterviewSessionSetupPage } from './pages/InterviewSessionSetupPage';
import { InterviewSessionPage } from './pages/InterviewSessionPage';
import { InterviewSessionReportPage } from './pages/InterviewSessionReportPage';
import { InterviewLibraryPage } from './pages/InterviewLibraryPage';
import { RoadmapListPage } from './pages/RoadmapListPage';
import { RoadmapDetailPage } from './pages/RoadmapDetailPage';
import { ChartSandboxPage } from './pages/ChartSandboxPage';
import { LearningLabPage } from './pages/LearningLabPage';
import { DesignReviewListPage } from './pages/DesignReviewListPage';
import { DesignReviewPage } from './pages/DesignReviewPage';
import { HomePage } from './pages/HomePage';
import { SubjectPage } from './pages/SubjectPage';
import { PracticeHubPage } from './pages/HubPages';
import { StudyLibraryPage } from './pages/StudyLibraryPage';
import { ReviewPage } from './pages/ReviewPage';
import { SpacedReviewPage } from './pages/SpacedReviewPage';
import { PreparationsPage } from './pages/PreparationsPage';
import { PreparationNewPage } from './pages/PreparationNewPage';
import { PreparationEditPage } from './pages/PreparationEditPage';
import { RoadmapTopicPage } from './pages/RoadmapTopicPage';
import { TopicDemonstratePage } from './pages/TopicDemonstratePage';
import { TopicGuidePage } from './pages/TopicGuidePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SearchPage } from './pages/SearchPage';
import { ProfilePage } from './pages/ProfilePage';
import { RoadmapEditorPage } from './pages/RoadmapEditorPage';

export const SidebarContext = createContext({ collapsed: false, toggleCollapsed: () => {} });
export const useSidebar = () => useContext(SidebarContext);

/**
 * The first thing the keyboard reaches: a way past the header and the fourteen
 * navigation links, straight to the page. Invisible until it has focus.
 */
const SkipToContent: React.FC = () => (
  <Box
    component="a"
    href="#main-content"
    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      document.getElementById('main-content')?.focus();
    }}
    sx={{
      position: 'absolute', left: 8, top: -48, zIndex: 2000, px: 2, py: 1, borderRadius: 2,
      bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600, textDecoration: 'none',
      '&:focus': { top: 8 },
    }}
  >
    Skip to main content
  </Box>
);

/** The prototype's .content: one column, 1250px at most, centred. */
const ContentColumn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      width: '100%',
      maxWidth: 1250,
      boxSizing: 'border-box',
      minWidth: 0,
      overflowX: 'hidden',
      mx: 'auto',
      px: '34px',
      pt: '31px',
      pb: '75px',
      [NARROW_QUERY]: { px: '15px', pt: '23px', pb: '23px' },
    }}
  >
    {children}
  </Box>
);

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    // The prototype's frame: the rail beside the page for its whole height, and
    // the header over the page only -- it names the screen and the preparation,
    // and the rail names the product.
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <SkipToContent />
      <Sidebar />
      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
        <Navbar />
        <ConnectionBanner />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          className="fade-in"
          sx={{
            flexGrow: 1,
            // A flex item is otherwise as wide as its widest content, so one
            // table on a phone pushed the whole page sideways instead of
            // scrolling inside its own container.
            minWidth: 0,
            overflowX: 'hidden',
            outline: 'none',
            bgcolor: 'background.default',
          }}
        >
          <ContentColumn>{children}</ContentColumn>
        </Box>
      </Box>
    </Box>
  );
};

// Full-screen, no-sidebar shell for the "Attempt" stage of every practice
// mode (actively taking an exam, writing a design answer, recording audio) --
// distraction-free, and for Interview Practice specifically avoids a stray
// sidebar click navigating away mid-recording and losing the take.
const FocusLayout: React.FC<{ children: React.ReactNode; bare?: boolean }> = ({ children, bare = false }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
    {/* minimal: no preparation picker. A picker here is a way to navigate away
        mid-recording and lose the take, and while a round is live nothing on
        screen should belong to another part of the product. `bare` drops even
        that header, for a screen that draws its own bar, as the interview
        studio does. */}
    {!bare && <Navbar minimal />}
    <ConnectionBanner />
    <Box component="main" id="main-content" tabIndex={-1} sx={{ flexGrow: 1, minWidth: 0, outline: 'none' }}>
      {bare ? children : <ContentColumn>{children}</ContentColumn>}
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
          <PreparationProvider>
          <ImportLauncherProvider>
          <Routes>
            {/* Full-screen, no-sidebar "Attempt" stage for every practice mode */}
            <Route path="/exam/:sessionId" element={<FocusLayout><ExamRunnerPage /></FocusLayout>} />
            <Route path="/system-design/:promptId/answer" element={<FocusLayout><SystemDesignAnswerPage /></FocusLayout>} />
            <Route path="/interview-practice/:questionId/record" element={<FocusLayout><InterviewPracticeRecordPage /></FocusLayout>} />
            <Route path="/interview-practice/sessions/:sessionId" element={<FocusLayout bare><InterviewSessionPage /></FocusLayout>} />

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
            <Route path="/preparations" element={<AppLayout><PreparationsPage /></AppLayout>} />
            <Route path="/preparations/new" element={<AppLayout><PreparationNewPage /></AppLayout>} />
            <Route path="/preparations/:subjectId/edit" element={<AppLayout><PreparationEditPage /></AppLayout>} />
            <Route path="/practice" element={<AppLayout><PracticeHubPage /></AppLayout>} />
            <Route path="/practice/spaced" element={<AppLayout><SpacedReviewPage /></AppLayout>} />
            <Route path="/learn" element={<AppLayout><StudyLibraryPage /></AppLayout>} />
            <Route path="/review" element={<AppLayout><ReviewPage /></AppLayout>} />
            <Route path="/exam-setup" element={<AppLayout><ExamSetupPage /></AppLayout>} />
            <Route path="/exam-review/:sessionId" element={<AppLayout><ExamReviewPage /></AppLayout>} />
            <Route path="/question-bank" element={<AppLayout><QuestionBankPage /></AppLayout>} />
            <Route path="/analytics" element={<AppLayout><AnalyticsPage /></AppLayout>} />
            <Route path="/analytics/area" element={<AppLayout><InsightsDomainPage /></AppLayout>} />
            {/* /history and /system-design/history are both folded into
                Review, which is the only page that answers "what have I been
                doing" across every format rather than one. */}
            <Route path="/history" element={<Navigate to="/review" replace />} />
            <Route path="/system-design/history" element={<Navigate to="/review" replace />} />
            <Route path="/settings" element={<AppLayout><SettingsHome /></AppLayout>} />
            <Route path="/settings/ai" element={<AppLayout><AISettingsPage /></AppLayout>} />
            <Route path="/settings/appearance" element={<AppLayout><AppearanceSettingsPage /></AppLayout>} />
            <Route path="/settings/practice" element={<AppLayout><PracticeSettingsPage /></AppLayout>} />
            <Route path="/settings/shortcuts" element={<AppLayout><ShortcutsSettingsPage /></AppLayout>} />
            <Route path="/settings/notifications" element={<AppLayout><NotificationSettingsPage /></AppLayout>} />
            <Route path="/settings/data" element={<AppLayout><DataSettingsPage /></AppLayout>} />
            <Route path="/settings/about" element={<AppLayout><AboutSettingsPage /></AppLayout>} />
            <Route path="/settings/states" element={<AppLayout><StatesGalleryPage /></AppLayout>} />
            <Route path="/notifications" element={<AppLayout><NotificationsPage /></AppLayout>} />
            <Route path="/onboarding" element={<AppLayout><OnboardingPage /></AppLayout>} />
            <Route path="/system-design" element={<AppLayout><SystemDesignSetupPage /></AppLayout>} />
            <Route path="/system-design/attempts/:attemptId" element={<AppLayout><SystemDesignResultsPage /></AppLayout>} />
            <Route path="/roadmaps" element={<AppLayout><RoadmapListPage /></AppLayout>} />
            <Route path="/lab" element={<AppLayout><LearningLabPage /></AppLayout>} />
            <Route path="/chart-sandbox" element={<AppLayout><ChartSandboxPage /></AppLayout>} />
            <Route path="/design-reviews" element={<AppLayout><DesignReviewListPage /></AppLayout>} />
            <Route path="/design-reviews/:reviewId" element={<AppLayout><DesignReviewPage /></AppLayout>} />
            <Route path="/roadmaps/:roadmapId" element={<AppLayout><RoadmapDetailPage /></AppLayout>} />
            <Route path="/roadmaps/:roadmapId/edit" element={<AppLayout><RoadmapEditorPage /></AppLayout>} />
            <Route path="/roadmaps/:roadmapId/topics/:topicId" element={<AppLayout><RoadmapTopicPage /></AppLayout>} />
            <Route path="/roadmaps/:roadmapId/topics/:topicId/demonstrate" element={<AppLayout><TopicDemonstratePage /></AppLayout>} />
            <Route path="/roadmaps/:roadmapId/topics/:topicId/guide" element={<AppLayout><TopicGuidePage /></AppLayout>} />
            <Route path="/recordings" element={<AppLayout><RecordingsPage /></AppLayout>} />
            <Route path="/interview-practice" element={<AppLayout><InterviewPracticeSetupPage /></AppLayout>} />
            <Route path="/interview-practice/setup" element={<AppLayout><InterviewSessionSetupPage /></AppLayout>} />
            <Route path="/interview-practice/library" element={<AppLayout><InterviewLibraryPage /></AppLayout>} />
            <Route path="/interview-practice/sessions/:sessionId/report" element={<AppLayout><InterviewSessionReportPage /></AppLayout>} />
            <Route path="/interview-practice/recordings/:recordingId/results" element={<AppLayout><InterviewPracticeResultsPage /></AppLayout>} />
            {/* The recording detail the prototype reaches from Recordings: the same page. */}
            <Route path="/recordings/:recordingId" element={<AppLayout><InterviewPracticeResultsPage /></AppLayout>} />
            <Route path="/search" element={<AppLayout><SearchPage /></AppLayout>} />
            <Route path="/profile" element={<AppLayout><ProfilePage /></AppLayout>} />
            <Route path="*" element={<AppLayout><NotFoundPage /></AppLayout>} />
          </Routes>
          </ImportLauncherProvider>
          </PreparationProvider>
        </BrowserRouter>
      </SidebarContext.Provider>
    </CustomThemeProvider>
  );
};

export default App;
