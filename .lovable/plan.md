

## Role-Based Access Control: Admin + User

### Roles
- **Admin**: Full access to all pages, including Upload Data, plus ability to manage user roles
- **User**: Access to all pages except Upload Data

### Database Changes (Migration)

1. Create `app_role` enum: `('admin', 'user')`
2. Create `user_roles` table with `user_id` (references `auth.users`) and `role` columns, with RLS enabled
3. Create `has_role` security-definer function to safely check roles without recursive RLS
4. Add RLS policies on `user_roles`: authenticated users can read their own role; admins can read/manage all roles
5. Create an admin management view so admins can assign roles

### Frontend Changes

1. **`src/hooks/use-user-role.ts`** — New hook that queries `user_roles` for the current user's role, returns `{ role, isAdmin, loading }`
2. **`src/components/ProtectedRoute.tsx`** — Wrapper component that checks if the user's role has access to the current route; redirects unauthorized users to Dashboard with a toast
3. **`src/App.tsx`** — Wrap the `/upload` route with the `ProtectedRoute` requiring `admin` role
4. **`src/components/AppSidebar.tsx`** — Conditionally hide the "Upload Data" nav item for non-admin users
5. **`src/pages/UserManagement.tsx`** — New admin-only page listing all users with ability to assign/change roles (admin sidebar link, protected route)

### Default Role Assignment
- New users who sign up get no row in `user_roles` initially — treated as `user` role by default in the frontend hook
- Admins manually promote users via the User Management page

### Security
- All role checks enforced server-side via RLS + `has_role()` function
- Upload-related INSERT policies on `projects`, `time_entries`, `upload_history` will additionally require admin role
- The `user_roles` table write access restricted to admins only

