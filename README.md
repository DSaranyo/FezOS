# Fez

Fez is a small Windows voice assistant that stays at the top-center of your display. Ask a question by voice and Fez transcribes it with Groq Whisper, then streams a concise answer from a Groq chat model in a dynamic-island-style pill. It can also handle routine timers, reminders, Windows controls, and voice actions.

This guide covers installing the prerequisites, running Fez from source, configuring its services, building a Windows installer, and troubleshooting common first-run issues.

## What you need

- Windows 10 or Windows 11. Fez uses Windows-specific features and is not currently supported on macOS or Linux.
- [Node.js 20 or newer](https://nodejs.org/), which includes npm. Check the installed versions in PowerShell:

  ```powershell
  node --version
  npm --version
  ```

- An internet connection for installing dependencies and using Groq.
- A [Groq API key](https://console.groq.com/keys) for transcription and chat. Check Groq's current account, model availability, rate limits, and pricing before use.
- A working microphone. Windows may ask you to allow microphone access the first time you record.

ElevenLabs is optional. Fez can use the Windows speech voice instead, so an ElevenLabs account is not required.

## Install and run from source

Open PowerShell in the project folder (the folder containing `package.json`) and install the locked dependencies:

```powershell
npm ci
```

Start the development app:

```powershell
npm run dev
```

This builds the Electron main process, starts the Vite renderer, and launches Fez. Keep the terminal open while using the development version; press `Ctrl+C` there to stop it. The renderer's development server is bound to `127.0.0.1:5173`.

### First-run setup

1. Find the Fez pill at the top-center of the display. With the default **Auto-hide Fez** setting, it tucks into a narrow top-edge sliver. Hover over the sliver briefly to reveal Fez.
2. Click the small settings button on the idle pill to open **Settings**.
3. In **API & models**, paste your Groq API key and click **Save changes**. The default models are `whisper-large-v3-turbo` for speech-to-text and `openai/gpt-oss-20b` for chat.
4. Click **Test Groq connection**. Fez checks that the key works and that both selected models are available to it. If the check reports an unavailable model, choose a model available to your key and try again. Voice actions require one of the tool-capable models listed in Settings.
5. In **General**, check the activation shortcut and interaction mode. The default is **Push-to-talk** with `Ctrl+Alt`.
6. Click **Save changes**, close Settings, and try asking Fez a question.
7. If Windows prompts for microphone access, allow it. If recording is blocked, enable microphone access for desktop apps in Windows **Settings > Privacy & security > Microphone**, then try again.

### Talking to Fez

- **Click-to-talk:** click the pill's central button, speak, then wait for the silence timeout or click the stop button.
- **Push-to-talk:** hold the configured shortcut (default `Ctrl+Alt`) for at least 150 ms while Fez is idle, speak, then release the keys. A very short or silent recording is discarded. Fez stops a recording automatically after one minute as a safety limit.
- **Toggle mode:** change **Mode** in **General** to Toggle. The configured shortcut starts and stops listening.
- **Reveal a hidden pill:** hover briefly over the top-edge sliver or use the activation shortcut.

To change the shortcut, click **Capture shortcut** in **General**, press and release the desired key chord, and save. In some Windows apps, pressing Alt can focus the menu bar; choose another chord if that gets in the way. Turn off **Auto-hide Fez** if you prefer the full idle pill to remain visible.

## Configure services and preferences

### Groq (required)

Fez uses Groq for speech transcription and assistant answers. In **Settings > API & models**, you can:

- Save or replace the Groq API key.
- Change the speech-to-text and chat model names.
- Test the key and selected models with **Test Groq connection**.
- Enable or disable local-first routing, set the number of chat messages retained as conversation history (default: 6), and edit the system prompt.
- View this session's Whisper, Groq chat, and local-command counts.

The default chat model supports Fez's function-calling actions. If you choose a different chat model, use a model in the tool-capable list shown in Settings if you want voice actions. Model availability can change; use the connection test to check availability for your key.

API keys are encrypted with Electron's Windows secure storage and are not exposed to the renderer. Fez sends audio to Groq for transcription and sends chat requests to Groq to generate answers; avoid recording or asking about information you do not want sent to those services.

### Optional ElevenLabs speech

Fez can speak answers as they arrive. Windows speech fallback is enabled by default; ElevenLabs is optional.

1. In **Settings > Voice**, enter an ElevenLabs API key and save it.
2. Choose a voice ID and model if you do not want the defaults (`Sun6GPdivU7N4kTmYtDw` and `eleven_flash_v2_5`).
3. Use **Test voice** to verify the configuration.

Speech settings include voice speed, stability, similarity, volume, and response length. Fez streams sentence-sized chunks, skips fenced code, and supports interrupting speech. Settings also shows this session's and the cumulative ElevenLabs character counts. Check your ElevenLabs plan and current pricing before enabling it.

### Other settings

Settings is split into **General**, **API & models**, **Timers**, **Voice**, **Actions**, and **Macros**. For example, you can configure auto-collapse timing and top offset, enable launch at Windows sign-in, toggle individual voice actions, edit app targets, and configure timer chimes.

Destructive Windows actions (shut down, restart, sleep, and sign out) are disabled by default. Enabling them in **Actions** still requires a second confirmation for each action.

## Features

### Voice actions

Fez can open an `http` or `https` website, search YouTube or Google, open a configured Windows app, or search Spotify. The default app table includes common targets such as Notepad, File Explorer, VS Code, and Spotify. You can enable or disable individual actions and edit app names and targets in **Settings > Actions**.

App targets are limited to a single executable, an approved Windows protocol, or `start-menu` for a Windows-registered application. The model cannot provide an executable, command line, or arbitrary URL scheme.

### Local commands, timers, and reminders

Fez recognizes many routine requests locally before asking Groq's chat model, which makes these actions faster and saves chat-model calls. Speech still goes through Groq Whisper for transcription.

Examples:

- “Set a pasta timer for 12 minutes,” “pause the timer,” “add one minute,” or “how much time is left.”
- “Remind me in 20 minutes to stretch,” “set an alarm for 7am,” “what are my reminders,” or “cancel my reminder about email.”
- “Volume to 30,” “mute,” “next track,” “lock my computer,” “take a screenshot,” or “minimize everything.”

Timers and reminders persist across relaunches. When one is due, Fez shows a Windows notification and an in-app dismiss-or-snooze panel. Timer completion chimes repeat every three seconds until dismissed or snoozed. Brightness control depends on display hardware; Fez reports when Windows cannot control it.

### Macros

The **Macros** tab lets you create ordered routines that open URLs or apps, handle Spotify links, open folders in VS Code, wait between steps, or run a command with user-authored arguments. Fez seeds editable example macros on first use. You can run macros from Settings, import or export them as JSON, or invoke a saved macro by name or alias. The model may run an existing macro but cannot create or edit one or supply its commands.

Review a macro's steps before running it, especially command steps: those commands are authored by you and run on your computer.

## Build a Windows installer

From the project folder, run:

```powershell
npm run build
```

This builds the renderer and Electron main process, then runs `electron-builder`. The Windows NSIS installer and unpacked application are written to `release\`. The installer allows choosing an installation directory.

The project unpacks the `uiohook-napi` native module from the application ASAR for the global push-to-talk shortcut. The configured build does not require Visual Studio C++ build tools.

To run the production build without installing it, first run `npm run build:renderer` and `npm run build:main`, then launch Electron using a separate terminal:

```powershell
npx electron .
```

For normal development, use `npm run dev`; it starts the renderer and main-process watchers as well as Electron.

## Validation commands

Run the TypeScript checks:

```powershell
npm run typecheck
```

Run the automated tests for text chunking, local routing, and scheduling:

```powershell
npm run test:chunker
```

## Troubleshooting

- **Fez does not appear:** make sure `npm run dev` is still running. Look at the top-center edge of the display and hover over the hidden sliver. If another app uses `Ctrl+Alt`, capture a different shortcut in Settings.
- **Microphone access is blocked:** allow microphone access for desktop apps in Windows **Settings > Privacy & security > Microphone**. Close and reopen Fez after changing the permission.
- **Groq connection test fails:** confirm the key in **API & models**, check that the key is active and the selected models are available to it, and verify your internet connection and Groq account limits.
- **“Tool-calling list” or model error:** choose a listed supported chat model in **API & models**, save, then run the connection test again.
- **No spoken answer:** check **Settings > Voice** and the Windows output device/volume. If using ElevenLabs, verify its key, voice ID, model, and account availability; Windows speech fallback can be used instead.
- **The installer build fails:** confirm `npm ci` completed successfully and that Node.js 20 or newer is installed. Check the error output from `electron-builder`; packaged files are placed in `release\`.

## Project layout

- `src/main`: Electron window, tray, shortcuts, settings, Groq integration, actions, timers, reminders, and macros.
- `src/main/tts`: ElevenLabs client and speech session handling.
- `src/preload`: context-isolated API between Electron and the UI.
- `src/renderer`: React interface, microphone recording, and audio playback.
- `tests`: tests for text chunking, local routing, and scheduling.

Screen capture, wake words, and non-Windows platforms are intentionally out of scope for now.
