/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponseListMessageResponse } from '../models/ApiResponseListMessageResponse';
import type { ApiResponseMessageResponse } from '../models/ApiResponseMessageResponse';
import type { MessageSendRequest } from '../models/MessageSendRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MessagesService {
    /**
     * 메시지 전송
     * 브랜치 내 메시지를 저장합니다. role(USER/ASSISTANT 등), content가 필요합니다.
     * @param workspaceId
     * @param branchId
     * @param requestBody
     * @returns ApiResponseMessageResponse OK
     * @throws ApiError
     */
    public static send(
        workspaceId: string,
        branchId: string,
        requestBody: MessageSendRequest,
    ): CancelablePromise<ApiResponseMessageResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/workspaces/{workspaceId}/branches/{branchId}/messages',
            path: {
                'workspaceId': workspaceId,
                'branchId': branchId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * 브랜치 타임라인 조회(after)
     * branchId 기준 sequence 오름차순. after(배타), limit 기본 50
     * @param branchId
     * @param after
     * @param limit
     * @returns ApiResponseListMessageResponse OK
     * @throws ApiError
     */
    public static timelineAfter(
        branchId: string,
        after?: number,
        limit: number = 50,
    ): CancelablePromise<ApiResponseListMessageResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/workspaces/{workspaceId}/branches/{branchId}/messages/timeline',
            path: {
                'branchId': branchId,
            },
            query: {
                'after': after,
                'limit': limit,
            },
        });
    }
}
