# Painted Cosmos: start here

This game is worked on by Claude sessions from two accounts, one at a time. Nothing from an
earlier chat carries over; the state of the work is in this repository.

At the start of every session, before anything else:

1. `git fetch origin && git checkout r2` (the working branch; `main` is the live game and only
   changes through pull requests the owner asks to merge).
2. Read `docs/HANDOVER.md` in full, then the last three sections of `docs/COORDINATOR.md`.
3. Act as the project's coordinator as the handover describes. If the owner just says
   "continue", do what section 3 of the handover says is next.

Always:

- Only one session works at a time. Before you stop, or when usage runs low, commit and push
  everything and update section 3 ("State right now") of `docs/HANDOVER.md`.
- Log every new instruction from the owner in `docs/COORDINATOR.md` and in section 2 of
  `docs/HANDOVER.md`, so the next session (on either account) knows it.
- Merge into `main` only when the owner asks in that session.
- Never use or look for the owner's other projects, past chats or memories.
