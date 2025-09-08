/**
 * Extract the creation input type from any entity
 */
export type CreateInput<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Generic filter pattern with pagination
 */
export type FilterOptions<T> = {
  [K in keyof T]?: T[K] extends string | number | boolean ? T[K] : never;
} & PaginationOptions;

/**
 * Generic pagination options
 */
export type PaginationOptions = {
  limit?: number;
  offset?: number;
};

/**
 * Utility to create filters for any status-based entity
 */
export type StatusFilter<T extends StatusEntity> = {
  createdBy?: T extends AuditableEntity ? string : never;
  status?: T['status'];
};

/**
 * Extract updatable fields (excluding audit fields)
 */
export type UpdateInput<T extends BaseEntity> = Partial<
  Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
>;

/**
 * For operations that need additional context
 */
export type WithContext<T, TContext> = T & TContext;

/**
 * For operations that need specific identification
 */
export type WithIdentification<T> = T & {
  featureId: string;
};

/**
 * Base fields for entities that track who created them
 */
export interface AuditableEntity extends BaseEntity {
  createdBy: string;
}

/**
 * Base fields that every entity has
 */
export interface BaseEntity {
  createdAt: number;
  id: string;
  updatedAt: number;
}

export interface JsonRpcResponse {
  id: number;
  jsonrpc: string;
  result: {
    content: Array<{
      text: string;
      type: string;
    }>;
  };
}

/**
 * Common pattern for entities with status
 */
export interface StatusEntity<TStatus = string> extends BaseEntity {
  status: TStatus;
}
