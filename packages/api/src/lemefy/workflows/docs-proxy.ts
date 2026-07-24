interface DocsProxyOptions {
  url: string;
  initTimeout?: number;
}

interface DocsProxyResult {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean };
  }>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

export function createDocsProxy(options: DocsProxyOptions): DocsProxyResult {
  const baseUrl = options.url.replace(/\/$/, '');
  const initTimeout = options.initTimeout ?? 10_000;

  let initialized = false;
  let initPromise: Promise<void> | null = null;

  async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    if (!initPromise) {
      initPromise = initializeDocsServer(baseUrl, initTimeout);
    }
    try {
      await initPromise;
      initialized = true;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  }

  async function initializeDocsServer(url: string, timeoutMs: number): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${url}/health`, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Docs MCP server health check failed: ${response.status}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function callTool(name: string, args: Record<string, unknown>): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    await ensureInitialized();

    try {
      const response = await fetch(`${baseUrl}/tools/${encodeURIComponent(name)}/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          content: [{ type: 'text', text: `Docs tool failed: ${response.status}: ${text}` }],
          isError: true,
        };
      }

      const data = (await response.json()) as { content?: Array<{ type: string; text: string }> };
      return {
        content: data?.content ?? [{ type: 'text', text: 'No content returned from docs server.' }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Docs tool error: ${error instanceof Error ? error.message : 'unknown error'}` }],
        isError: true,
      };
    }
  }

  return {
    tools: [
      {
        name: 'search_finos_docs',
        description: 'Search FINOS documentation for cloud controls, FOCUS specifications, and financial services open source standards.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for FINOS documentation' },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: 'Maximum results to return' },
          },
          required: ['query'],
        },
        annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
      },
      {
        name: 'get_finos_standard',
        description: 'Get a specific FINOS standard or specification by identifier.',
        inputSchema: {
          type: 'object',
          properties: {
            standard: { type: 'string', description: 'Standard identifier (e.g., C3, FOCUS)' },
            version: { type: 'string', description: 'Version string' },
          },
          required: ['standard'],
        },
        annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      },
    ],
    callTool,
  };
}
