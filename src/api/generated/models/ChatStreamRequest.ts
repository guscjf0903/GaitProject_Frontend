/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChatStreamRequest = {
    /**
     * 워크스페이스 ID
     */
    workspaceId: string;
    /**
     * 브랜치 ID
     */
    branchId: string;
    /**
     * 컨텍스트 기준 커밋 ID(체크아웃/타임트래블 시점). null이면 브랜치 HEAD 기준
     */
    contextCommitId?: string | null;
    /**
     * 사용자 질문/메시지 내용
     */
    content: string;
};

