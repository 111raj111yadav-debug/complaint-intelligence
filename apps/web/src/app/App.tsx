import React from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes.js";
import { AuthProvider } from "../lib/auth-context.js";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
};
