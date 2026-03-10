/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponseMergeResponse } from '../models/ApiResponseMergeResponse';
import type { MergeCreateRequest } from '../models/MergeCreateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MergesService {
    /**
     * 머지 생성
     * fromBranchId → toBranchId로 merge를 수행하고 merge 기록을 생성합니다.
     * @param workspaceId
     * @param requestBody
     * @returns ApiResponseMergeResponse OK
     * @throws ApiError
     */
    public static create1(
        workspaceId: string,
        requestBody: MergeCreateRequest,
    ): CancelablePromise<ApiResponseMergeResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/workspaces/{workspaceId}/merges',
            path: {
                'workspaceId': workspaceId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
