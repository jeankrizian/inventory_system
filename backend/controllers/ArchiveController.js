const ArchiveModel = require('../models/ArchiveModel');
const UserModel = require('../models/UserModel');
const { restoreRecord, getModuleConfig } = require('../utils/archiveService');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyAdministrators } = require('../utils/notificationService');
const { buildGovernanceNotificationMessage } = require('../utils/assetNotificationHelper');
const { usersLink } = require('../utils/notificationLinks');

const ArchiveController = {
  async getAll(req, res) {
    try {
      const data = await ArchiveModel.getAll({
        search: req.query.search,
        module: req.query.module,
        page: req.query.page,
        pageSize: req.query.pageSize
      });
      sendSuccess(res, data);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async restore(req, res) {
    try {
      const { module, id } = req.params;
      const cfg = getModuleConfig(module);
      if (!cfg) return sendError(res, 'Invalid module', 400);

      const restored = await restoreRecord(cfg.table, id);
      if (!restored) return sendError(res, 'Archived record not found', 404);

      // Activity log with entity metadata (parity with ARCHIVE actions / user restore)
      const restoreMetaByModule = {
        user: async () => {
          const user = await UserModel.findById(id);
          return user
            ? {
                description: `Restored user ${user.username}`,
                entity_type: 'user',
                entity_id: user.id,
                reference_code: user.username,
                record: user
              }
            : null;
        },
        department: async () => {
          const CategoryModel = require('../models/CategoryModel');
          const record = await CategoryModel.findById(id);
          return record
            ? {
                description: `Restored department ${record.name}`,
                entity_type: 'department',
                entity_id: record.id,
                reference_code: record.code || record.name
              }
            : null;
        },
        location: async () => {
          const LocationModel = require('../models/LocationModel');
          const record = await LocationModel.findById(id);
          return record
            ? {
                description: `Restored location ${record.name}`,
                entity_type: 'location',
                entity_id: record.id,
                reference_code: record.name
              }
            : null;
        },
        supplier: async () => {
          const SupplierModel = require('../models/SupplierModel');
          const record = await SupplierModel.findById(id);
          return record
            ? {
                description: `Restored supplier ${record.name}`,
                entity_type: 'supplier',
                entity_id: record.id,
                reference_code: record.name
              }
            : null;
        },
        inventory: async () => {
          const InventoryModel = require('../models/InventoryModel');
          const record = await InventoryModel.findById(id);
          return record
            ? {
                description: `Restored item ${record.item_code}`,
                entity_type: 'inventory_item',
                entity_id: record.id,
                reference_code: record.item_code
              }
            : null;
        }
      };

      const loader = restoreMetaByModule[module];
      const meta = loader ? await loader() : null;
      if (meta) {
        await logActivity(req.session.user.id, 'RESTORE', cfg.module, meta.description, req.ip, {
          entity_type: meta.entity_type,
          entity_id: meta.entity_id,
          reference_code: meta.reference_code,
          field_name: 'archived',
          old_value: 'true',
          new_value: 'false'
        });
      } else {
        await logActivity(req.session.user.id, 'RESTORE', cfg.module, `Restored ${cfg.module} record #${id}`, req.ip);
      }

      if (module === 'user' && meta?.record) {
        const user = meta.record;
        await notifyAdministrators({
          title: 'User Restored',
          message: buildGovernanceNotificationMessage({
            action: 'User restored',
            subject: `${user.full_name} (${user.username})`
          }),
          type: 'user_restored',
          reference_id: user.id,
          link_url: usersLink(user.id)
        }, { excludeUserIds: [req.session.user.id] });
      }

      sendSuccess(res, null, 'The record has been restored successfully.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = ArchiveController;
