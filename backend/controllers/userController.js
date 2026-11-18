import User from '../models/User.js';
import { ROLE_PERMISSIONS, getEffectivePermissions } from '../utils/permissions.js';

// @desc    Get all users (with filter by role)
// @route   GET /api/users
// @access  Private (SUPER_ADMIN or USER_VIEW)
export const getUsers = async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      const { escapeRegExp } = await import('../utils/safeRegex.js');
      const rx = { $regex: escapeRegExp(search), $options: 'i' };
      query.$or = [
        { name: rx },
        { email: rx },
        { phone: rx },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: users,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Add effective permissions
    const effectivePermissions = getEffectivePermissions(user);

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        effectivePermissions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create staff user (Sub Admin, Managers etc.)
// @route   POST /api/users/staff
// @access  Private (SUPER_ADMIN only)
export const createStaff = async (req, res) => {
  try {
    const { name, email, phone, password, role, permissions } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, password and role are required',
      });
    }

    // Cannot create another SUPER_ADMIN easily (optional security)
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can create Super Admin',
      });
    }

    // Only allow staff roles
    const allowedRoles = [
      'SUB_ADMIN',
      'ORDER_MANAGER',
      'INVENTORY_MANAGER',
      'DELIVERY_MANAGER',
      'DELIVERY_RIDER',
      'ACCOUNTANT',
      'SUPER_ADMIN',
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff role',
      });
    }

    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone already exists',
      });
    }

    // For SUB_ADMIN → use provided permissions
    // For other roles → use default ROLE_PERMISSIONS
    let finalPermissions = [];
    if (role === 'SUB_ADMIN') {
      finalPermissions = permissions || [];
    } else if (ROLE_PERMISSIONS[role]) {
      finalPermissions = ROLE_PERMISSIONS[role];
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role,
      permissions: finalPermissions,
      isActive: true,
    });

    user.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user (role, permissions, status)
// @route   PUT /api/users/:id
// @access  Private (SUPER_ADMIN)
export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent updating own role/status accidentally
    if (user._id.toString() === req.user.id && req.body.role) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role',
      });
    }

    const { name, email, phone, role, permissions, isActive } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    if (role) {
      user.role = role;

      // Reset permissions based on new role
      if (role === 'SUB_ADMIN') {
        user.permissions = permissions || user.permissions || [];
      } else if (ROLE_PERMISSIONS[role]) {
        user.permissions = ROLE_PERMISSIONS[role];
      }
    } else if (permissions && user.role === 'SUB_ADMIN') {
      // Only SUB_ADMIN can have custom permissions updated
      user.permissions = permissions;
    }

    await user.save();

    user.password = undefined;

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update only permissions of a Sub Admin
// @route   PUT /api/users/:id/permissions
// @access  Private (SUPER_ADMIN)
export const updateUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'SUB_ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Custom permissions can only be set for SUB_ADMIN',
      });
    }

    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions must be an array',
      });
    }

    user.permissions = permissions;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Permissions updated',
      data: {
        id: user._id,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Enable / Disable user
// @route   PATCH /api/users/:id/status
// @access  Private (SUPER_ADMIN)
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot disable yourself',
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        id: user._id,
        name: user.name,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete user (soft delete preferred, but hard for now)
// @route   DELETE /api/users/:id
// @access  Private (SUPER_ADMIN)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'SUPER_ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete Super Admin',
      });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete yourself',
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
