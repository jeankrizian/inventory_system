const DocumentService = require('../utils/documentService');
const { generateDocumentPdf } = require('../utils/documentPdfService');
const { sendSuccess, sendError } = require('../utils/response');

const DocumentController = {
  async getAll(req, res) {
    try {
      const paginated = req.query.page !== undefined && req.query.page !== null && req.query.page !== '';
      const filters = {
        document_type: req.query.document_type,
        search: req.query.search,
        limit: req.query.limit
      };

      if (paginated) {
        filters.paginated = true;
        filters.page = req.query.page;
        filters.limit = req.query.limit || 25;
        const result = await DocumentService.listDocuments(filters);
        const totalPages = Math.max(1, Math.ceil(result.total / result.limit) || 1);
        return res.status(200).json({
          success: true,
          message: 'Success',
          data: result.data,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages
          }
        });
      }

      const data = await DocumentService.listDocuments(filters);
      sendSuccess(res, data);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getById(req, res) {
    try {
      const document = await DocumentService.getDocument(req.params.id);
      if (!document) return sendError(res, 'Document not found', 404);
      sendSuccess(res, document);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async downloadPdf(req, res) {
    try {
      const document = await DocumentService.getDocument(req.params.id);
      if (!document) return sendError(res, 'Document not found', 404);
      generateDocumentPdf(document, res);
    } catch (err) {
      if (!res.headersSent) sendError(res, err.message, 500);
    }
  },

  async findByTransaction(req, res) {
    try {
      const { type, module, transaction_id } = req.query;
      if (!type || !module || !transaction_id) {
        return sendError(res, 'type, module, and transaction_id are required', 400);
      }
      const document = await DocumentService.findByTransaction(type, module, transaction_id);
      if (!document) return sendError(res, 'Document not found', 404);
      sendSuccess(res, document);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async findByInventoryItem(req, res) {
    try {
      const inventoryItemId = parseInt(req.params.inventoryItemId, 10);
      if (!inventoryItemId) return sendError(res, 'Valid inventory item id is required', 400);
      const documents = await DocumentService.findAllForInventoryItem(inventoryItemId);
      sendSuccess(res, documents);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = DocumentController;
