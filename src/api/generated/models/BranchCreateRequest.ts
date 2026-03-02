/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type BranchCreateRequest = {
    /**
     * 워크스페이스 ID(경로값으로 주입됨)
     */
    workspaceId: string | null;
    /**
     * 브랜치 이름
     */
    name: string;
    /**
     * 설명
     */
    description?: string | null;
    /**
     * 기본 브랜치 여부
     */
    isDefault: boolean;
    /**
     * 브랜치 시작 기준 커밋 ID(선택). 지정하면 해당 커밋을 base/head로 설정
     */
    baseCommitId?: string | null;
};

