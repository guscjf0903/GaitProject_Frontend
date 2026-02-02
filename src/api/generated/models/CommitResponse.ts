/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 생성된 커밋
 */
export type CommitResponse = {
    id?: string;
    workspaceId?: string;
    branchId?: string;
    parentId?: string;
    mergeParentId?: string;
    mergeType: 'NONE' | 'FAST_FORWARD' | 'SQUASH' | 'DEEP';
    isMerge: boolean;
    createdByUserId?: string;
    keyPoint: string;
    shortSummary?: string;
    longSummary?: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
};

