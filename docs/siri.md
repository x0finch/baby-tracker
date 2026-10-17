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
- After 30 idle minutes the next message starts a new one.
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

The key is encrypted with `AI_KEY_SECRET` (AES-GCM). Only its last characters are ever shown.

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
- Limits: 10 requests a minute (`VOICE_RATE_LIMIT`) and 200 a day per code.

## Setup

### 1. Encryption secret

Add the repository secret `AI_KEY_SECRET` (Settings → Secrets and variables → Actions): a random
string of 32+ characters, e.g. from a password manager. Then re-run the deploy. Without it, nobody
can save an AI key. Changing it later makes saved keys unreadable, and users have to enter them
again.

Then, in the app: Settings → 我的 AI → choose a provider, paste a key, pick a model, and share it
with the family if others should use it.

### 2. The shortcut (once, on a Mac)

The settings page's "添加到 Siri" button copies the user's code and opens
`/siri/bobo.shortcut`. That file is one signed shortcut shared by everyone. It asks for the
code when it is added.

Build it in the Shortcuts app on the Mac, or on the iPhone and let it sync. Name it
**记录宝宝**; users who pick another phrase rename their copy. It keeps asking until the reply
has `done` set: when the agent ends the conversation, or when asking again cannot help.

Actions, in order:

1. **Text**
   - Content: leave it empty. It holds the code, filled in by the import question below.
   - Then **Set Variable**: name `口令`, input the Text.
2. **Text**: `要记录什么？`
   - Then **Set Variable**: name `问题`, input the Text.
3. **Repeat** 20 times, with these inside:
   1. **Ask for Input**: Type Text, Prompt `问题`.
   2. **Get Contents of URL**:
      - URL: `https://bobo.009003.xyz/api/voice/siri`
      - Method: POST
      - Headers: `Authorization` → `口令`
      - Request Body: JSON, with a Text key `text` → **Provided Input**
   3. **Get Dictionary Value**: Value for key `reply` in **Contents of URL**.
   4. **Speak Text**: **Dictionary Value**.
   5. **Get Dictionary Value**: Value for key `done` in **Contents of URL**.
   6. **If** **Dictionary Value** is **true**: **Stop This Shortcut**. End If.
   7. **Set Variable**: name `问题`, input an empty **Text**. The reply just spoken already asks
      the next question ("还有吗？", "要删除…吗？").

Then open the shortcut's details (ⓘ) → **Setup** and add an import question for the empty
**Text** in step 1:

- Question: `请粘贴 Bobo 设置里复制的口令`
- Default answer: empty

Export it signed for everyone. Either way works:

- In the Shortcuts app: right-click the shortcut → Share → Export File → Who can import:
  **Anyone**. Save it as `bobo.shortcut`.
- From the terminal: `shortcuts sign --mode anyone --input 记录宝宝.shortcut --output bobo.shortcut`.

Commit the file as `apps/web/public/siri/bobo.shortcut`. Until it exists, the "添加到 Siri"
button has nothing to open.

### 3. Try it

1. Settings → Siri 语音记录 → 试一下, and say something to record.
2. Tap 添加到 Siri, paste the code when Shortcuts asks, and add the shortcut.
3. Say "嘿 Siri，记录宝宝".
4. Optional: iPhone Settings → Accessibility → Touch → Back Tap → Double Tap → the shortcut.
