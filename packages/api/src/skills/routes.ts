import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Router } from 'express';
import {
  createSkillsHandlers,
  createImportHandler,
  generateCheckAccess,
  getStorageMetadata,
  resolveRequestTenantId,
  restoreTenantContextFromReq,
} from '@lemefy/api';
import { isValidObjectIdString, logger } from '@lemefy/data-schemas';
import {
  PermissionBits,
  PermissionTypes,
  Permissions,
  FileContext,
  mergeFileConfig,
} from 'lemefy-data-provider';
import {
  createSkill,
  getSkillById,
  updateSkill,
  deleteSkill,
  upsertSkillFile,
  deleteSkillFile,
  getSkillFileByPath,
  getRoleByName,
} from '~/models';
import { requireJwtAuth, canAccessSkillResource } from '~/server/middleware';
import {
  findAccessibleResources,
  findPubliclyAccessibleResources,
  hasPublicPermission,
  grantPermission,
} from '~/server/services/PermissionService';
import { getStrategyFunctions } from '~/server/services/Files/strategies';
import { createFileLimiters } from '~/server/middleware/limiters/uploadLimiters';
import { maybeRunGitHubSkillSyncForRequest } from '~/server/services/Skills/sync';
import configMiddleware from '~/server/middleware/config/app';
import { getFileStrategy } from '~/server/utils/getFileStrategy';
import {
  getSkillDbMethods,
  withDeploymentSkillIds,
  getSkillStrategyFunctions,
} from '~/server/services/Endpoints/agents/skillDeps';

const router = Router();

const ALLOWED_EXTENSIONS = new Set(['.md', '.zip', '.skill']);
const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50 MB

const memoryStorage = multer.memoryStorage();

function getSkillImportSizeLimit(req: any) {
  const fileConfig = mergeFileConfig(req.config?.fileConfig);
  return fileConfig.skills?.fileSizeLimit ?? MAX_IMPORT_SIZE;
}

const skillImportFilter = (_req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .md, .zip, and .skill files are allowed'), false);
  }
};

const skillUpload = (req: any, res: any, next: any) =>
  multer({
    storage: memoryStorage,
    fileFilter: skillImportFilter,
    limits: { fileSize: getSkillImportSizeLimit(req) },
  }).single('file')(req, res, next);

const MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const singleFileUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_SINGLE_FILE_SIZE },
});

const checkSkillAccess = generateCheckAccess({
  permissionType: PermissionTypes.SKILLS,
  permissions: [Permissions.USE],
  getRoleByName: getRoleByName as any,
});
const checkSkillCreate = generateCheckAccess({
  permissionType: PermissionTypes.SKILLS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName: getRoleByName as any,
});

const { fileUploadIpLimiter, fileUploadUserLimiter } = createFileLimiters();
const skillDbMethods = getSkillDbMethods();

router.use(requireJwtAuth);
router.use(configMiddleware);
router.use(checkSkillAccess);

const handlers = createSkillsHandlers({
  createSkill,
  getSkillById: skillDbMethods.getSkillById,
  listSkillsByAccess: skillDbMethods.listSkillsByAccess,
  updateSkill,
  deleteSkill,
  listSkillFiles: skillDbMethods.listSkillFiles,
  deleteSkillFile,
  getSkillFileByPath: skillDbMethods.getSkillFileByPath,
  updateSkillFileContent: skillDbMethods.updateSkillFileContent,
  getStrategyFunctions: getSkillStrategyFunctions,
  findAccessibleResources: async (params: any) =>
    params.resourceType === 'skill' && params.requiredPermissions === PermissionBits.VIEW
      ? withDeploymentSkillIds(await findAccessibleResources(params))
      : findAccessibleResources(params),
  findPubliclyAccessibleResources: async (params: any) =>
    params.resourceType === 'skill' && params.requiredPermissions === PermissionBits.VIEW
      ? withDeploymentSkillIds(await findPubliclyAccessibleResources(params))
      : findPubliclyAccessibleResources(params),
  hasPublicPermission: async (params: any) =>
    params.resourceType === 'skill' && params.requiredPermissions === PermissionBits.VIEW
      ? withDeploymentSkillIds([]).some((id) => id.toString() === params.resourceId.toString()) ||
        hasPublicPermission(params)
      : hasPublicPermission(params),
  grantPermission,
  isValidObjectIdString,
});

function resolveSkillStorage(req: any, { isImage = false } = {}) {
  const source = getFileStrategy(req.config, { context: FileContext.skill_file, isImage });
  const strategy = getStrategyFunctions(source);
  if (!strategy.saveBuffer) {
    throw new Error(`Storage backend "${source}" does not support file writes`);
  }
  return { saveBuffer: strategy.saveBuffer, source };
}

const importHandler = createImportHandler({
  limits: (req) => ({
    maxZipBytes: getSkillImportSizeLimit(req),
  }),
  createSkill,
  getSkillById,
  deleteSkill,
  upsertSkillFile,
  saveBuffer: (req, { userId, buffer, fileName, basePath, isImage, tenantId }) => {
    const requestTenantId = tenantId ?? resolveRequestTenantId(req);
    const storage = resolveSkillStorage(req, { isImage });
    return storage
      .saveBuffer({ userId, buffer, fileName, basePath, tenantId: requestTenantId })
      .then((filepath) => ({
        filepath,
        source: storage.source,
        ...getStorageMetadata({ filepath, source: storage.source }),
      }));
  },
  deleteFile: (req, file) => {
    const { deleteFile } = getStrategyFunctions(file.source);
    if (deleteFile) {
      return deleteFile(req, file);
    }
    return Promise.resolve();
  },
  grantPermission,
});

async function uploadFileHandler(req: any, res: any) {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const skillId = req.params.id;
    const relativePath = req.body.relativePath;
    if (!relativePath) {
      return res.status(400).json({ error: 'relativePath is required in form body' });
    }
    if (relativePath.toUpperCase() === 'SKILL.MD') {
      return res.status(400).json({ error: 'SKILL.md is reserved; update the skill body instead' });
    }
    if (
      !/^[a-zA-Z0-9._\-/]+$/.test(relativePath) ||
      /^\//.test(relativePath) ||
      relativePath.split('/').some((s) => s === '' || s === '.' || s === '..')
    ) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const tenantId = resolveRequestTenantId(req);
    const existingFile = await getSkillFileByPath(skillId, relativePath);

    const fileId = crypto.randomUUID();
    const filename = file.originalname;
    const storageFileName = `${fileId}__${filename}`;

    const isImage = (file.mimetype || '').startsWith('image/');
    const storage = resolveSkillStorage(req, { isImage });
    const filepath = await storage.saveBuffer({
      userId: req.user.id,
      buffer: file.buffer,
      fileName: storageFileName,
      basePath: 'uploads',
      tenantId,
    });
    const storageMetadata = getStorageMetadata({ filepath, source: storage.source });

    let result;
    try {
      result = await upsertSkillFile({
        skillId,
        relativePath,
        file_id: fileId,
        filename,
        filepath,
        ...storageMetadata,
        source: storage.source,
        mimeType: file.mimetype || 'application/octet-stream',
        bytes: file.size,
        isExecutable: false,
        author: req.user._id,
        tenantId,
      });
    } catch (dbError) {
      try {
        const { deleteFile } = getStrategyFunctions(storage.source);
        if (deleteFile) {
          await deleteFile(req, { filepath, user: req.user.id, tenantId });
        }
      } catch (cleanupErr) {
        logger.error('[uploadFile] Failed to clean up orphaned blob:', cleanupErr);
      }
      throw dbError;
    }

    if (existingFile && existingFile.filepath !== filepath) {
      const { deleteFile: delOld } = getStrategyFunctions(existingFile.source);
      if (delOld) {
        delOld(req, {
          filepath: existingFile.filepath,
          user: existingFile.author ?? req.user.id,
          tenantId: existingFile.tenantId ?? tenantId,
        }).catch((e: any) => logger.error('[uploadFile] Old blob cleanup failed:', e));
      }
    }

    return res.status(200).json(result);
  } catch (error: any) {
    if (error.code === 'SKILL_FILE_VALIDATION_FAILED') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('[uploadFile] Error:', error);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
}

async function maybeStartRequestSkillSync(_req: any, _res: any, next: any) {
  try {
    await maybeRunGitHubSkillSyncForRequest(_req);
  } catch (error) {
    logger.error('[GET /skills] Failed to start request-scoped skill sync:', error);
  }
  next();
}

router.post(
  '/import',
  checkSkillCreate,
  fileUploadIpLimiter,
  fileUploadUserLimiter,
  skillUpload,
  restoreTenantContextFromReq,
  importHandler as any,
);

router.get('/', maybeStartRequestSkillSync, handlers.list as any);
router.post('/', checkSkillCreate, handlers.create as any);

router.get(
  '/:id',
  canAccessSkillResource({ requiredPermission: PermissionBits.VIEW }),
  handlers.get as any,
);

router.patch(
  '/:id',
  checkSkillCreate,
  canAccessSkillResource({ requiredPermission: PermissionBits.EDIT }),
  handlers.patch as any,
);

router.delete(
  '/:id',
  checkSkillCreate,
  canAccessSkillResource({ requiredPermission: PermissionBits.DELETE }),
  handlers.delete as any,
);

router.get(
  '/:id/files',
  canAccessSkillResource({ requiredPermission: PermissionBits.VIEW }),
  handlers.listFiles as any,
);

router.post(
  '/:id/files',
  canAccessSkillResource({ requiredPermission: PermissionBits.EDIT }),
  fileUploadIpLimiter,
  fileUploadUserLimiter,
  singleFileUpload.single('file'),
  restoreTenantContextFromReq,
  uploadFileHandler,
);

router.get(
  '/:id/files/*relativePath',
  canAccessSkillResource({ requiredPermission: PermissionBits.VIEW }),
  handlers.downloadFile as any,
);

router.delete(
  '/:id/files/*relativePath',
  canAccessSkillResource({ requiredPermission: PermissionBits.EDIT }),
  handlers.deleteFile as any,
);

router.use((err: any, _req: any, res: any, next: any) => {
  if (err && (err.name === 'MulterError' || err.message?.startsWith('Only '))) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

export default router;
