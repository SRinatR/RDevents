# Event Platform MVP - Implementation Todos

## ✅ Completed

### Backend
- [x] Prisma schema with all required models (User, Event, EventMember, EventTeam, EventTeamMember, AnalyticsEvent)
- [x] Auth module (register/login/logout/me/profile)
- [x] Events module with full CRUD and team mechanics
- [x] Admin module with event management, volunteer approval, event admins assignment
- [x] Analytics module with tracking and aggregates
- [x] Password hashing with argon2
- [x] JWT authentication with access/refresh tokens
- [x] Docker Compose setup
- [x] Seed data (prisma/seed.ts - 426 lines)

### Frontend
- [x] Home page with hero, features, popular events
- [x] Next.js 16 + React 19 setup
- [x] next-intl for i18n (ru/en)
- [x] Layout with Navbar
- [x] Basic UI components (Button, Card, Badge, Input, Modal, StatCard)

## 🔨 In Progress / Needs Completion

### Recently Completed ✅
- [x] Added team management endpoints (update, leave, approve, reject, remove)
- [x] Implemented team management service functions
- [x] Structured logging with requestId
- [x] Error handler with safe error codes and no stack trace leaks
- [x] /ready endpoint for database health checks
- [x] Startup logging with environment info
- [x] Request ID middleware for tracing
- [x] Request logger middleware
- [x] Comprehensive README.md with setup instructions
- [x] Documented all API endpoints
- [x] Seed data documentation with test accounts

### Frontend Pages & Features
- [ ] Complete all admin pages implementation
  - [ ] /admin/admins - manage platform admins
  - [ ] /admin/analytics - platform-wide analytics dashboard
  - [ ] /admin/events/[id]/edit - event editing form
  - [ ] /admin/events/new - event creation form
  - [ ] /admin/users - user management
  - [ ] /admin/volunteers - volunteer management
- [ ] Complete cabinet pages
  - [ ] /cabinet/events - browse events
  - [ ] /cabinet/my-events - user's registered events
  - [ ] /cabinet/my-events/[slug] - event detail with team management
  - [ ] /cabinet/profile - edit profile
- [ ] Events pages
  - [ ] /events - catalog with filters and search
  - [ ] /events/[slug] - event detail with registration/team actions
- [ ] Auth pages
  - [ ] /login - login form with provider buttons
  - [ ] /register - registration form

### API Endpoints (verify and test)
- [x] Team management endpoints
  - [x] POST /api/events/:id/teams - create team
  - [x] GET /api/events/:id/teams - list teams
  - [x] POST /api/events/:id/teams/:teamId/join - join team
  - [x] PATCH /api/events/:id/teams/:teamId - update team
  - [x] POST /api/events/:id/teams/:teamId/leave - leave team
  - [x] POST /api/events/:id/teams/:teamId/members/:userId/approve - approve member
  - [x] POST /api/events/:id/teams/:teamId/members/:userId/reject - reject member
  - [x] DELETE /api/events/:id/teams/:teamId/members/:userId - remove member
- [x] Volunteer endpoints
  - [x] POST /api/events/:id/volunteer/apply
  - [x] PATCH /api/admin/events/:id/volunteers/:memberId (approve/reject in admin)

### Auth & Security
- [x] Email/password auth fully implemented
- [ ] Implement Google OAuth (or dev mock clearly marked) - Foundation ready
- [ ] Implement Yandex OAuth (or dev mock clearly marked) - Foundation ready
- [ ] Implement Telegram auth (or dev mock clearly marked) - Foundation ready
- [x] All middleware verified (requireAuth, requireSuperAdmin, requireEventAdmin, canManageEvent)
- [x] RequestId/correlationId added to all requests
- [x] Centralized error handler with safe error codes

### Analytics
- [x] POST /api/analytics/track endpoint implemented
- [x] GET /api/analytics/summary endpoint
- [x] GET /api/admin/analytics with full stats
- [x] All analytics event types supported:
  - [x] HOME_VIEW
  - [x] EVENTS_LIST_VIEW
  - [x] EVENT_DETAIL_VIEW
  - [x] REGISTER_CLICK
  - [x] EVENT_REGISTRATION
  - [x] USER_REGISTER
  - [x] USER_LOGIN
  - [x] PROVIDER_USED
- [x] Top events by views and registrations
- [ ] Frontend tracking integration (needs testing)

### Database & Migrations
- [ ] Run `pnpm db:generate`
- [ ] Run `pnpm db:push` or `pnpm db:migrate`
- [ ] Run `pnpm db:seed`
- [ ] Verify seed creates:
  - [ ] Super admin user
  - [ ] 6-10 events (various categories, solo & team-based)
  - [ ] 6+ test users with different roles
  - [ ] Teams and team memberships
  - [ ] Volunteer applications
  - [ ] Event admin assignments
  - [ ] Analytics events

### Testing & Quality
- [ ] Test local development with `pnpm dev`
- [ ] Test Docker Compose deployment
- [ ] Verify all pages load without errors
- [ ] Test user registration flow
- [ ] Test event registration flow
- [ ] Test team creation and joining
- [ ] Test volunteer application flow
- [ ] Test event admin assignment
- [ ] Verify no raw Prisma errors exposed to users
- [ ] Check loading/empty/error states on all pages
- [ ] Mobile responsiveness
- [ ] Accessibility (focus states, form labels)

### Documentation
- [ ] Update README.md with:
  - [ ] Project overview
  - [ ] Local setup instructions
  - [ ] Docker setup instructions
  - [ ] Environment variables
  - [ ] Database commands
  - [ ] Demo credentials
- [ ] API documentation (optional but nice)
- [ ] Architecture overview (optional)

### Health & Observability
- [ ] /health endpoint (✅ exists)
- [ ] /ready or /api/ready endpoint
- [ ] Structured logging with fields:
  - [ ] timestamp
  - [ ] level
  - [ ] service/module
  - [ ] action
  - [ ] requestId
  - [ ] userId
  - [ ] eventId
  - [ ] error code
- [ ] Log events:
  - [ ] startup
  - [ ] env loaded
  - [ ] database connected/failed
  - [ ] request started/finished
  - [ ] login attempt/success/failure
  - [ ] register attempt/success/failure
  - [ ] permission denied
  - [ ] validation failed
  - [ ] database error
  - [ ] unexpected error

### UI/UX Polish
- [ ] Modern, premium-feel design
- [ ] Consistent color scheme (indigo/violet accents per spec)
- [ ] Loading states on all async operations
- [ ] Empty states with friendly messages
- [ ] Error states with actionable messages
- [ ] Toast notifications for success/error
- [ ] Form validation with clear error messages
- [ ] Hover/focus states on interactive elements
- [ ] Smooth transitions and animations

## 🎯 Acceptance Criteria (from spec)
- [ ] User can register, login, and see cabinet
- [ ] User can register for event as participant
- [ ] User can create team or join existing team (team-based events)
- [ ] User can apply as volunteer
- [ ] Super admin can create event and assign event admin
- [ ] Event admin sees only their event, can manage participants, teams, volunteers
- [ ] Analytics and counters update on key actions
- [ ] UI shows no raw Prisma/stack trace errors
- [ ] Logs contain requestId and sufficient diagnostics
- [ ] System starts via `pnpm dev` and `docker compose up`
- [ ] Locale switching works (ru/en)
- [ ] Demo data populated via seed

## 📝 Notes
- Priority: Get backend fully tested → Complete frontend pages → Polish UI/UX → Final testing
- Focus on making it work correctly first, then polish
- Don't overengineer, but keep code clean and maintainable
- Event-scoped roles (EventMember) are correctly separated from platform roles (User.role)
