import mongoose from 'mongoose';
import { Router } from 'express';
import {
  AccessRoleIds,
  PrincipalType,
  ResourceType,
  PermissionBits,
} from 'lemefy-data-provider';
import {
  getUserEffectivePermissions,
  getAllEffectivePermissions,
  updateResourcePermissions,
  getResourcePermissions,
  getResourceRoles,
  searchPrincipals,
} from '~/server/controllers/PermissionsController';
import {
  checkShareAccess,
  checkSharePublicAccess,
} from '~/server/middleware/checkSharePublicAccess';
import { requireJwtAuth, checkBan, uaParser, canAccessResource } from '~/server/middleware';
import { checkPeoplePickerAccess } from '~/server/middleware/checkPeoplePickerAccess';
import { findMCPServerByObjectId, getSkillById } from '~/models';

const router = Router();

router.use(requireJwtAuth);
router.use(checkBan);
router.use(uaParser);

router.get('/search-principals', checkPeoplePickerAccess, searchPrincipals);

router.get('/:resourceType/roles', getResourceRoles);

const checkResourcePermissionAccess = (requiredPermission) => (req: any, res: any, next: any) => {
  const { resourceType } = req.params;
  let middleware;

  if (resourceType === ResourceType.AGENT) {
    middleware = canAccessResource({
      resourceType: ResourceType.AGENT,
      requiredPermission,
      resourceIdParam: 'resourceId',
    });
  } else if (resourceType === ResourceType.REMOTE_AGENT) {
    middleware = canAccessResource({
      resourceType: ResourceType.REMOTE_AGENT,
      requiredPermission,
      resourceIdParam: 'resourceId',
    });
  } else if (resourceType === ResourceType.PROMPTGROUP) {
    middleware = canAccessResource({
      resourceType: ResourceType.PROMPTGROUP,
      requiredPermission,
      resourceIdParam: 'resourceId',
    });
  } else if (resourceType === ResourceType.MCPSERVER) {
    middleware = canAccessResource({
      resourceType: ResourceType.MCPSERVER,
      requiredPermission,
      resourceIdParam: 'resourceId',
      idResolver: findMCPServerByObjectId,
    });
  } else if (resourceType === ResourceType.SKILL) {
    middleware = canAccessResource({
      resourceType: ResourceType.SKILL,
      requiredPermission,
      resourceIdParam: 'resourceId',
      idResolver: getSkillById,
    });
  } else if (resourceType === ResourceType.SHARED_LINK) {
    middleware = canAccessResource({
      resourceType: ResourceType.SHARED_LINK,
      requiredPermission,
      resourceIdParam: 'resourceId',
    });
  } else {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Unsupported resource type: ${resourceType}`,
    });
  }

  middleware(req, res, next);
};

const rejectSharedLinkOwnerPermissionChanges = async (req: any, res: any, next: any) => {
  if (req.params.resourceType !== ResourceType.SHARED_LINK) {
    return next();
  }

  const updated = Array.isArray(req.body?.updated) ? req.body.updated : [];
  const removed = Array.isArray(req.body?.removed) ? req.body.removed : [];
  const grantsOwner = updated.some(
    (principal) => principal?.accessRoleId === AccessRoleIds.SHARED_LINK_OWNER,
  );
  const grantsPublicOwner = req.body?.publicAccessRoleId === AccessRoleIds.SHARED_LINK_OWNER;

  if (grantsOwner || grantsPublicOwner) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Shared link owner permissions cannot be changed',
    });
  }

  const userMutations = [...updated, ...removed].filter(
    (principal) => principal?.type === PrincipalType.USER && principal?.id,
  );

  if (userMutations.length === 0) {
    return next();
  }

  try {
    const SharedLink = mongoose.models.SharedLink;
    const link = await SharedLink.findById(req.params.resourceId, 'user').lean();
    const ownerId = link?.user?.toString();
    const touchesOwner = ownerId
      ? userMutations.some((principal) => principal.id?.toString() === ownerId)
      : false;

    if (touchesOwner) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Shared link owner permissions cannot be changed',
      });
    }
  } catch (_error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate shared link owner permissions',
    });
  }

  return next();
};

router.get(
  '/:resourceType/:resourceId',
  checkResourcePermissionAccess(PermissionBits.SHARE),
  getResourcePermissions,
);

router.put(
  '/:resourceType/:resourceId',
  checkResourcePermissionAccess(PermissionBits.SHARE),
  checkShareAccess,
  checkSharePublicAccess,
  rejectSharedLinkOwnerPermissionChanges,
  updateResourcePermissions,
);

router.get('/:resourceType/effective/all', getAllEffectivePermissions);

router.get('/:resourceType/:resourceId/effective', getUserEffectivePermissions);

export default router;
