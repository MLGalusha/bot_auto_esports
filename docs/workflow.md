# Incident Review Workflow

## Channels

Recommended development server channels:

- `#incident-bot-dev`: normal testing and bot command chatter.
- `#incident-review`: private admin-only channel. Bot posts new incidents here.
- `#incident-log`: private admin-only archive. Bot posts final incident records here when configured.

No public incident or penalty log is part of the MVP.

## Driver Flow

1. Driver runs `/incident submit`.
2. Bot opens a private intake board based on AERO rules.
3. Driver selects rule area, race phase, impact/severity, and video status.
4. Driver uses the intake buttons to add their gamertag, video link, incident time, and description. Other involved drivers/gamertags can be added if known.
6. Bot replies privately with the incident ID, status button, and follow-up button.
7. Driver can use `/incident status` to reopen their private incident list later.
8. If admins need more information or a file upload, driver uses the follow-up button from the status screen.

## Admin Flow

1. Bot posts a review message in `#incident-review`.
2. Bot creates a thread on that message for private discussion.
3. Admins discuss in the thread.
4. Admins use review-message buttons to update status:

- `Under Review`
- `Need Info`
- `No Action`
- `Penalty`
- `Close`

5. For `Need Info`, `No Action`, and `Penalty`, the bot opens a modal so admins can record the note or decision.
6. Final statuses are optionally posted to the private `#incident-log`.

## Notification Policy

The bot should directly message only:

- The submitter.
- Drivers named as involved.

The MVP should not post public outcomes. If the organization later wants public transparency, add a separate optional public decisions channel with short summaries only.
