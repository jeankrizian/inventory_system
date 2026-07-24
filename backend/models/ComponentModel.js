const pool = require('../config/database');

const ComponentModel = {
  async getActiveByParent(parentAssetId) {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS created_by_name,
              i.property_tag AS component_property_tag,
              i.status AS inventory_status,
              i.asset_classification AS inventory_classification,
              i.item_name AS inventory_item_name,
              i.created_at AS inventory_created_at
       FROM asset_components c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN inventory_items i ON c.inventory_item_id = i.id
       WHERE c.parent_asset_id = ? AND c.status = 'Active'
       ORDER BY c.component_name ASC, c.id ASC`,
      [parentAssetId]
    );
    return rows || [];
  },

  async getAllByParent(parentAssetId) {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS created_by_name,
              i.property_tag AS component_property_tag,
              i.status AS inventory_status,
              i.asset_classification AS inventory_classification
       FROM asset_components c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN inventory_items i ON c.inventory_item_id = i.id
       WHERE c.parent_asset_id = ?
       ORDER BY FIELD(c.status, 'Active', 'Replaced'), c.component_name ASC, c.id DESC`,
      [parentAssetId]
    );
    return rows || [];
  },

  async countActiveByParent(parentAssetId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM asset_components
       WHERE parent_asset_id = ? AND status = 'Active'`,
      [parentAssetId]
    );
    return Number(rows[0]?.cnt || 0);
  },

  async getHistoryByParent(parentAssetId) {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS replaced_by_name
       FROM component_replacements c
       JOIN users u ON c.replaced_by = u.id
       WHERE c.parent_asset_id = ?
       ORDER BY c.replacement_date DESC, c.id DESC`,
      [parentAssetId]
    );
    return rows || [];
  },

  async findComponentById(id) {
    const [rows] = await pool.query(
      `SELECT c.*, p.item_code AS parent_item_code, p.item_name AS parent_asset_name,
              p.property_tag AS parent_property_tag, p.asset_classification AS parent_classification,
              i.property_tag AS component_property_tag, i.status AS inventory_status
       FROM asset_components c
       JOIN inventory_items p ON c.parent_asset_id = p.id
       LEFT JOIN inventory_items i ON c.inventory_item_id = i.id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async createComponent(data, conn = pool) {
    const [result] = await conn.query(
      `INSERT INTO asset_components
       (parent_asset_id, inventory_item_id, component_name, brand, model, serial_number, date_installed,
        \`condition\`, status, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
      [
        data.parent_asset_id,
        data.inventory_item_id || null,
        data.component_name,
        data.brand || null,
        data.model || null,
        data.serial_number || null,
        data.date_installed || null,
        data.condition || null,
        data.remarks || null,
        data.created_by || null
      ]
    );
    return result.insertId;
  },

  /**
   * Update editable component detail fields only.
   * Does not change parent_asset_id, inventory_item_id, status, or created_by.
   */
  async updateDetails(id, data, conn = pool) {
    const [result] = await conn.query(
      `UPDATE asset_components
       SET component_name = ?,
           brand = ?,
           model = ?,
           serial_number = ?,
           remarks = ?
       WHERE id = ? AND status = 'Active'`,
      [
        data.component_name,
        data.brand || null,
        data.model || null,
        data.serial_number || null,
        data.remarks || null,
        id
      ]
    );
    return result.affectedRows > 0;
  },

  async markReplaced(id, conn = pool) {
    const [result] = await conn.query(
      `UPDATE asset_components SET status = 'Replaced' WHERE id = ? AND status = 'Active'`,
      [id]
    );
    return result.affectedRows > 0;
  },

  async detachInventoryItem(inventoryItemId, conn = pool) {
    if (!inventoryItemId) return;
    await conn.query(
      'UPDATE inventory_items SET parent_asset_id = NULL WHERE id = ?',
      [inventoryItemId]
    );
  },

  async createReplacementHistory(data, conn = pool) {
    const [result] = await conn.query(
      `INSERT INTO component_replacements
       (parent_asset_id, old_component_id, new_component_id, old_component_name,
        new_inventory_item_id, new_component_name, replaced_by, replacement_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.parent_asset_id,
        data.old_component_id || null,
        data.new_component_id || null,
        data.old_component_name,
        data.new_inventory_item_id || null,
        data.new_component_name || null,
        data.replaced_by,
        data.replacement_date,
        data.notes || null
      ]
    );
    return result.insertId;
  },

  async findReplacementById(id) {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS replaced_by_name,
              p.item_code AS parent_item_code, p.item_name AS parent_asset_name
       FROM component_replacements c
       JOIN users u ON c.replaced_by = u.id
       JOIN inventory_items p ON c.parent_asset_id = p.id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /** @deprecated Legacy list of all replacement history */
  async getByParent(parentAssetId) {
    return this.getHistoryByParent(parentAssetId);
  },

  async getAll() {
    const [rows] = await pool.query(
      `SELECT c.*, p.item_name AS parent_asset_name, u.full_name AS replaced_by_name
       FROM component_replacements c
       JOIN inventory_items p ON c.parent_asset_id = p.id
       JOIN users u ON c.replaced_by = u.id
       ORDER BY c.replacement_date DESC`
    );
    return rows || [];
  },

  async create(data) {
    return this.createReplacementHistory(data);
  },

  async findById(id) {
    return this.findReplacementById(id);
  }
};

module.exports = ComponentModel;
