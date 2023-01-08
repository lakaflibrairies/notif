/** Tools */

import { IncomingMessage } from ".";

export declare function generateInt(min: number, max: number): number;

export declare function generateKey(length: number): string;

export declare function generateColor(): string;

export declare function parseBody(req: IncomingMessage): Promise<Record<string, any> | string>

export declare function parseValue(value: any): Record<string, any> | string;

export declare function parseQueryParams(req: IncomingMessage): Record<string, string>;

export declare function generateNotification(options: { notificationName: string; payload: any; }): string;

export declare function successResponse(result: any): string;

export declare function errorResponse(error: any): string;
