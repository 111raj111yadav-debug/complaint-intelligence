import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout.js";
import { DashboardPage } from "../features/dashboard/DashboardPage.js";
import { ComplaintsPage } from "../features/complaints/ComplaintsPage.js";
import { AnalysisPage } from "../features/analysis/AnalysisPage.js";
import { ResolutionsPage } from "../features/resolutions/ResolutionsPage.js";
import { KnowledgeBasePage } from "../features/knowledge-base/KnowledgeBasePage.js";
import { AnalyticsPage } from "../features/analytics/AnalyticsPage.js";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "complaints",
        element: <ComplaintsPage />,
      },
      {
        path: "analysis",
        element: <AnalysisPage />,
      },
      {
        path: "resolutions",
        element: <ResolutionsPage />,
      },
      {
        path: "knowledge-base",
        element: <KnowledgeBasePage />,
      },
      {
        path: "analytics",
        element: <AnalyticsPage />,
      },
    ],
  },
]);
