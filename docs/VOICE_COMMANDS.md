# Fez Voice Command Reference

This reference lists example phrases handled by Fez's local voice router and explains configuration-dependent voice actions.

## Before using voice commands

- Enable **local-first routing** in **Settings > API & models**.
- Speech is still transcribed by Groq Whisper. Local-first routing avoids a chat-model call for recognized local commands; it does not make speech transcription offline.
- Keep the relevant action enabled in **Settings > Actions**.
- Voice actions using assistant tools also require a supported tool-capable chat model.
- Windows controls and app launching are Windows-specific.

## 1. Timers

| What you want | Example phrases |
|---|---|
| Start a timer | `Set a pasta timer for 12 minutes`, `10 minutes` |
| Pause a timer | `Pause the timer` |
| Resume a timer | `Resume the timer` |
| Add time | `Add one minute`, `Add 5 minutes` |
| Check remaining time | `How much time is left?`, `Time remaining` |
| Cancel current timer | `Cancel the timer` |
| Cancel all timers | `Cancel all timers` |

## 2. Reminders and alarms

| What you want | Example phrases |
|---|---|
| Relative reminder | `Remind me in 20 minutes to stretch` |
| Alternative reminder format | `Set a reminder in 20 minutes to stretch` |
| Future date/time reminder | `Remind me tomorrow at 9 to email my professor` |
| Task-first reminder | `Remind me to email my professor at 9am tomorrow` |
| List reminders | `What are my reminders?`, `Show reminders` |
| Cancel a reminder | `Cancel my reminder about email` |
| Cancel all reminders | `Cancel all reminders` |
| Set an alarm | `Set alarm for 7am`, `Set an alarm at 7am` |
| Relative alarm | `Set alarm in 30 minutes` |

Date and clock-time phrases are interpreted by the date parser. Check Fez's confirmation after scheduling.

## 3. Windows controls

| What you want | Example phrases |
|---|---|
| Set volume | `Volume to 30`, `Volume at 30` |
| Increase volume | `Volume up`, `Louder` |
| Decrease volume | `Volume down`, `Quieter` |
| Mute/unmute | `Mute`, `Unmute` |
| Lock Windows | `Lock my computer`, `Lock PC`, `Lock screen` |
| Capture screenshot | `Take a screenshot`, `Capture screenshot` |
| Set brightness | `Brightness to 50`, `Brightness at 50` |
| Minimize windows | `Minimize everything`, `Show desktop` |

Brightness control depends on whether Windows and the display hardware expose brightness adjustment.

## 4. Media controls

- Start or toggle playback: `Play`, `Toggle playback`
- Pause playback: `Pause`, `Pause media`
- Skip forward: `Next track`, `Skip`
- Go back: `Previous track`

Results depend on the active media application and Windows media controls.

## 5. Websites, search, and applications

These actions can be enabled or disabled individually in **Settings > Actions**.

- **Open a website:** `Open github.com` or `Go to https://example.com`.
- **Search YouTube:** `YouTube search for chess analysis`.
- **Search Spotify:** `Spotify search for jazz`.
- **Open an application:** `Open Notepad`, `Launch VS Code`, or `Start Calculator`.

Fez checks configured application targets and can also look up applications registered in the Windows Start Menu.

If an application is not found, check its target in **Settings > Actions**.

Only supported executable targets, approved Windows protocols, or the Windows Start Menu are used. Arbitrary shell commands and URL schemes are not accepted.

The assistant also has a Google web-search action when enabled in Settings. This is an assistant tool action, not a phrase handled by the local command router.

## 6. Macros

Create or edit macros in **Settings > Macros**.

A saved macro can be invoked by its configured name or alias. Macros can contain ordered steps such as:

- Opening URLs or applications
- Handling Spotify links
- Opening folders in VS Code
- Waiting between steps
- Running a command with user-authored arguments

Review a macro before running it, especially if it contains a command step. Macro commands are authored by the user and run on their computer.

## 7. Confirmation and safety

- Shutdown, restart, sleep, and sign-out actions are disabled by default in **Settings > Actions**.
- Enabling these actions still requires a second confirmation.
- Review macro steps before execution, particularly command steps.

## 8. Troubleshooting

1. Check that **local-first routing** is enabled in **Settings > API & models**.
2. Check that the relevant action is enabled in **Settings > Actions**.
3. Speak a short, clear phrase and wait for transcription and confirmation.
4. For application launching, verify that the application is installed and its target is configured.
5. For brightness, confirm that your display supports Windows brightness control.
6. For assistant tool actions, select a supported tool-capable chat model and test the Groq connection.

For installation, API configuration, setup, and build instructions, see the [main README](../README.md).
