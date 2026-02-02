/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiResponse } from '../models/ApiResponse';
import type { LoginRequest } from '../models/LoginRequest';
import type { SignupRequest } from '../models/SignupRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuthService {
    /**
     * 회원가입(또는 미존재 시 생성) 후 토큰 발급
     * MVP 단계: password 없이 email 기반으로 유저를 생성/조회하고 JWT를 발급합니다.
     * @param requestBody
     * @returns ApiResponse 성공
     * @throws ApiError
     */
    public static signup(
        requestBody: SignupRequest,
    ): CancelablePromise<ApiResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/signup',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * 로그인(이메일 기반) 후 토큰 발급
     * MVP 단계: email로 유저를 조회하고 JWT를 발급합니다.
     * @param requestBody
     * @returns ApiResponse 성공
     * @throws ApiError
     */
    public static login(
        requestBody: LoginRequest,
    ): CancelablePromise<ApiResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/login',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
