/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse } from '../models/ApiResponse';
import type { ChatStreamRequest } from '../models/ChatStreamRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ChatStreamService {
    /**
     * AI 답변 SSE 스트리밍
     * 응답은 `text/event-stream`으로 전송됩니다. 이벤트명은 `ANSWER_CHUNK`(여러 번) → `ANSWER_DONE`(1번) 순서입니다.
     * @param requestBody
     * @returns ApiResponse SSE 스트림 시작
     * @throws ApiError
     */
    public static stream(
        requestBody: ChatStreamRequest,
    ): CancelablePromise<ApiResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/chat/stream',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
