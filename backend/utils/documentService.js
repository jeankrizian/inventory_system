const DocumentModel = require('../models/DocumentModel');
const DocumentDataService = require('./documentDataService');
const { generateDocumentPdf } = require('./documentPdfService');

module.exports = {
  ...DocumentDataService,
  generateDocumentPdf,

  async getDocument(id) {
    return DocumentModel.findById(id);
  },

  async listDocuments(filters) {
    return DocumentModel.getAll(filters);
  },

  async findByTransaction(documentType, relatedModule, relatedTransactionId) {
    return DocumentModel.findByTransaction(documentType, relatedModule, relatedTransactionId);
  },

  async findAllForInventoryItem(inventoryItemId) {
    return DocumentModel.findAllForInventoryItem(inventoryItemId);
  }
};
