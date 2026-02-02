/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponseBranchResponse } from '../models/ApiResponseBranchResponse';
import type { ApiResponseListBranchResponse } from '../models/ApiResponseListBranchResponse';
import type { BranchCreateRequest } from '../models/BranchCreateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BranchesService {
    /**
     * 워크스페이스의 브랜치 목록
     * workspaceId로 브랜치 목록을 조회합니다.
     * @param workspaceId
     * @returns ApiResponseListBranchResponse OK
     * @throws ApiError
     */
    public static listByWorkspace(
        workspaceId: string,
    ): CancelablePromise<ApiResponseListBranchResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/workspaces/{workspaceId}/branches',
            path: {
                'workspaceId': workspaceId,
            },
        });
    }
    /**
     * 브랜치 생성
     * workspaceId 경로값 + body(name, description, isDefault)
     * @param workspaceId
     * @param requestBody
     * @returns ApiResponseBranchResponse OK
     * @throws ApiError
     */
    public static create2(
        workspaceId: string,
        requestBody: BranchCreateRequest,
    ): CancelablePromise<ApiResponseBranchResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/workspaces/{workspaceId}/branches',
            path: {
                'workspaceId': workspaceId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
