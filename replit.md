# Office Layout Manager

## Overview

An interactive office layout management system built with React, Express, and PostgreSQL. The application allows administrators to create, manage, and visualize office locations on an interactive map with real-time updates via WebSocket connections. Users can view the office layout and status of various locations (meeting rooms, workstations, equipment, etc.) while administrators have full CRUD capabilities through a protected admin panel.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Single-page application using Wouter for client-side routing
- **Component Library**: Shadcn/ui components with Radix UI primitives for consistent, accessible UI
- **Styling**: Tailwind CSS with CSS variables for theming and design system
- **State Management**: TanStack Query for server state management with optimistic updates
- **Real-time Updates**: WebSocket client for live location updates and notifications

### Backend Architecture
- **Express.js Server**: RESTful API with TypeScript for type safety
- **Session-based Authentication**: Express sessions with PostgreSQL store for admin authentication
- **Password Security**: Bcrypt hashing for secure password storage
- **WebSocket Server**: Real-time communication for location updates across connected clients
- **Middleware**: Custom logging, error handling, and authentication middleware

### Database Design
- **PostgreSQL with Drizzle ORM**: Type-safe database operations with schema validation
- **Core Tables**:
  - `admins`: User authentication and management
  - `locations`: Office locations with position, status, and metadata
  - `sessions`: Session storage for authentication persistence
- **Schema Validation**: Zod schemas for runtime type checking and API validation

### API Structure
- **Public Routes**: 
  - `GET /api/locations` - Retrieve all locations for public viewing
- **Protected Admin Routes**:
  - `POST /api/admin/login` - Admin authentication
  - `GET /api/admin/me` - Current admin session info
  - `POST /api/admin/logout` - Session termination
  - Full CRUD operations for locations (`GET`, `POST`, `PUT`, `DELETE`)
- **WebSocket Endpoint**: `/ws` for real-time updates

### Authentication & Security
- **Session-based Auth**: Secure session cookies with PostgreSQL session store
- **Route Protection**: Middleware-based authentication for admin routes
- **Password Hashing**: Bcrypt with salt rounds for secure password storage
- **CORS Configuration**: Proper credential handling for cross-origin requests

### Real-time Features
- **WebSocket Integration**: Live updates when locations are created, updated, or deleted
- **Event Broadcasting**: Server broadcasts changes to all connected clients
- **Optimistic Updates**: Client-side updates before server confirmation
- **Connection Status**: Visual indicators for WebSocket connection state

### Development Tools
- **Vite**: Fast development server with HMR and React plugin
- **ESBuild**: Production bundling for server-side code
- **Drizzle Kit**: Database migrations and schema management
- **TypeScript**: Full-stack type safety with shared schemas

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **@neondatabase/serverless**: WebSocket-compatible PostgreSQL client

### UI Framework
- **Radix UI**: Comprehensive component primitives for accessible UI
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Lucide React**: Modern icon library for consistent iconography

### Backend Services
- **Express.js**: Web application framework with middleware ecosystem
- **WebSocket (ws)**: Real-time bidirectional communication
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Development Dependencies
- **Vite**: Build tool with development server and React support
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL dialect
- **TanStack Query**: Data synchronization and caching for React
- **Zod**: Runtime type validation and schema parsing

### Authentication & Security
- **bcrypt**: Password hashing library with salt generation
- **express-session**: Session middleware for user authentication
- **nanoid**: Secure URL-friendly unique ID generator