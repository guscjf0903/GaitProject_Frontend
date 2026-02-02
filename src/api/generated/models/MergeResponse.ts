/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MergeResponse = {
    id?: string;
    workspaceId?: string;
    fromBranchId?: string;
    toBranchId?: string;
    fromCommitId?: string;
    toCommitId?: string;
    mergeCommitId?: string;
    mergeType: 'NONE' | 'FAST_FORWARD' | 'SQUASH' | 'DEEP';
    initiatedByUserId?: string;
    notes?: string;
    createdAt?: string;
};

