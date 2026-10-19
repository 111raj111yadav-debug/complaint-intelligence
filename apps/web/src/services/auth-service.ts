import { apiClient } from "../lib/api-client.js";
import { ApiResponse, AuthUser } from "../types/index.js";

export const TOKEN_STORAGE_KEY = "complaint_intel_token";

export interface LoginResponseData {
  token: string;
  user: AuthUser;
}

export const loginUser = async (
  email: string,
  password: string,
): Promise<LoginResponseData> => {
  const res = await apiClient.post<ApiResponse<{ token: string; user: any }>>(
    "/auth/login",
    {
      email,
      password,
    },
  );
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error?.message || "Failed to log in.");
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, res.data.data.token);
  const raw = res.data.data.user;
  const mappedUser: AuthUser = {
    id: raw.userId || raw.id,
    email: raw.email,
    name: raw.fullName || raw.name || raw.email,
    role: raw.role,
    isActive: raw.isActive ?? true,
    departmentId: raw.departmentId,
    department: raw.department,
  };
  return { token: res.data.data.token, user: mappedUser };
};

export const demoLoginUser = async (
  email: string,
): Promise<LoginResponseData> => {
  const res = await apiClient.post<ApiResponse<{ token: string; user: any }>>(
    "/auth/demo-login",
    { email },
  );
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error?.message || "Failed to switch demo account.");
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, res.data.data.token);
  const raw = res.data.data.user;
  const mappedUser: AuthUser = {
    id: raw.userId || raw.id,
    email: raw.email,
    name: raw.fullName || raw.name || raw.email,
    role: raw.role,
    isActive: raw.isActive ?? true,
    departmentId: raw.departmentId,
    department: raw.department,
  };
  return { token: res.data.data.token, user: mappedUser };
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const res = await apiClient.get<ApiResponse<any>>("/auth/me");
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error?.message || "Failed to load user profile.");
  }
  const raw = res.data.data.user || res.data.data;
  return {
    id: raw.id || raw.userId,
    email: raw.email,
    name: raw.fullName || raw.name || raw.email,
    role: raw.role,
    isActive: raw.isActive ?? true,
    departmentId: raw.departmentId,
    department: raw.department,
  };
};

export const fetchStaffUsers = async (): Promise<AuthUser[]> => {
  const res = await apiClient.get<ApiResponse<any>>("/auth/users");
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error?.message || "Failed to load staff list.");
  }
  const rawList = Array.isArray(res.data.data)
    ? res.data.data
    : res.data.data.users || [];
  return rawList.map((raw: any) => ({
    id: raw.id || raw.userId,
    email: raw.email,
    name: raw.fullName || raw.name || raw.email,
    role: raw.role,
    isActive: raw.isActive ?? true,
    departmentId: raw.departmentId,
    department: raw.department,
  }));
};

export const logoutUser = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};
