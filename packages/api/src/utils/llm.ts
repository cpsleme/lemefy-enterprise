import { lemefy } from 'lemefy-data-provider';
import type { DynamicSettingProps } from 'lemefy-data-provider';

type LemefyKeys = keyof typeof lemefy;

type LemefyParams = {
  modelOptions: Omit<NonNullable<DynamicSettingProps['conversation']>, LemefyKeys>;
  resendFiles: boolean;
  promptPrefix?: string | null;
  maxContextTokens?: number;
  fileTokenLimit?: number;
  modelLabel?: string | null;
};

/**
 * Separates Lemefy-specific parameters from model options
 * @param options - The combined options object
 */
export function extractLemefyParams(
  options?: DynamicSettingProps['conversation'],
): LemefyParams {
  if (!options) {
    return {
      modelOptions: {} as Omit<NonNullable<DynamicSettingProps['conversation']>, LemefyKeys>,
      resendFiles: lemefy.resendFiles.default as boolean,
    };
  }

  const modelOptions = { ...options };

  const resendFiles =
    (delete modelOptions.resendFiles, options.resendFiles) ??
    (lemefy.resendFiles.default as boolean);
  const promptPrefix = (delete modelOptions.promptPrefix, options.promptPrefix);
  const maxContextTokens = (delete modelOptions.maxContextTokens, options.maxContextTokens);
  const fileTokenLimit = (delete modelOptions.fileTokenLimit, options.fileTokenLimit);
  const modelLabel = (delete modelOptions.modelLabel, options.modelLabel);

  return {
    modelOptions: modelOptions as Omit<
      NonNullable<DynamicSettingProps['conversation']>,
      LemefyKeys
    >,
    maxContextTokens,
    fileTokenLimit,
    promptPrefix,
    resendFiles,
    modelLabel,
  };
}
