interface Window {
  pill: {
    setInteractive(value: boolean): void; dismiss(): void; openSettings(): Promise<void>; testGroq(): Promise<{ message: string }>;
    reportState(state: string): void; captureHotkey(): Promise<void>;
    settings: { get(): Promise<any>; save(value: any): Promise<any>; saveKey(value: string): Promise<boolean>; saveElevenLabsKey(value: string): Promise<boolean>; resetElevenLabsUsage(): Promise<{ total: number; session: number }> };
    transcribe(bytes: Uint8Array): Promise<string>;
    chat: { start(question: string, id: string): Promise<void>; clear(): Promise<void> };
    tts: { test(id: string): Promise<{ message: string }>; cancel(id?: string): Promise<boolean> };
    timers: { pause(id?: string): Promise<any>; resume(id?: string): Promise<any>; add(id: string, milliseconds: number): Promise<any>; cancel(id?: string): Promise<any>; dismiss(id: string): Promise<void>; snooze(id: string): Promise<void> };
    reminders: { dismiss(id: string): Promise<void>; snooze(id: string): Promise<any>; cancel(id?: string): Promise<any> };
    system: { confirm(): Promise<any>; cancel(): Promise<boolean> };
    macros: { get(): Promise<any[]>; save(value: unknown): Promise<any[]>; run(id: string): Promise<any> };
    on(channel: string, listener: (...args: any[]) => void): () => void;
  };
}
