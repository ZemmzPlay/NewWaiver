/** Values every surface needs, resolved once, with no secret among them. */
export const config = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
  printAgentUrl: process.env.NEXT_PUBLIC_PRINT_AGENT_URL ?? '',
};
