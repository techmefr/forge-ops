# Architecture

The shape the tool is moving to, decided on 2026-09-18. What is built today is listed in the README; this document says what it is being built into, and why each line is there rather than another one.

## 1. Two halves, one boundary

The tool used to be one process on one machine. It becomes two things that never overlap.

**The server** holds what is shared: accounts, organisations, business units, projects, epics, stories, who took what, milestone dates. It starts no agent and holds no code.

**The instance** holds what executes: sessions, worktrees, conversations, touched files, machine metrics, costs, evidence. It runs where its owner puts it - a laptop or a VPS - with the agent CLI beside it, and it contacts the server at startup to learn who the user is and which group and business unit they belong to.

Two consequences, one pleasant and one to accept.

- Code and evidence never leave the machine that produced them. Only the tracking travels.
- The instance has to keep working when the server is unreachable: it queues what it owes and resynchronises later. A network hiccup in the middle of a task must not stop the task.

The contract between them is versioned, because instances update when their owners decide: a six-month-old instance will talk to a recent server. The instance checks the contract version at startup and says what it would install **before** installing it - a tool that runs agents never changes its own code unannounced.

## 2. The organisation is in the model from the first migration

A self-hosted install has one organisation and never thinks about it. The hosted offer has many and depends on it. Adding a tenant column afterwards is a migration through every table and every endpoint, so every shareable row carries its organisation from the start.

## 3. Identity

Authentication providers are a setting, not a compilation: each organisation points at its own Entra or Google, the hosted offer points at its own. Password is one provider among them rather than the foundation - Entra carries recovery and multi-factor, a hand-rolled password carries hashing, reset, lockout and breach response for us. Order of arrival: password and Microsoft, then Google, magic link later.

The instance needs an identity of its own. A board on a VPS must prove it belongs to an account without a human retyping a password at every restart: a revocable instance token, bound to the account and listed in the settings.

## 4. Four screens

| Screen | What it answers |
|---|---|
| Projects dashboard | Where every project stands, who took what, which milestone is coming - the shared view, read from the server |
| Personal dashboard | Everything about the person signed in: their indicators, their machine, their epics, their files |
| Settings | How this organisation works and how this screen looks |
| Statistics | Where the time and the money went |

Horizontal tabs replace the left rail. The digits still move between screens and the tab prints its digit: a shortcut nobody can see is a shortcut nobody uses.

The backlog is no longer a destination - it is the first column of the kanban, where stories wait for a session.

The machine metrics live on the personal dashboard because they answer one question: can I start one more session right now. They are the metrics of the instance that executes; on a shared server they would mean nothing.

## 5. Columns are a template, checkpoints are not

A template declares the columns of a kanban: their order, their delays, and for each one the agent that works it and the prompt it starts from. The one shipped with the tool is an example, not the law.

**What a template never controls**: the story and its test twin, the proof attached to the story, the review cascade, the final human gate. A column is a display stage; a checkpoint is a proof. They are not the same object, and a template that could remove a checkpoint would produce a board without proof - which is the one thing this tool exists to prevent.

Rules that keep it usable by more than one team:

- only an admin edits the columns of a project; someone who wants their own way of working creates their own page and tries it there;
- a template is a version, not a live setting - a project adopts a version and stays on it, so adding a column never moves somebody else's cards;
- an organisation can hold several templates, one per audience, and a new project inherits the default or picks one;
- a template travels as JSONL, one record per line, so it can be shared with no server at all.

A column says who works it: a panel on its header shows the agent, the starting prompt, the delay and the template version the project stayed on. Visible to everyone, editable by an admin - hiding which agent runs a column protects nothing and is exactly what you want to read when an agent does something unexpected.

## 6. One story, one merge request

A session carries one story, its own worktree and its own merge request. Grouping several stories into one session survives as an option, and if it does, pulling a story back out of a session in flight is part of it from the first line of code - it is the expensive part to add once several stories share a branch.

The proof stays attached to the story, never to the session. That is what lets a board say "four stories out of seven" instead of a single binary.

## 7. The agent is a driver

A kanban card is a conversation with an agent. Which agent is a driver decision: Claude Code first, then others, without the rest of the system noticing. The column already declares its agent, so the driver is picked there.

The contract names what a driver must do - start a session, send a turn, stream events, report cost and exit class - and what degrades gracefully when a given driver cannot.

## 8. What none of this changes

The reason the tool exists is unchanged by the rework:

- a step is proven by a file, never by an assertion;
- the sequence is enforced server-side, not documented as a convention;
- the guardrail fails closed;
- the last gate is human - no agent moves a story to done.
