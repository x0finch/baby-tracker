# Siri voice logging

Say "嘿 Siri，记录宝宝", then what happened ("小米粒换尿布了，还喝了 120 毫升奶"). Bobo records
it, says what it did and asks "还有吗？". Ask about records ("上次喂奶是几点"), change or delete
them, or say "没有了" to finish.

## How it works

1. The **Shortcuts** shortcut asks "要记录什么？" and sends the answer to
   `POST /api/voice/siri`, with the user's code in the `Authorization` header.
2. The server runs an agent with TanStack AI (`apps/api/src/agent/`). It has tools to list the
   babies, find records, record, update, delete, undo and end the conversation.
3. Writes go through the same checks and SQL as a sync push (`agent/data.ts`), so every device
   gets them on its next pull.
4. The answer is `{ ok, done, confirming, reply }`, always with status 200. Siri reads `reply`,
   and the shortcut asks again until `done` is set.

### The conversation

- Each user has one conversation, stored in D1 with TanStack AI persistence
  (`agent/persistence.ts`). Long ones are compacted (`withCompaction`).
- After 30 idle minutes the next message starts a new one. So does a change of key (own or
  shared, and which family's): what was said with one key never goes to another key's provider.
- Settings → Siri 语音记录 → 试一下 opens the same conversation as a chat box. What is said
  there is really recorded.
- Updating or deleting a record needs approval (`needsApproval`). Siri asks
  "要删除「…」吗？". "对" and the like approve it, "不" and the like refuse it. Anything else
  refuses it and is handled as a new message.
- "撤销" reverts the latest change of the conversation (`voice_ops`).

### Families

One shortcut and one code cover all the user's families. The agent is given the babies the user
may record for and works out the family from the name. A name used in two families gets the
family's name added, as in "小米粒（外婆家）". When it is unclear which baby is meant, the agent
asks. Every write is still checked against the user's role and baby scope.

### Whose AI

Each user can set their own AI under Settings → 我的 AI:

- the provider: OpenAI, or OpenRouter for other vendors' models;
- their API key;
- a model from the key's list. Only models that can use tools are listed.

The key is encrypted with `ENCRYPTION_SECRET` (AES-GCM). Only its last characters are ever shown.

A user can share their AI with any of their families. Members without a key of their own use it
there. When several members share with a family, its owner or admins pick one; by default it is
the earliest. Leaving the family ends the share.

Which key a command uses (`agent/keys.ts`):

1. **The user's own key**, if set. It records in every family where the user is not a viewer.
2. Else **a key shared with one of their families**: the first such family, in the order they
   joined. It records only in that family, so a key is never spent outside the family it was
   shared with.
3. Else voice logging is not available, and the reply says how to set up an AI.

### The code

- One per user, made on the settings page. Only its SHA-256 hash is stored.
- It acts for the user only through the agent's tools.
- It stops working:
  - after 180 days without use (each use extends it);
  - when it is replaced or revoked;
  - when the password changes;
  - when the account is deleted;
  - when the user signs out on the device that made it.
- Limits: 10 requests a minute (`VOICE_RATE_LIMIT`), and 200 messages a day per user across
  Siri and the chat box.

## Setup

### 1. Encryption secret

Add the repository secret `ENCRYPTION_SECRET` (Settings → Secrets and variables → Actions): a random
string of 32+ characters, e.g. from a password manager. Then re-run the deploy. Without it, nobody
can save an AI key. Changing it later makes saved keys unreadable, and users have to enter them
again.

Then, in the app: Settings → 我的 AI → choose a provider, paste a key, pick a model, and share it
with the family if others should use it.

### 2. The shortcut (once, on a Mac)

The settings page's "添加到 Siri" button copies the user's code and opens
`/siri/bobo.shortcut`. That file is one signed shortcut shared by everyone. It asks for the code
when it is added.

`apps/web/scripts/build-shortcut.mjs` writes the shortcut. Only signing needs the Mac:

```sh
cd apps/web
node scripts/build-shortcut.mjs > 记录宝宝.shortcut
shortcuts sign --mode anyone --input 记录宝宝.shortcut --output public/siri/bobo.shortcut
```

Commit `public/siri/bobo.shortcut`. Until it exists, the "添加到 Siri" button has nothing to
open. Pass another origin as the script's argument to point the shortcut at another server.

What the shortcut does:

1. Keeps the code (asked for on import: "请粘贴 Bobo 设置里复制的口令") and the question
   "要记录什么？".
2. Repeats up to 20 times:
   1. **Ask for Input** with the question;
   2. **Get Contents of URL**: POST `/api/voice/siri`, header `Authorization` with the code, JSON
      body `{ "text": <the answer> }`;
   3. **Speak Text** with the reply's `reply`;
   4. stops when the reply's `next` is `stop` (the same as `done`, as text, which the shortcut's
      If compares reliably);
   5. clears the question: the reply just spoken already asks the next one ("还有吗？",
      "要删除…吗？").

Users who pick another phrase rename their copy of the shortcut to it.

### 3. Try it

1. Settings → Siri 语音记录 → 试一下, and say something to record.
2. Tap 添加到 Siri, paste the code when Shortcuts asks, and add the shortcut.
3. Say "嘿 Siri，记录宝宝".
4. Optional: iPhone Settings → Accessibility → Touch → Back Tap → Double Tap → the shortcut.
