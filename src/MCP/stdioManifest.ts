export interface MCPServerConfig {
  name: string
  version: string
  path: string
}

export const manifest: MCPServerConfig[] = [
  {
    name: 'hello-world',
    version: '1.0.0',
    path: 'src/MCP/helloWorld/index.ts',
  },
]
