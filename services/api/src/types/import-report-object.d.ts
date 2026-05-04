declare global {
  interface Object {
    metadataJson?: Record<string, unknown> | null;
  }
}

export {};
