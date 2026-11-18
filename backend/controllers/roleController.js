import Role from '../models/Role.js';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '../utils/permissions.js';

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (SUPER_ADMIN, or PERMISSION_MANAGE)
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single role
// @route   GET /api/roles/:id
// @access  Private
export const getRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new role (custom role)
// @route   POST /api/roles
// @access  Private (SUPER_ADMIN only)
export const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const exists = await Role.findOne({ name: name.toUpperCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Role already exists' });
    }

    const role = await Role.create({
      name: name.toUpperCase(),
      description,
      permissions: permissions || [],
      isSystem: false,
    });

    res.status(201).json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update role permissions
// @route   PUT /api/roles/:id
// @access  Private (SUPER_ADMIN only)
export const updateRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Prevent changing system role name
    if (role.isSystem && req.body.name && req.body.name !== role.name) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change name of system role',
      });
    }

    role.description = req.body.description ?? role.description;
    role.permissions = req.body.permissions ?? role.permissions;

    await role.save();

    res.status(200).json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete role (only non-system)
// @route   DELETE /api/roles/:id
// @access  Private (SUPER_ADMIN only)
export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.isSystem) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete system role',
      });
    }

    await role.deleteOne();
    res.status(200).json({ success: true, message: 'Role deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all available permissions list
// @route   GET /api/roles/permissions/list
// @access  Private (SUPER_ADMIN)
export const getAllPermissions = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: ALL_PERMISSIONS,
      roleDefaults: ROLE_PERMISSIONS,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
