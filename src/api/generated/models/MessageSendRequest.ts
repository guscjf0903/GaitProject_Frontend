/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MessageSendRequest = {
    /**
     * 워크스페이스 ID(경로값으로 주입됨)
     */
    workspaceId: string | null;
    /**
     * 브랜치 ID(경로값으로 주입됨)
     */
    branchId: string | null;
    /**
     * 작성자 유저 ID(옵션)
     */
    userId?: string | null;
    /**
     * 메시지 역할
     */
    role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
    /**
     * 메시지 본문
     */
    content: string;
    /**
     * 메타데이터(JSON 문자열 등)
     */
    metadata?: string | null;
    rawPrompt?: string;
    rawResponse?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    modelName?: string;
};

