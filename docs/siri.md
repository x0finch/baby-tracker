# Siri voice logging

Say "嘿 Siri，记录宝宝", then what happened ("小米粒换尿布了，还喝了 120 毫升奶"), and Bobo
adds the records. Siri reads the result back.

## How it works

1. The **Shortcuts** shortcut asks "要记录什么？" and sends the answer to
   `POST /api/voice/siri` with the user's code in the `Authorization` header.
2. The server parses the sentence with TanStack AI, using the AI model of the one family the
   user's Siri is bound to (`apps/api/src/voice/parse.ts`, `ai.ts`). The model only fills in a
   strict schema. The server builds the records, validates them like synced ones and checks
   family permissions (`apps/api/src/voice/plan.ts`).
3. The records are written like a sync push, so every device gets them on its next pull. The
   reply (`{ reply }`) is what Siri says.

"撤销" undoes the last command (within 30 minutes). Settings → Siri 语音记录 has a preview that
parses without recording.

### One family, its own AI

- Each family's owner or admins set its AI model in the family's settings:
  - provider: OpenAI, or OpenRouter for other vendors' models;
  - their own API key;
  - a model from the key's list.
- The key is encrypted with `AI_KEY_SECRET` (AES-GCM). Only its last characters are ever shown.
- A user's Siri records for one family: their only one, or the one they pick under
  Settings → Siri 语音记录. It uses that family's AI and can only record that family's babies,
  so a family's key is never spent on another family.

### The code

- One per user, made on the settings page. Only its SHA-256 hash is stored.
- It can only add records and undo the last command.
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
string of 32+ characters, e.g. from a password manager. Then re-run the deploy. Without it,
families can't save AI keys. Changing it later makes saved keys unreadable, and families have to
enter them again.

Then, in the app: family settings → AI 模型 → choose a provider, paste a key, pick a model.

### 2. The shortcut (once, on a Mac)

The settings page's "添加到 Siri" button copies the user's code and opens
`/siri/bobo.shortcut`. That file is one signed shortcut shared by everyone. It asks for the
code when it is added.

Build it in the Shortcuts app on the Mac, or on the iPhone and let it sync. Name it
**记录宝宝** and give it these actions in order:

1. **Ask for Input**
   - Type: Text
   - Prompt: `要记录什么？`
2. **Text**
   - Content: leave it empty. It holds the code, filled in by the import question below.
3. **Get Contents of URL**
   - URL: `https://bobo.009003.xyz/api/voice/siri`
   - Method: POST
   - Headers: `Authorization` → the **Text** from step 2
   - Request Body: JSON, with a key `text` → **Provided Input** from step 1
4. **Get Dictionary Value**
   - Key: `reply`
   - Dictionary: **Contents of URL**
5. **Speak Text**
   - Text: **Dictionary Value**

Then open the shortcut's details (ⓘ) → **Setup** and add an import question for the **Text**
action in step 2:

- Question: `请粘贴 Bobo 设置里复制的口令`
- Default answer: empty

Export it signed for everyone. Either way works:

- In the Shortcuts app: right-click the shortcut → Share → Export File → Who can import:
  **Anyone**. Save it as `bobo.shortcut`.
- From the terminal: `shortcuts sign --mode anyone --input 记录宝宝.shortcut --output bobo.shortcut`.

Commit the file as `apps/web/public/siri/bobo.shortcut`. Until it exists, the "添加到 Siri"
button has nothing to open.

### 3. Try it

1. Settings → Siri 语音记录 → 试一下, to check the parsing.
2. Tap 添加到 Siri, paste the code when Shortcuts asks, and add the shortcut.
3. Say "嘿 Siri，记录宝宝".
4. Optional: iPhone Settings → Accessibility → Touch → Back Tap → Double Tap → the shortcut.
