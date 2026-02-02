/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CommitCreateRequest = {
    /**
     * 워크스페이스 ID(경로값으로 주입됨)
     */
    workspaceId: string | null;
    /**
     * 브랜치 ID(경로값으로 주입됨)
     */
    branchId: string | null;
    /**
     * 커밋 제목/핵심
     */
    keyPoint: string;
    /**
     * 짧은 요약(선택)
     */
    shortSummary?: string | null;
    /**
     * 긴 요약(선택)
     */
    longSummary?: string | null;
};

