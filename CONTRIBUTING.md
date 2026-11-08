# Contributing

- `npm test` builds and runs every test (Node's built-in runner, no other tooling).
- Keep the core free of I/O: anything that touches the file system, a clock, the network or the
  console is a port in `src/ports.ts` with an adapter in `src/adapters`, wired in
  `src/app/container.ts`.
- New behaviour after a change (a recorded experiment, a merge) is announced as an event in
  `src/events.ts`; side effects subscribe to it rather than being called by the use case.
- A change to the rendered Markdown must keep `test/integration.test.ts`'s compatibility check
  green, or explain in the pull request why existing ledgers will render differently.
- Record performance claims about this tool in its own ledger. Yes, really.
