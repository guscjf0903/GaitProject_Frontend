/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MergeCreateRequest = {
    /**
     * 워크스페이스 ID(경로값으로 주입됨)
     */
    workspaceId: string | null;
    /**
     * 머지 출발 브랜치 ID
     */
    fromBranchId: string;
    /**
     * 머지 대상 브랜치 ID
     */
    toBranchId: string;
    /**
     * 머지 타입
     */
    mergeType: 'NONE' | 'FAST_FORWARD' | 'SQUASH' | 'DEEP';
    /**
     * 머지 노트(옵션)
     */
    notes?: string | null;
};

