const { Router } = require('express');
const { logger } = require('@lemefy/data-schemas');

const router = Router();

router.get('/rag/search', async (req, res) => {
  try {
    const { query, category, source, tags, limit, threshold } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'query parameter is required' });
    }
    const tagsArray = tags ? (Array.isArray(tags) ? tags : [tags]) : undefined;
    const result = await lemefyService.rag.searchKnowledge({
      query,
      category,
      source,
      tags: tagsArray,
      limit: limit ? parseInt(limit, 10) : undefined,
      threshold: threshold ? parseFloat(threshold) : undefined,
    });
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error searching knowledge', error);
    res.status(500).json({ error: 'Error searching knowledge' });
  }
});

router.post('/rag/documents', async (req, res) => {
  try {
    const doc = req.body;
    if (!doc.id || !doc.title || !doc.content || !doc.source || !doc.category) {
      return res.status(400).json({ error: 'id, title, content, source, and category are required' });
    }
    await lemefyService.rag.addKnowledgeDocument(doc);
    res.status(201).json({ message: 'Document added', id: doc.id });
  } catch (error) {
    logger.error('[lemefy] Error adding document', error);
    res.status(500).json({ error: 'Error adding document' });
  }
});

router.get('/rag/documents', async (req, res) => {
  try {
    const { category, source, limit } = req.query;
    const docs = await lemefyService.rag.listDocuments({
      category,
      source,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json({ documents: docs, count: docs.length });
  } catch (error) {
    logger.error('[lemefy] Error listing documents', error);
    res.status(500).json({ error: 'Error listing documents' });
  }
});

router.get('/rag/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await lemefyService.rag.getDocumentById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.status(200).json(doc);
  } catch (error) {
    logger.error('[lemefy] Error getting document', error);
    res.status(500).json({ error: 'Error getting document' });
  }
});

router.delete('/rag/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await lemefyService.rag.deleteDocument(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.status(200).json({ message: `Document ${id} deleted` });
  } catch (error) {
    logger.error('[lemefy] Error deleting document', error);
    res.status(500).json({ error: 'Error deleting document' });
  }
});

module.exports = router;