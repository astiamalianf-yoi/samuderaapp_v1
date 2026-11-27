# Authentication Integration with Backend API

## Overview
This document outlines the authentication system integrated with the backend API at `https://backend.fruz.cloud`.

## Files Created

### Types
- **`src/types/auth.ts`**: TypeScript interfaces for auth-related data
  - `RegisterInput`: Registration form data
  - `LoginInput`: Login credentials
  - `PublicUser`: User profile information
  - `AuthState`: Authentication state tracking
  - `AuthContextType`: Auth context API

### Services
- **`src/services/authService.ts`**: API communication layer
  - `authService.register()`: Create new user account 
  - `authService.login()`: Authenticate user
  - `authService.logout()`: Clear authentication
  - `authService.getCurrentUser()`: Fetch current user profile
  - `AuthError`: Custom error class for auth failures

### Context & Hooks
- **`src/contexts/AuthContext.tsx`**: React context for global auth state
- **`src/hooks/useAuth.ts`**: Custom hook to access auth context

### Components
- **`src/components/ProtectedRoute.tsx`**: Wrapper component for protected routes
- **`src/pages/LoginPage.tsx`**: Full login UI with form validation
- **`src/pages/RegisterPage.tsx`**: Full registration UI with form validation
- **`src/pages/ProfilePage.tsx`**: User profile display with logout functionality

## API Endpoints Used

### Register
- **POST** `/api/auth/register`
- Body: `{ nama, noIdentitasNelayan, email, password }`
- Returns: 201 Created

### Login  
- **POST** `/api/auth/login`
- Body: `{ email, password }`
- Returns: 200 OK (sets HTTP-only cookie with JWT)

### Logout
- **POST** `/api/auth/logout`
- Requires: Authentication cookie
- Returns: 200 OK (clears cookie)

### Get Current User
- **GET** `/api/auth/me`
- Requires: Authentication cookie
- Returns: User profile data

## Routes

| Path | Component | Protected | Description |
|------|-----------|-----------|-------------|
| `/login` | LoginPage | No | User login |
| `/register` | RegisterPage | No | New user registration |
| `/profile` | ProfilePage | Yes | User profile & logout |

## Usage

### Accessing Auth State in Components

```typescript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in</div>;
  
  return <div>Welcome, {user.nama}!</div>;
}
```

### Protecting Routes

```typescript
import { ProtectedRoute } from './components/ProtectedRoute';

<Route 
  path="/protected" 
  element={
    <ProtectedRoute>
      <ProtectedPage />
    </ProtectedRoute>
  } 
/>
```

### Login Flow

1. User submits login form
2. `authService.login()` calls API with credentials
3. Backend sets HTTP-only cookie with JWT
4. On success, `checkAuth()` fetches user profile
5. User state updated, UI re-renders with auth state

### Registration Flow

1. User submits registration form
2. Form validates password (min 8 chars, confirmation match)
3. `authService.register()` creates account
4. Auto-login after successful registration
5. Redirect to home page

## Features

- ✅ JWT authentication with HTTP-only cookies
- ✅ Protected routes with automatic redirect
- ✅ Form validation (email format, password length)
- ✅ Error handling with user-friendly messages
- ✅ Loading states during async operations
- ✅ Automatic auth check on app load
- ✅ Profile page with user info and logout
- ✅ Responsive UI with Tailwind CSS

## Error Handling

The system provides localized error messages:
- Invalid credentials → "Email atau password salah"
- Duplicate registration → "Email atau nomor identitas nelayan sudah terdaftar"
- Network errors → "Terjadi kesalahan jaringan. Silakan coba lagi."

## Security

- JWTs stored in HTTP-only cookies (not accessible via JavaScript)
- All auth requests use `credentials: 'include'` for cookie handling
- Protected routes check auth state before rendering
- Automatic token refresh handled by browser cookie mechanism
