const pool = require('../config/database');

const ComponentModel = {
  async getByParent(parentAssetId) {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS replaced_by_name, ni.item_name AS new_item_name
       FROM component_replacements c
       JOIN users u ON c.replaced_by = u.id
       LEFT JOIN inventory_items ni ON c.new_inventory_item_id = ni.id
       WHERE c.parent_asset_id = ?
       ORDER BY c.replacement_date DESC`,
      [parentAssetId]
    );
    return rows;
  },

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO component_replacements
       (parent_asset_id, old_component_name, new_inventory_item_id, new_component_name, replaced_by, replacement_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.parent_asset_id,
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

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS replaced_by_name, ni.item_name AS new_item_name,
              p.item_code AS parent_item_code, p.item_name AS parent_asset_name
       FROM component_replacements c
       JOIN users u ON c.replaced_by = u.id
       JOIN inventory_items p ON c.parent_asset_id = p.id
       LEFT JOIN inventory_items ni ON c.new_inventory_item_id = ni.id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async getAll() {
    const [rows] = await pool.query(
      `SELECT c.*, p.item_name AS parent_asset_name, u.full_name AS replaced_by_name
       FROM component_replacements c
       JOIN inventory_items p ON c.parent_asset_id = p.id
       JOIN users u ON c.replaced_by = u.id
       ORDER BY c.replacement_date DESC`
    );
    return rows;
  }
};

module.exports = ComponentModel;
