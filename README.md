# Incident Automation Platform

An enterprise-style incident reporting and resolution platform with automated
document intake, AI-assisted triage, and a role-aware operations dashboard.

## Repository Purpose

This repository contains:

- backend REST API
- frontend operations dashboard
- PostgreSQL/Prisma persistence layer
- RPA automation project (UiPath Studio)
- planning, architecture, demo, and integration docs

## Workspace Structure

```text
.
|-- backend/   Express API, workflow domain logic, uploads, AI, automation logs
|-- frontend/  Vue 3 operations dashboard and incident workspace
|-- rpa/       UiPath Studio automation project
`-- docs/      Product scope, architecture, roadmap, demo, and integration notes
```

## Documentation Map

Start here:

- [docs/README.md](docs/README.md): documentation navigation and rules
- [docs/product-scope.md](docs/product-scope.md): product scope and feature status
- [docs/development-roadmap.md](docs/development-roadmap.md): remaining planned work
- [docs/technical-architecture.md](docs/technical-architecture.md): current and target architecture
- [docs/demo-flow.md](docs/demo-flow.md): demo script and screenshot checklist
- [docs/uipath-integration.md](docs/uipath-integration.md): UiPath bridge contract

## Current Build Status

Currently implemented:

- Vue 3 frontend and Express backend
- PostgreSQL persistence through Prisma
- JWT login/session restore and role-aware access
- incident create/list/detail/update/status workflow
- assignment, comments, duplicate marking, and timeline/history
- private evidence upload validation for PDF, DOCX, PNG, JPG, JPEG, and TXT
- dashboard and automation visibility pages
- AI triage suggestions through an OpenAI-compatible service
- UiPath bridge endpoints with shared-secret authentication
- UiPath Studio baseline bot that processes files from a watched folder and calls the backend
- backend/frontend test harnesses

Planned work is tracked in the development roadmap.

## Running The Test Suites

```bash
# backend
cd backend && npm test

# frontend
cd frontend && npm test
```

## Development Principle

This project is built to feel like an internal enterprise operations platform,
not a student CRUD demo. A capability is only considered complete when it can be
shown through the UI, API, database state, UiPath Studio, logs, or screenshots.
