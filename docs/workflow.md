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
3. Driver selects rule area, race phase, and impact/severity.
4. Driver uses the intake buttons to add their gamertag, video link, incident time, and description. Other involved drivers/gamertags can be added if known.
6. Bot replies privately with the incident ID, status button, and follow-up button.
7. Driver can use `/incident status` to reopen their newest private incident card, then use the `Incident List` dropdown on that card to switch incidents.
8. If admins need more information or a file upload, driver uses the follow-up button from the status screen.

## Admin Flow

1. Bot posts one review card in `#incident-review` with the incident details and video link.
2. Bot creates a thread on that card for private admin discussion and seeds it with a compact decision control message.
3. Admins discuss freely in the thread.
4. When admins are ready, they use the thread `Make Decision` button.
5. Bot asks for the outcome, then opens a structured modal for the driver-facing decision wording.
6. Bot posts the proposed decision in the thread with `Publish Decision` and `Edit` buttons.
7. `Publish Decision` updates the incident, DMs participants, updates the review card, and optionally posts to the private `#incident-log`.

## Notification Policy

The bot should directly message only:

- The submitter.
- Drivers named as involved.

The MVP should not post public outcomes. If the organization later wants public transparency, add a separate optional public decisions channel with short summaries only.
