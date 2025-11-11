/**
 * Test script to list available tools from MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testMCPServer(packageName: string) {
  console.log(`\n🔍 Testing MCP server: ${packageName}`);
  console.log('='.repeat(60));

  const client = new Client(
    { name: 'mcp-tool-tester', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', packageName],
  });

  try {
    await client.connect(transport);
    console.log(`✅ Connected to ${packageName}`);

    // List available tools
    const tools = await client.listTools();
    console.log(`\n📋 Available tools (${tools.tools.length}):`);

    for (const tool of tools.tools) {
      console.log(`\n  🔧 ${tool.name}`);
      console.log(`     ${tool.description || 'No description'}`);
      if (tool.inputSchema) {
        console.log(`     Parameters:`, JSON.stringify(tool.inputSchema, null, 2).split('\n').map((line, i) => i === 0 ? line : '       ' + line).join('\n'));
      }
    }

    await client.close();
  } catch (error: any) {
    console.error(`❌ Error testing ${packageName}:`, error.message);
  }
}

async function main() {
  console.log('🧪 MCP TOOL DISCOVERY TEST\n');

  // Test mcp-cook
  await testMCPServer('mcp-cook');

  // Test howtocook-mcp (though it has network issues)
  console.log('\n\n');
  await testMCPServer('howtocook-mcp');

  console.log('\n\n✅ Tool discovery complete!');
}

main().catch(console.error);
