# LSCSO Changelog

This changelog tracks notable production changes to the Los Santos County Sheriff’s Office public website and Personnel Portal.

## 2026-09-03

### Maintenance mode scope and Executive access

- Fixed maintenance scope behavior so each control now affects the intended part of the LSCSO website.
- **Personnel Portal Only** places only the Personnel Portal into maintenance while keeping the public website online.
- **Public Website Only** places only the public-facing website into maintenance while keeping the Personnel Portal online.
- **Entire Website** now correctly places both the public website and Personnel Portal into maintenance together.
- Executive Command retains access during full-site maintenance through the dedicated maintenance login, allowing authorized Sheriff or Undersheriff accounts to bypass the outage and restore service.
- Single-service maintenance selections now automatically restore the unaffected service if it was previously left in maintenance, preventing stale maintenance states from carrying over between scope changes.
- Updated the maintenance control interface so scope names and descriptions clearly explain exactly what will be taken offline before a change is confirmed.
