export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  authorizedId: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
  remember: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  organization: string;
  role: string;
  authorizedId: string;
}

export interface AuthSession {
  user: AuthUser;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthorizedIdCheck {
  ok: boolean;
  message: string;
}
