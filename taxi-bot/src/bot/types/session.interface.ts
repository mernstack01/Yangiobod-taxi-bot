export interface TempDriver {
  carModel?: string;
  carNumber?: string;
  carColor?: string;
}

// Session data stored in Redis for active conversations
export interface SessionData {
  step?: string;
  tempDriver?: TempDriver;
}
