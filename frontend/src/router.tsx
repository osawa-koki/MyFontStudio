import { createBrowserRouter, createHashRouter, type RouteObject } from "react-router";
import { Layout } from "./components/Layout";
import { EditorPage } from "./pages/EditorPage";
import { GuidePage } from "./pages/GuidePage";
import { PreviewPage } from "./pages/PreviewPage";

const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: "/", element: <GuidePage /> },
      { path: "/editor", element: <EditorPage /> },
      { path: "/preview", element: <PreviewPage /> },
      { path: "*", element: <GuidePage /> },
    ],
  },
];

// GitHub Pages はサーバーで index.html にフォールバックできないので HashRouter（VITE_ROUTER=hash）を使う
export const router =
  import.meta.env.VITE_ROUTER === "hash"
    ? createHashRouter(routes)
    : createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });
