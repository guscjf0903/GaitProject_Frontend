/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponseListWorkspaceResponse } from '../models/ApiResponseListWorkspaceResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersService {
    /**
     * 유저의 워크스페이스 목록
     * userId로 소유한 workspace 목록을 조회합니다.
     * @param userId
     * @returns ApiResponseListWorkspaceResponse OK
     * @throws ApiError
     */
    public static list1(
        userId: string,
    ): CancelablePromise<ApiResponseListWorkspaceResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/{userId}/workspaces',
            path: {
                'userId': userId,
            },
        });
    }
}
