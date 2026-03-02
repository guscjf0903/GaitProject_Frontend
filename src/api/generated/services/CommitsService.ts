/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponseCommitCreateResultResponse } from '../models/ApiResponseCommitCreateResultResponse';
import type { ApiResponseListCommitResponse } from '../models/ApiResponseListCommitResponse';
import type { CommitCreateRequest } from '../models/CommitCreateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CommitsService {
    /**
     * 브랜치 커밋 목록
     * 브랜치의 커밋 목록(최신순 조회 후 응답은 생성시각 오름차순으로 사용 가능)
     * @param workspaceId
     * @param branchId
     * @param limit
     * @returns ApiResponseListCommitResponse OK
     * @throws ApiError
     */
    public static list(
        workspaceId: string,
        branchId: string,
        limit: number = 200,
    ): CancelablePromise<ApiResponseListCommitResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/workspaces/{workspaceId}/branches/{branchId}/commits',
            path: {
                'workspaceId': workspaceId,
                'branchId': branchId,
            },
            query: {
                'limit': limit,
            },
        });
    }
    /**
     * 커밋 생성
     * 브랜치의 최근 메시지를 커밋에 부착하고, 커밋 요약 정보를 저장합니다(서비스 구현에 따름).
     * @param workspaceId
     * @param branchId
     * @param requestBody
     * @param createdByUserId
     * @returns ApiResponseCommitCreateResultResponse OK
     * @throws ApiError
     */
    public static create3(
        workspaceId: string,
        branchId: string,
        requestBody: CommitCreateRequest,
        createdByUserId?: string,
    ): CancelablePromise<ApiResponseCommitCreateResultResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/workspaces/{workspaceId}/branches/{branchId}/commits',
            path: {
                'workspaceId': workspaceId,
                'branchId': branchId,
            },
            query: {
                'createdByUserId': createdByUserId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
