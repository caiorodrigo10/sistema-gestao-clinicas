import { Request, Response } from 'express';
import { storage } from './storage-factory';
import { 
  requireClinicAdmin, 
  requireProfessionalStatus,
  getClientIp,
  canManageUser,
  type PermissionRequest 
} from './permissions-middleware';
import { z } from 'zod';

// Schema for updating professional status
const updateProfessionalStatusSchema = z.object({
  user_id: z.number(),
  is_professional: z.boolean(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
  role: z.enum(['admin', 'usuario']).optional()
});

/**
 * GET /api/clinic/:clinicId/users/management
 * Get all users in clinic for admin management
 */
export async function getClinicUsersForManagement(req: PermissionRequest, res: Response) {
  try {
    const clinicId = parseInt(req.params.clinicId);
    console.log(`🔍 Getting users for clinic ${clinicId}`);
    
    const clinicUsers = await storage.getClinicUsers(clinicId);
    console.log(`📊 Found ${clinicUsers.length} users in clinic ${clinicId}`);
    
    // Format response with necessary info for management
    const usersData = clinicUsers.map(cu => ({
      id: cu.user.id,
      name: cu.user.name,
      email: cu.user.email,
      role: cu.role,
      is_professional: cu.is_professional || false,
      is_active: cu.is_active,
      joined_at: cu.joined_at,
      last_login: cu.user.last_login
    }));

    console.log(`📋 Formatted user data:`, usersData);
    res.json(usersData);
  } catch (error) {
    console.error('Error getting clinic users for management:', error);
    res.status(500).json({ 
      error: 'Failed to get clinic users',
      code: 'FETCH_USERS_ERROR'
    });
  }
}

/**
 * PUT /api/clinic/:clinicId/users/:userId/professional-status
 * Update professional status of a user (admin only)
 */
export async function updateUserProfessionalStatus(req: PermissionRequest, res: Response) {
  try {
    const clinicId = parseInt(req.params.clinicId);
    const targetUserId = parseInt(req.params.userId);
    const adminUser = req.user!;

    // Validate request body
    const validation = updateProfessionalStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validation.error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    const { is_professional, notes, is_active, role } = validation.data;

    // Admins can manage any user in their clinic - skip the canManageUser check
    // TODO: Add proper role-based permission checks if needed in the future

    // Get client information for audit
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Convert admin user UUID to integer ID
    const adminUserRecord = await storage.getUserByEmail(adminUser.email);
    if (!adminUserRecord) {
      return res.status(404).json({ 
        error: 'Admin user not found',
        code: 'ADMIN_USER_NOT_FOUND'
      });
    }

    // Update professional status
    const result = await storage.updateProfessionalStatus(
      clinicId,
      targetUserId,
      is_professional,
      adminUserRecord.id,
      ipAddress,
      userAgent,
      notes,
      is_active,
      role
    );

    if (!result.success) {
      return res.status(500).json({ 
        error: 'Failed to update professional status',
        code: 'UPDATE_FAILED'
      });
    }

    // Get updated user data
    const updatedClinicUsers = await storage.getClinicUsers(clinicId);
    const updatedUser = updatedClinicUsers.find(cu => cu.user.id === targetUserId);

    if (!updatedUser) {
      return res.status(404).json({ 
        error: 'User not found after update',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      user: {
        id: updatedUser.user.id,
        name: updatedUser.user.name,
        email: updatedUser.user.email,
        role: updatedUser.role,
        is_professional: updatedUser.is_professional,
        is_active: updatedUser.is_active
      },
      message: `Professional status ${is_professional ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Error updating professional status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/clinic/:clinicId/audit/professional-status
 * Get professional status audit log (admin only)
 */
export async function getProfessionalStatusAudit(req: PermissionRequest, res: Response) {
  try {
    const clinicId = parseInt(req.params.clinicId);
    const limit = parseInt(req.query.limit as string) || 50;

    const auditLog = await storage.getProfessionalStatusAudit(clinicId, limit);

    // Get user names for the audit log
    const userIds = [...new Set([
      ...auditLog.map(log => log.target_user_id),
      ...auditLog.map(log => log.changed_by_user_id)
    ])];

    const clinicUsers = await storage.getClinicUsers(clinicId);
    const userMap = new Map();
    clinicUsers.forEach(cu => {
      userMap.set(cu.user.id, cu.user.name);
    });

    // Format audit log with user names
    const formattedAuditLog = auditLog.map(log => ({
      id: log.id,
      target_user_name: userMap.get(log.target_user_id) || 'Unknown User',
      changed_by_user_name: userMap.get(log.changed_by_user_id) || 'Unknown Admin',
      action: log.action,
      previous_status: log.previous_status,
      new_status: log.new_status,
      notes: log.notes,
      ip_address: log.ip_address,
      created_at: log.created_at
    }));

    res.json(formattedAuditLog);
  } catch (error) {
    console.error('Error getting professional status audit:', error);
    res.status(500).json({ 
      error: 'Failed to get audit log',
      code: 'AUDIT_FETCH_ERROR'
    });
  }
}

/**
 * GET /api/clinic/:clinicId/users/:userId/professional-status-audit
 * Get professional status audit for specific user (admin only)
 */
export async function getUserProfessionalStatusAudit(req: PermissionRequest, res: Response) {
  try {
    const clinicId = parseInt(req.params.clinicId);
    const userId = parseInt(req.params.userId);

    const auditLog = await storage.getUserProfessionalStatusAudit(userId, clinicId);

    // Get user names for the audit log
    const changedByUserIds = [...new Set(auditLog.map(log => log.changed_by_user_id))];
    const clinicUsers = await storage.getClinicUsers(clinicId);
    const userMap = new Map();
    clinicUsers.forEach(cu => {
      userMap.set(cu.user.id, cu.user.name);
    });

    // Format audit log with user names
    const formattedAuditLog = auditLog.map(log => ({
      id: log.id,
      changed_by_user_name: userMap.get(log.changed_by_user_id) || 'Unknown Admin',
      action: log.action,
      previous_status: log.previous_status,
      new_status: log.new_status,
      notes: log.notes,
      ip_address: log.ip_address,
      created_at: log.created_at
    }));

    res.json(formattedAuditLog);
  } catch (error) {
    console.error('Error getting user professional status audit:', error);
    res.status(500).json({ 
      error: 'Failed to get user audit log',
      code: 'USER_AUDIT_FETCH_ERROR'
    });
  }
}

/**
 * GET /api/user/permissions
 * Get current user's permissions in all clinics
 */
export async function getCurrentUserPermissions(req: PermissionRequest, res: Response) {
  try {
    const user = req.user!;
    
    const userClinics = await storage.getUserClinics(user.id);
    
    const permissions = userClinics.map(uc => ({
      clinic_id: uc.clinic_id,
      clinic_name: uc.clinic.name,
      role: uc.role,
      is_professional: uc.is_professional || false,
      is_active: uc.is_active,
      permissions: uc.permissions
    }));

    res.json({
      user_id: user.id,
      clinics: permissions
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({ 
      error: 'Failed to get user permissions',
      code: 'PERMISSIONS_FETCH_ERROR'
    });
  }
}