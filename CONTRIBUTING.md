# Contributing

## The licence, and what it means for you

forge-ops is under the **GNU Affero General Public License v3.0** ([LICENSE](LICENSE)). Two consequences worth knowing before you open a pull request:

- your contribution is licensed under the AGPL too - you keep your copyright, you grant everyone the same rights the licence grants;
- anyone who runs a modified copy **as a service** has to publish their modifications. That is the difference between the AGPL and the GPL, and it is the reason this project chose it.

Running a hosted forge-ops is allowed, by us and by anyone else - publishing the modifications that go with it is the price.

## Sign your commits off

Every commit carries a `Signed-off-by` line, which is the [Developer Certificate of Origin](https://developercertificate.org/): you state that you wrote the change, or that you have the right to submit it under the AGPL.

```bash
git commit -s -m "your message"
```

A pull request whose commits are not signed off cannot be merged. It is not paperwork for its own sake: it is what lets the project stay reusable by people who were not in the room.

## How work lands here

The project builds itself with the sequence it ships - `/SPEC`, `/PLAN`, `/TEST`, `/BUILD`, `/CODE-SIMPLIFY`, `/VERIFY`, `/REVIEW`, `/SHIP` - documented in [.claude/commands/](.claude/commands). You do not have to follow it to send a fix, but the rules it enforces apply to every change:

- a behaviour change comes with the test that fails without it;
- `npm test` and `npm run lint` pass before you open the pull request;
- no comment explains what the code already says - name things instead;
- the code and the commits are written in English, whatever language the discussion happens in.

A bug fix, a typo, a translation: open the pull request directly. A feature: open an issue first, so nobody writes a week of code the project was not going to take.

## What the project will not accept

Anything that weakens the guarantees the tool exists to hold: a checkpoint that can be ticked without proof, a guardrail that fails open, a path that lets an agent close a story without a human. If a change needs one of those to work, the change is wrong, not the guarantee.
