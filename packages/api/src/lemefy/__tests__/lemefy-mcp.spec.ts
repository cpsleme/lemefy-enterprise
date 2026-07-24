import { lemefyService, lemefyMcpHandler } from '../index';

describe('lemefy MCP handler', () => {
  describe('tools', () => {
    it('should include Kaneo tools', () => {
      const toolNames = lemefyService.kaneo.tools.map((t) => t.name);
      expect(toolNames).toContain('create_project');
      expect(toolNames).toContain('get_project');
      expect(toolNames).toContain('list_projects');
      expect(toolNames).toContain('create_task');
      expect(toolNames).toContain('get_task');
      expect(toolNames).toContain('link_workflow');
    });

    it('should include RAG tools', () => {
      const toolNames = lemefyService.rag.tools.map((t) => t.name);
      expect(toolNames).toContain('search_knowledge');
      expect(toolNames).toContain('add_document');
      expect(toolNames).toContain('get_document');
      expect(toolNames).toContain('list_documents');
      expect(toolNames).toContain('delete_document');
    });
  });

  describe('callTool', () => {
    it('should handle unknown tools with an error', async () => {
      const result = await lemefyMcpHandler.callTool('unknown_tool', {});
      expect(result.isError).toBe(true);
    });
  });
});