import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { logger, isValidObjectIdString } from '@lemefy/data-schemas';
import {
  generateCheckAccess,
  markPublicPromptGroups,
  buildPromptGroupFilter,
  formatPromptGroupsResponse,
  safeValidatePromptGroupUpdate,
  createEmptyPromptGroupsResponse,
  filterAccessibleIdsBySharedLogic,
} from '@lemefy/api';
import {
  Permissions,
  ResourceType,
  AccessRoleIds,
  PrincipalType,
  PermissionBits,
  PermissionTypes,
} from 'lemefy-data-provider';
import { SystemCapabilities } from '@lemefy/data-schemas';
import {
  getListPromptGroupsByAccess,
  getOwnedPromptGroupIds,
  incrementPromptGroupUsage,
  makePromptProduction,
  updatePromptGroup,
  deletePromptGroup,
  createPromptGroup,
  getPromptGroup,
  getRoleByName,
  deletePrompt,
  getPrompts,
  savePrompt,
  getPrompt,
} from '~/models';
import {
  canAccessPromptGroupResource,
  canAccessPromptViaGroup,
  promptUsageLimiter,
  requireJwtAuth,
} from '~/server/middleware';
import {
  findPubliclyAccessibleResources,
  getEffectivePermissions,
  findAccessibleResources,
  grantPermission,
} from '~/server/services/PermissionService';
import { hasCapability } from '~/server/middleware/roles/capabilities';

const router = Router();

const checkPromptAccess = generateCheckAccess({
  permissionType: PermissionTypes.PROMPTS,
  permissions: [Permissions.USE],
  getRoleByName: getRoleByName as any,
});
const checkPromptCreate = generateCheckAccess({
  permissionType: PermissionTypes.PROMPTS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName: getRoleByName as any,
});

router.use(requireJwtAuth);
router.use(checkPromptAccess);

const checkGlobalPromptShare = generateCheckAccess({
  permissionType: PermissionTypes.PROMPTS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName: getRoleByName as any,
});

router.get(
  '/groups/:groupId',
  canAccessPromptGroupResource({
    requiredPermission: PermissionBits.VIEW,
  }),
  async (req: any, res: any) => {
    const { groupId } = req.params;

    try {
      const group = await getPromptGroup({ _id: groupId });

      if (!group) {
        return res.status(404).send({ message: 'Prompt group not found' });
      }

      res.status(200).send(group);
    } catch (error) {
      logger.error('Error getting prompt group', error);
      res.status(500).send({ message: 'Error getting prompt group' });
    }
  },
);

router.get('/all', async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { name, category } = req.query;
    const { filter, searchShared, searchSharedOnly } = buildPromptGroupFilter({
      name,
      category,
    });

    let accessibleIds = await findAccessibleResources({
      userId,
      role: req.user.role,
      resourceType: ResourceType.PROMPTGROUP,
      requiredPermissions: PermissionBits.VIEW,
    });

    const [publiclyAccessibleIds, ownedPromptGroupIds] = await Promise.all([
      findPubliclyAccessibleResources({
        resourceType: ResourceType.PROMPTGROUP,
        requiredPermissions: PermissionBits.VIEW,
      }),
      getOwnedPromptGroupIds(userId),
    ]);

    const filteredAccessibleIds = await filterAccessibleIdsBySharedLogic({
      accessibleIds,
      searchShared,
      searchSharedOnly,
      publicPromptGroupIds: publiclyAccessibleIds,
      ownedPromptGroupIds,
    });

    const result = await getListPromptGroupsByAccess({
      accessibleIds: filteredAccessibleIds,
      otherParams: filter,
    });

    if (!result) {
      return res.status(200).send([]);
    }

    const { data: promptGroups = [] } = result;
    if (!promptGroups.length) {
      return res.status(200).send([]);
    }

    const groupsWithPublicFlag = markPublicPromptGroups(promptGroups, publiclyAccessibleIds);
    res.status(200).send(groupsWithPublicFlag);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: 'Error getting prompt groups' });
  }
});

router.get('/groups', async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { pageSize, limit, cursor, name, category } = req.query;

    const { filter, searchShared, searchSharedOnly } = buildPromptGroupFilter({
      name,
      category,
    });

    let actualLimit = limit;
    let actualCursor = cursor;

    if (pageSize && !limit) {
      actualLimit = parseInt(pageSize as string, 10);
    }

    if (
      actualCursor &&
      (actualCursor === 'undefined' || actualCursor === 'null' || (actualCursor as string).length === 0)
    ) {
      actualCursor = null;
    }

    let accessibleIds = await findAccessibleResources({
      userId,
      role: req.user.role,
      resourceType: ResourceType.PROMPTGROUP,
      requiredPermissions: PermissionBits.VIEW,
    });

    const [publiclyAccessibleIds, ownedPromptGroupIds] = await Promise.all([
      findPubliclyAccessibleResources({
        resourceType: ResourceType.PROMPTGROUP,
        requiredPermissions: PermissionBits.VIEW,
      }),
      getOwnedPromptGroupIds(userId),
    ]);

    const filteredAccessibleIds = await filterAccessibleIdsBySharedLogic({
      accessibleIds,
      searchShared,
      searchSharedOnly,
      publicPromptGroupIds: publiclyAccessibleIds,
      ownedPromptGroupIds,
    });

    const result = await getListPromptGroupsByAccess({
      accessibleIds: filteredAccessibleIds,
      otherParams: filter,
      limit: actualLimit ? parseInt(actualLimit as string, 10) : undefined,
      after: actualCursor as string | undefined,
    });

    if (!result) {
      const emptyResponse = createEmptyPromptGroupsResponse({
        pageNumber: '1',
        pageSize: actualLimit,
        actualLimit,
      });
      return res.status(200).send(emptyResponse);
    }

    const { data: promptGroups = [], has_more = false, after = null } = result;
    const groupsWithPublicFlag = markPublicPromptGroups(promptGroups, publiclyAccessibleIds);

    const response = formatPromptGroupsResponse({
      promptGroups: groupsWithPublicFlag,
      pageNumber: '1',
      pageSize: (actualLimit || 25).toString(),
      hasMore: has_more,
      after,
    });

    res.status(200).send(response);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: 'Error getting prompt groups' });
  }
});

const createNewPromptGroup = async (req: any, res: any) => {
  try {
    const { prompt, group } = req.body;

    if (!prompt || !group || !group.name) {
      return res.status(400).send({ error: 'Prompt and group name are required' });
    }

    const saveData = {
      prompt,
      group,
      author: req.user.id,
      authorName: req.user.name,
    };

    const result = await createPromptGroup(saveData);

    if (result.prompt && result.prompt._id && result.prompt.groupId) {
      try {
        await grantPermission({
          principalType: PrincipalType.USER,
          principalId: req.user.id,
          resourceType: ResourceType.PROMPTGROUP,
          resourceId: result.prompt.groupId,
          accessRoleId: AccessRoleIds.PROMPTGROUP_OWNER,
          grantedBy: req.user.id,
        });
        logger.debug(
          `[createPromptGroup] Granted owner permissions to user ${req.user.id} for promptGroup ${result.prompt.groupId}`,
        );
      } catch (permissionError) {
        logger.error(
          `[createPromptGroup] Failed to grant owner permissions for promptGroup ${result.prompt.groupId}:`,
          permissionError,
        );
      }
    }

    res.status(200).send(result);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: 'Error creating prompt group' });
  }
};

// Create new prompt group (requires CREATE permission)
router.post('/', checkPromptCreate, createNewPromptGroup);

const addPromptToGroup = async (req: any, res: any) => {
  try {
    const { groupId } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).send({ error: 'Prompt is required' });
    }

    if (typeof prompt.prompt !== 'string' || !prompt.prompt.trim()) {
      return res
        .status(400)
        .send({ error: 'Prompt text is required and must be a non-empty string' });
    }

    if (prompt.type !== 'text' && prompt.type !== 'chat') {
      return res.status(400).send({ error: 'Prompt type must be "text" or "chat"' });
    }

    prompt.groupId = groupId;

    const saveData = {
      prompt,
      author: req.user.id,
      authorName: req.user.name,
    };

    const result = await savePrompt(saveData);
    res.status(200).send(result);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: 'Error adding prompt to group' });
  }
};

router.post(
  '/groups/:groupId/prompts',
  checkPromptAccess,
  canAccessPromptGroupResource({
    requiredPermission: PermissionBits.EDIT,
  }),
  addPromptToGroup,
);

router.post(
  '/groups/:groupId/use',
  promptUsageLimiter,
  canAccessPromptGroupResource({
    requiredPermission: PermissionBits.VIEW,
  }),
  async (req: any, res: any) => {
    try {
      const { groupId } = req.params;
      if (!isValidObjectIdString(groupId)) {
        return res.status(400).send({ error: 'Invalid groupId' });
      }
      const result = await incrementPromptGroupUsage(groupId);
      res.status(200).send(result);
    } catch (error) {
      logger.error('[recordPromptUsage]', error);
      if (error.message === 'Invalid groupId') {
        return res.status(400).send({ error: 'Invalid groupId' });
      }
      if (error.message === 'Prompt group not found') {
        return res.status(404).send({ error: 'Prompt group not found' });
      }
      res.status(500).send({ error: 'Error recording prompt usage' });
    }
  },
);

const patchPromptGroup = async (req: any, res: any) => {
  try {
    const { groupId } = req.params;
    const filter = { _id: groupId };

    const validationResult = safeValidatePromptGroupUpdate(req.body);
    if (!validationResult.success) {
      return res.status(400).send({
        error: 'Invalid request body',
        details: validationResult.error.errors,
      });
    }

    const promptGroup = await updatePromptGroup(filter, validationResult.data);
    res.status(200).send(promptGroup);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: 'Error updating prompt group' });
  }
};

router.patch(
  '/groups/:groupId',
  checkGlobalPromptShare,
  canAccessPromptGroupResource({
    requiredPermission: PermissionBits.EDIT,
  }),
  patchPromptGroup,
);

router.patch(
  '/:promptId/tags/production',
  checkPromptCreate,
  canAccessPromptViaGroup({
    requiredPermission: PermissionBits.EDIT,
    resourceIdParam: 'promptId',
  }),
  async (req: any, res: any) => {
    try {
      const { promptId } = req.params;
      const result = await makePromptProduction(promptId);
      res.status(200).send(result);
    } catch (error) {
      logger.error(error);
      res.status(500).send({ error: 'Error updating prompt production' });
    }
  },
);

router.get(
  '/:promptId',
  canAccessPromptViaGroup({
    requiredPermission: PermissionBits.VIEW,
    resourceIdParam: 'promptId',
  }),
  async (req: any, res: any) => {
    const { promptId } = req.params;
    const prompt = await getPrompt({ _id: promptId });
    res.status(200).send(prompt);
  },
);

router.get('/', async (req: any, res: any) => {
  try {
    const author = req.user.id;
    const { groupId } = req.query;

    if (groupId) {
      if (!isValidObjectIdString(groupId as string)) {
        return res.status(400).send({ error: 'Invalid groupId' });
      }

      const permissions = await getEffectivePermissions({
        userId: req.user.id,
        role: req.user.role,
        resourceType: ResourceType.PROMPTGROUP,
        resourceId: groupId as string,
      });

      if (!(permissions & PermissionBits.VIEW)) {
        return res
          .status(403)
          .send({ error: 'Insufficient permissions to view prompts in this group' });
      }

      const prompts = await getPrompts({ groupId: new ObjectId(groupId as string) });
      return res.status(200).send(prompts);
    }

    const query: any = { author };
    let canReadPrompts = false;
    try {
      canReadPrompts = await hasCapability(req.user, SystemCapabilities.READ_PROMPTS);
    } catch (err) {
      logger.warn(`[GET /prompts] capability check failed, denying bypass: ${(err as Error).message}`);
    }
    if (canReadPrompts) {
      logger.debug(`[GET /prompts] READ_PROMPTS bypass for user ${req.user.id}`);
      delete query.author;
    }
    const prompts = await getPrompts(query);
    res.status(200).send(prompts);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: 'Error getting prompts' });
  }
});

const deletePromptController = async (req: any, res: any) => {
  try {
    const { promptId } = req.params;
    const { groupId } = req.query;
    if (!groupId || !isValidObjectIdString(groupId as string)) {
      return res.status(400).send({ error: 'Invalid or missing groupId' });
    }
    const query = { promptId, groupId: groupId as string };
    const result = await deletePrompt(query);
    res.status(200).send(result);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: 'Error deleting prompt' });
  }
};

const deletePromptGroupController = async (req: any, res: any) => {
  try {
    const { groupId: _id } = req.params;
    const message = await deletePromptGroup({ _id });
    res.send(message);
  } catch (error) {
    logger.error('Error deleting prompt group', error);
    res.status(500).send({ message: 'Error deleting prompt group' });
  }
};

router.delete(
  '/:promptId',
  checkPromptCreate,
  canAccessPromptViaGroup({
    requiredPermission: PermissionBits.DELETE,
    resourceIdParam: 'promptId',
  }),
  deletePromptController,
);
router.delete(
  '/groups/:groupId',
  checkPromptCreate,
  canAccessPromptGroupResource({
    requiredPermission: PermissionBits.DELETE,
  }),
  deletePromptGroupController,
);

export default router;
