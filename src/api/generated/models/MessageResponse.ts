/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MessageResponse = {
    id?: string;
    workspaceId?: string;
    branchId?: string;
    commitId?: string;
    userId?: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
    content: string;
    metadata?: string;
    sequence: number;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
};

