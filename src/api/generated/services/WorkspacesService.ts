/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponseWorkspaceResponse } from '../models/ApiResponseWorkspaceResponse';
import type { WorkspaceCreateRequest } from '../models/WorkspaceCreateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WorkspacesService {
    /**
     * 워크스페이스 생성
     * userId, name 필수. 생성 시 기본 브랜치도 함께 생성됩니다(서비스 구현에 따름).
     * @param requestBody
     * @returns ApiResponseWorkspaceResponse OK
     * @throws ApiError
     */
    public static create(
        requestBody: WorkspaceCreateRequest,
    ): CancelablePromise<ApiResponseWorkspaceResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/workspaces',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * 워크스페이스 조회
     * workspaceId로 상세 조회합니다.
     * @param workspaceId
     * @returns ApiResponseWorkspaceResponse OK
     * @throws ApiError
     */
    public static get(
        workspaceId: string,
    ): CancelablePromise<ApiResponseWorkspaceResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/workspaces/{workspaceId}',
            path: {
                'workspaceId': workspaceId,
            },
        });
    }
}
